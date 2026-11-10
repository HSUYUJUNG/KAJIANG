import { useEffect, useRef, useState } from "react";
import { get, onValue, remove } from "firebase/database";
import { mulberry, projectPublic, type HandPrivate, type PublicView, type Settlement } from "../logic/engine";
import { ensureUser, knownRooms, roomRef, shareUrl } from "../net/firebase";
import { normalizeHand, normalizePublic } from "../net/wire";
import {
  applyHuman,
  beginMatch,
  handsOf,
  lobbyState,
  nextHand,
  paceMs,
  roomExpired,
  seatName,
  stateFromSecret,
  tick,
  type HostState,
  type Intent,
  type PublicState,
  type RoomMeta,
  type Seat,
  type Settings,
} from "../net/host";
import {
  bindHostPresence,
  bindSeatPresence,
  parseSeats,
  patchSeat,
  publishState,
  saveSettings,
  sendIntent,
  sweepKnownRooms,
  transferHost,
  writeSeat,
} from "../net/rooms";
import { TableView, type Action, type TableModel } from "./TableView";

export function LobbyPreview() {
  const seats: Seat[] = [
    { uid: "a", name: "春", bot: false, connected: true, auto: false },
    { uid: "b", name: "夏", bot: false, connected: true, auto: false },
    { uid: null, name: "電腦", bot: true, connected: true, auto: false },
    { uid: null, name: "", bot: false, connected: false, auto: false },
  ];
  return (
    <Lobby
      code="AB3K"
      host
      uid="a"
      name="春"
      seats={seats}
      settings={{ len: "quan", base: 50, per: 20, anim: "normal" }}
      onSettings={() => undefined}
      onSit={() => undefined}
      onBot={() => undefined}
      onStart={() => undefined}
      onLeave={() => undefined}
    />
  );
}

export function Online(props: { code: string; name: string; onHome: () => void }) {
  const code = props.code.toUpperCase();
  const [uid, setUid] = useState<string | null>(null);
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [pub, setPub] = useState<PublicState | null>(null);
  const [handTiles, setHandTiles] = useState<HandPrivate | null>(null);
  const [hostSnap, setHostSnap] = useState<HostState | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const [anim, setAnim] = useState<Settings["anim"] | null>(null);
  const seatsRef = useRef<Seat[]>([]);
  const metaRef = useRef<RoomMeta | null>(null);
  metaRef.current = meta;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    void sweepKnownRooms(knownRooms());
    ensureUser().then((u) => setUid(u.uid)).catch(() => setErr("登入失敗。請到 Firebase 主控台啟用匿名登入。"));
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) return;
    const errs = (e: Error) => setErr(e.message || "連線中斷");
    const u1 = onValue(roomRef(code, "meta"), (s) => setMeta(s.val()), errs);
    const u2 = onValue(roomRef(code, "seats"), (s) => {
      const parsed = parseSeats(s.val());
      seatsRef.current = parsed;
      setSeats(parsed);
    }, errs);
    const u3 = onValue(roomRef(code, "public"), (s) => setPub(normalizePublic(s.val())), errs);
    return () => { u1(); u2(); u3(); };
  }, [uid, code]);

  const mySeat = seats?.findIndex((s) => s.uid === uid) ?? -1;
  const isHost = !!uid && meta?.hostUid === uid;

  useEffect(() => {
    if (!uid || mySeat < 0) return;
    const unsub = onValue(roomRef(code, `hands/${mySeat}`), (s) => setHandTiles(normalizeHand(s.val())));
    let stop = () => undefined as void;
    void bindSeatPresence(code, mySeat).then((fn) => { stop = fn; }).catch(() => undefined);
    return () => { unsub(); stop(); };
  }, [uid, code, mySeat]);

  useEffect(() => {
    if (!isHost || !uid || !meta) return;
    let stop = false;
    const goneAt = [0, 0, 0, 0];
    let prevConn = seatsRef.current.map((s) => s.connected);
    const stateRef = { current: null as HostState | null };
    let earliest = 0;
    let chain = Promise.resolve();
    let release: (() => void) | null = null;
    let presence = () => undefined as void;
    const intentUnsubs: Array<() => void> = [];

    const commit = (fn: (s: HostState) => HostState, writeSeats = false) => {
      chain = chain.then(async () => {
        const cur = stateRef.current;
        if (stop || !cur) return;
        const live = seatsRef.current;
        const seats = cur.game
          ? cur.seats.map((s, i) => {
            const r = live[i];
            if (!r) return s;
            if (s.bot && !r.uid) return { ...s, connected: true };
            return { ...s, connected: r.connected, auto: r.auto, name: r.name || s.name, uid: r.uid };
          })
          : live.map((s) => ({ ...s }));
        const base = { ...cur, seats };
        const next = fn(base);
        if (next === base) return;
        stateRef.current = next;
        setHostSnap(next);
        await publishState(code, next, writeSeats);
      }).catch((e: Error) => setErr(e.message || "同步失敗"));
    };
    (window as unknown as { __kajiangHost?: typeof commit }).__kajiangHost = commit;

    const boot = async () => {
      if (navigator.locks) {
        const ok = await new Promise<boolean>((resolve) => {
          void navigator.locks.request(`kajiang-${code}`, { ifAvailable: true }, (lock) => {
            if (!lock) { resolve(false); return; }
            resolve(true);
            return new Promise<void>((r) => { release = r; });
          });
        });
        if (!ok || stop) { if (!stop) setErr("這個房間已在另一個分頁開著。"); return; }
      }
      const sec = await get(roomRef(code, "secret"));
      const liveMeta = metaRef.current;
      if (!liveMeta || stop) return;
      let state = lobbyState(liveMeta, seatsRef.current);
      if (sec.exists() && sec.val()?.game) state = stateFromSecret(liveMeta, seatsRef.current, sec.val());
      if (stop) return;
      stateRef.current = state;
      setHostSnap(state);
      void bindHostPresence(code).then((fn) => { presence = fn; });
      for (let i = 0; i < 4; i++) {
        const iref = roomRef(code, `intents/${i}`);
        intentUnsubs.push(onValue(iref, (snap) => {
          const intent = snap.val() as Intent | null;
          if (!intent) return;
          void remove(iref);
          commit((s) => applyHuman(s, intent, Date.now(), goneAt));
        }));
      }
    };
    void boot();
    const timer = window.setInterval(() => {
      seatsRef.current.forEach((s, i) => {
        if (prevConn[i] && !s.connected) goneAt[i] = Date.now();
        if (s.connected) goneAt[i] = 0;
      });
      prevConn = seatsRef.current.map((s) => s.connected);
      const s = stateRef.current;
      if (!s?.game || s.meta.status !== "playing") return;
      const t = Date.now();
      commit((cur) => {
        const before = cur.game?.evSeq ?? 0;
        const next = tick(cur, t, goneAt, earliest);
        if ((next.game?.evSeq ?? 0) !== before) earliest = t + paceMs(cur.meta.settings.anim);
        return next;
      });
    }, 250);
    return () => {
      stop = true;
      window.clearInterval(timer);
      intentUnsubs.forEach((fn) => fn());
      presence();
      release?.();
      if ((window as unknown as { __kajiangHost?: unknown }).__kajiangHost === commit) {
        delete (window as unknown as { __kajiangHost?: unknown }).__kajiangHost;
      }
    };
  }, [isHost, uid, code]);

  const start = () => {
    const commit = (window as unknown as { __kajiangHost?: (fn: (s: HostState) => HostState, seats?: boolean) => void }).__kajiangHost;
    const live = metaRef.current;
    if (!commit || !live) return;
    commit((s) => beginMatch({ ...s, meta: { ...live, hostOnline: true }, seats: seatsRef.current }, mulberry(Date.now() >>> 0), Date.now()), true);
  };
  const advance = () => {
    const commit = (window as unknown as { __kajiangHost?: (fn: (s: HostState) => HostState, seats?: boolean) => void }).__kajiangHost;
    commit?.((s) => nextHand(s, mulberry((Date.now() + 17) >>> 0), Date.now()), false);
  };

  const act = (a: Action) => {
    if (!uid || mySeat < 0) return;
    const intent = toIntent(a, mySeat, uid);
    if (!intent) return;
    if (isHost) {
      const commit = (window as unknown as { __kajiangHost?: (fn: (s: HostState) => HostState) => void }).__kajiangHost;
      commit?.((s) => applyHuman(s, intent, Date.now(), [0, 0, 0, 0]));
    } else {
      void sendIntent(code, intent).catch(() => setErr("送出失敗，請看一下網路"));
    }
  };

  if (!meta || !seats) {
    return <div className="card">{err || "正在進入房間…"}{err ? <div><button className="btn" onClick={props.onHome}>回首頁</button></div> : null}</div>;
  }
  if (roomExpired(meta.lastActive) && meta.status !== "lobby") {
    return <div className="card stack"><p>這間房已超過一天，請另開新桌。</p><button className="btn" onClick={props.onHome}>回首頁</button></div>;
  }

  const playing = (isHost ? hostSnap?.meta.status : pub?.status) === "playing" || (isHost ? hostSnap?.meta.status : pub?.status) === "ended";
  const ended = (isHost ? hostSnap?.meta.status : meta.status) === "ended" || pub?.status === "ended";
  if (!playing || (isHost ? !hostSnap?.game : !pub?.view) || mySeat < 0) {
    return (
      <div className="stack">
        {err ? <p className="err">{err}</p> : null}
        {!meta.hostOnline && meta.status !== "lobby" ? <p className="warn">房主離線，牌局先暫停。房主回到這個連結就會繼續。若房主沒先移交，其他人無法接手暗牌。</p> : null}
        <Lobby
          code={code}
          host={isHost}
          uid={uid}
          name={props.name}
          seats={seats}
          settings={meta.settings}
          onSettings={(s) => { if (isHost) void saveSettings(code, s); }}
          onSit={(i) => uid && void writeSeat(code, i, { uid, name: props.name, bot: false, connected: true, auto: false })}
          onLeaveSeat={(i) => void writeSeat(code, i, { uid: null, name: "", bot: false, connected: false, auto: false })}
          onBot={(i, bot) => void writeSeat(code, i, bot
            ? { uid: null, name: "電腦", bot: true, connected: true, auto: false }
            : { uid: null, name: "", bot: false, connected: false, auto: false })}
          onStart={start}
          onLeave={props.onHome}
          onTransfer={(id) => void transferHost(code, id).then(props.onHome)}
        />
      </div>
    );
  }

  const view = isHost && hostSnap?.game ? projectFromHost(hostSnap, mySeat) : projectFromPublic(pub, handTiles, seats, mySeat, meta);
  if (!view) return <div className="card">等待發牌…</div>;
  const speed = anim ?? meta.settings.anim;
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : 0;
  return (
    <div className="stack">
      {err ? <p className="err">{err}</p> : null}
      {!meta.hostOnline && !isHost ? <p className="warn">房主離線，暫停中。</p> : null}
      <TableView
        model={view.model}
        anim={speed}
        onAction={act}
        settlement={view.settlement}
        stake={{ base: meta.settings.base, per: meta.settings.per }}
        header={<span className="muted">{code}{left && view.model.prompt ? ` · ${left} 秒` : ""}</span>}
        footer={
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn quiet" onClick={() => patchSeat(code, mySeat, { auto: !seats[mySeat].auto })}>{seats[mySeat].auto ? "取消託管" : "託管"}</button>
            <button className="btn quiet" onClick={() => setAnim(speed === "off" ? "normal" : speed === "normal" ? "fast" : "off")}>動畫{speed === "off" ? "關" : speed === "fast" ? "快" : "正常"}</button>
            {isHost && view.model.phase === "end" && !ended ? <button className="btn primary" onClick={advance}>下一局</button> : null}
            {isHost && ended ? <button className="btn primary" onClick={start}>再來一場</button> : null}
            {!isHost && view.model.phase === "end" ? <span className="muted">等待房主開下一局</span> : null}
            <button className="btn quiet" onClick={props.onHome}>離開</button>
          </div>
        }
      />
    </div>
  );
}

function projectFromHost(state: HostState, me: number): { model: TableModel; settlement: Settlement | null; deadline: number | null } | null {
  if (!state.game || !state.match) return null;
  const view = projectPublic(state.game);
  const hand = handsOf(state)[me];
  return {
    model: toModel(me, view, hand, state.seats, state.match.scores, state.settlement, state.match),
    settlement: state.settlement,
    deadline: state.deadline,
  };
}

function projectFromPublic(
  pub: PublicState | null,
  hand: HandPrivate | null,
  seats: Seat[],
  me: number,
  _meta: RoomMeta,
): { model: TableModel; settlement: Settlement | null; deadline: number | null } | null {
  if (!pub?.view || !pub.match) return null;
  return {
    model: toModel(me, pub.view, hand, seats, pub.match.scores, pub.settlement, pub.match),
    settlement: pub.settlement,
    deadline: pub.deadline,
  };
}

function toModel(
  me: number,
  view: PublicView,
  hand: HandPrivate | null,
  seats: Seat[],
  scores: number[],
  settlement: Settlement | null,
  match: { wind: number; handNo: number; streak: number; dealer: number },
  _settings?: Settings,
): TableModel {
  const shown = scores.map((s, i) => s + (settlement?.deltas[i] || 0));
  return {
    me,
    names: seats.map(seatName),
    scores: shown,
    dealer: view.dealer,
    streak: match.streak,
    wind: match.wind,
    handNo: match.handNo,
    wallLeft: view.wallLeft,
    phase: view.phase,
    turn: view.turn,
    players: view.players,
    myHand: hand?.tiles ?? [],
    myDrawn: hand?.drawn ?? null,
    myMelds: hand?.melds ?? view.players[me].melds,
    recent: view.recent,
    last: view.last,
    prompt: hand?.prompt ?? null,
    log: view.log,
    ev: view.ev,
    reveal: view.reveal,
    bots: seats.map((s) => s.bot),
    connected: seats.map((s) => s.connected),
    auto: seats.map((s) => s.auto),
  };
}

function toIntent(a: Action, seat: number, uid: string): Intent | null {
  if (a.type === "discard") return { uid, seat, kind: "discard", tile: a.tile };
  if (a.type === "tsumo") return { uid, seat, kind: "tsumo" };
  if (a.type === "kan") return { uid, seat, kind: "kan", kan: { kind: a.kanKind, tile: a.tile } };
  if (a.type === "claim") return { uid, seat, kind: "claim", claim: a.kind === "chi" ? { kind: "chi", tiles: a.tiles ?? [] } : { kind: a.kind } };
  if (a.type === "rob") return { uid, seat, kind: "rob", rob: a.yes };
  return null;
}

function Lobby(props: {
  code: string;
  host: boolean;
  uid: string | null;
  name: string;
  seats: Seat[];
  settings: Settings;
  onSettings: (s: Settings) => void;
  onSit: (i: number) => void;
  onLeaveSeat?: (i: number) => void;
  onBot: (i: number, bot: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onTransfer?: (uid: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = typeof location !== "undefined" ? shareUrl(props.code) : props.code;
  const humans = props.seats.filter((s) => s.uid && !s.bot).length;
  const mine = props.seats.findIndex((s) => s.uid && s.uid === props.uid);
  const setLen = (len: Settings["len"]) => props.onSettings({ ...props.settings, len });
  const setStake = (key: string) => {
    if (key === "custom") return;
    const [base, per] = key.split("/").map((n) => +n);
    props.onSettings({ ...props.settings, base, per });
  };
  const stakeKey = ["30/10", "50/20", "100/30"].includes(`${props.settings.base}/${props.settings.per}`)
    ? `${props.settings.base}/${props.settings.per}` : "custom";
  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>房間</b>
        <button className="btn quiet" onClick={props.onLeave}>離開</button>
      </div>
      <div className="code" aria-label="房間代碼">{props.code}</div>
      <button className="btn" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}>{copied ? "已複製連結" : "複製邀請連結"}</button>
      <p className="muted" style={{ wordBreak: "break-all" }}>{link}</p>
      <div className="seats">
        {props.seats.map((s, i) => (
          <div key={i} className={"seat-card" + (s.uid === props.uid ? " me" : "")}>
            <div>
              <div className="muted">{["東位", "南位", "西位", "北位"][i]}</div>
              <b>{s.uid ? s.name || "玩家" : s.bot ? "電腦" : "空位"}</b>
            </div>
            <div className="row">
              {!s.uid && !s.bot ? <button className="btn" onClick={() => props.onSit(i)}>入座</button> : null}
              {s.uid === props.uid && props.onLeaveSeat ? <button className="btn quiet" onClick={() => props.onLeaveSeat?.(i)}>離座</button> : null}
              {props.host && !s.uid ? <button className="btn quiet" onClick={() => props.onBot(i, !s.bot)}>{s.bot ? "改空位" : "電腦"}</button> : null}
              {props.host && s.uid && s.uid !== props.uid && props.onTransfer ? <button className="btn quiet" onClick={() => props.onTransfer?.(s.uid as string)}>移交</button> : null}
            </div>
          </div>
        ))}
      </div>
      {props.host ? (
        <>
          <div className="seg">
            <button aria-pressed={props.settings.len === "quan"} onClick={() => setLen("quan")}>一圈</button>
            <button aria-pressed={props.settings.len === "jiang"} onClick={() => setLen("jiang")}>一將</button>
          </div>
          <div className="seg">
            {["30/10", "50/20", "100/30"].map((k) => <button key={k} aria-pressed={stakeKey === k} onClick={() => setStake(k)}>{k}</button>)}
          </div>
          <div className="seg">
            {(["normal", "fast", "off"] as const).map((k) => (
              <button key={k} aria-pressed={props.settings.anim === k} onClick={() => props.onSettings({ ...props.settings, anim: k })}>
                {k === "normal" ? "動畫正常" : k === "fast" ? "快速" : "關閉"}
              </button>
            ))}
          </div>
          <p className="muted">空位在開局時變成電腦。底 {props.settings.base}、每台 {props.settings.per}，胡牌最少 1 台。現在 {humans} 人。</p>
          <button className="btn primary" disabled={humans < 1 || mine < 0} onClick={props.onStart}>開始</button>
        </>
      ) : <p className="muted">{mine < 0 ? "選一個空位坐下。" : "等房主開始。人不夠會由電腦補位。"}</p>}
    </section>
  );
}
