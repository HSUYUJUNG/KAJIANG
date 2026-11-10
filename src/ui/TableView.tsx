import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HONORS,
  canTsumo,
  decompText,
  groupText,
  kanOptions,
  seatWind,
  tileName,
  toCounts,
  type Ev,
  type Game,
  type Meld,
  type Prompt,
  type PublicPlayer,
  type Settlement,
} from "../logic/engine";
import { MeldRow, Tile, TileBack } from "./Tile";

export interface TableModel {
  me: number;
  names: string[];
  scores: number[];
  dealer: number;
  streak: number;
  wind: number;
  handNo: number;
  wallLeft: number;
  phase: string;
  turn: number;
  players: PublicPlayer[];
  myHand: number[];
  myDrawn: number | null;
  myMelds: Meld[];
  recent: number;
  last: { tile: number; from: number } | null;
  prompt: Prompt | null;
  log: string[];
  ev: Ev[];
  reveal: boolean;
  bots?: boolean[];
  connected?: boolean[];
  auto?: boolean[];
}
export type Action =
  | { type: "discard"; tile: number }
  | { type: "tsumo" }
  | { type: "kan"; tile: number; kanKind: "ankan" | "added" }
  | { type: "claim"; kind: "pass" | "ron" | "pon" | "kan" | "chi"; tiles?: number[] }
  | { type: "rob"; yes: boolean };

export function relSeat(me: number, seat: number): number {
  return (seat - me + 4) % 4;
}
export function money(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function useWidth(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(390);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setW(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dep]);
  return { ref, w };
}

/** 每一局的事件編號都從 1 重新計。已看過的編號若比這次更大，代表換局了。 */
export function nextFlyEvents<T extends { n: number }>(ev: T[] | null | undefined, seen: number): { fresh: T[]; seen: number; restarted: boolean } {
  const list = Array.isArray(ev) ? ev : [];
  const maxN = list.reduce((max, e) => Math.max(max, Number(e?.n) || 0), 0);
  const restarted = maxN < seen;
  const mark = restarted ? 0 : seen;
  const fresh = list.filter((e) => (Number(e?.n) || 0) > mark);
  return { fresh, seen: fresh.length > 0 ? fresh[fresh.length - 1].n : mark, restarted };
}

function useFly(ev: Ev[], speed: "normal" | "fast" | "off") {
  const [queue, setQueue] = useState<Ev[]>([]);
  const [fly, setFly] = useState(false);
  const seen = useRef(0);
  useEffect(() => {
    const step = nextFlyEvents(ev, seen.current);
    seen.current = step.seen;
    if (step.restarted) {
      setFly(false);
      setQueue(speed === "off" ? [] : step.fresh);
      return;
    }
    if (step.fresh.length === 0 || speed === "off") return;
    setQueue((q) => [...q, ...step.fresh]);
  }, [ev, speed]);
  const cur = queue[0] ?? null;
  useEffect(() => {
    if (!cur) return;
    const f = speed === "fast" ? 0.5 : 1;
    const hold = (cur.kind === "discard" ? 700 : 900) * f;
    const flyMs = 280 * f;
    setFly(false);
    const t1 = window.setTimeout(() => setFly(true), hold);
    const t2 = window.setTimeout(() => setQueue((q) => q.slice(1)), hold + flyMs);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [cur, speed]);
  const blocking = speed !== "off" && (queue.length > 1 || (!!cur && !fly));
  const reset = () => { seen.current = 0; setQueue([]); setFly(false); };
  return { cur, fly, blocking, reset };
}

function readyModel(raw: TableModel): TableModel {
  const players = (Array.isArray(raw.players) ? raw.players : []).map((p) => ({
    handCount: p?.handCount ?? 0,
    melds: (Array.isArray(p?.melds) ? p.melds : []).map((meld) => ({
      ...meld,
      tiles: Array.isArray(meld?.tiles) ? meld.tiles : [],
    })),
    discards: Array.isArray(p?.discards) ? p.discards : [],
    revealed: Array.isArray(p?.revealed) ? p.revealed : null,
  }));
  while (players.length < 4) players.push({ handCount: 0, melds: [], discards: [], revealed: null });
  const prompt = raw.prompt;
  const safePrompt: Prompt | null = !prompt ? null
    : prompt.kind === "turn"
      ? { ...prompt, kans: Array.isArray(prompt.kans) ? prompt.kans : [], drawn: prompt.drawn ?? null }
      : prompt.kind === "claim"
        ? {
          ...prompt,
          options: {
            ron: !!prompt.options?.ron,
            pon: !!prompt.options?.pon,
            kan: !!prompt.options?.kan,
            chi: (Array.isArray(prompt.options?.chi) ? prompt.options.chi : []).map((row) => (Array.isArray(row) ? row : [])),
          },
        }
        : prompt;
  return {
    ...raw,
    names: Array.isArray(raw.names) ? raw.names : [],
    scores: Array.isArray(raw.scores) ? raw.scores : [],
    players,
    myHand: Array.isArray(raw.myHand) ? raw.myHand : [],
    myMelds: (Array.isArray(raw.myMelds) ? raw.myMelds : []).map((meld) => ({
      ...meld,
      tiles: Array.isArray(meld?.tiles) ? meld.tiles : [],
    })),
    log: Array.isArray(raw.log) ? raw.log : [],
    ev: (Array.isArray(raw.ev) ? raw.ev : []).map((e) => ({ ...e, tiles: Array.isArray(e?.tiles) ? e.tiles : [] })),
    prompt: safePrompt,
  };
}

export function TableView(props: {
  model: TableModel;
  anim: "normal" | "fast" | "off";
  onAction?: (a: Action) => void;
  header?: ReactNode;
  footer?: ReactNode;
  stake?: { base: number; per: number };
  settlement?: Settlement | null;
}) {
  const m = readyModel(props.model);
  const { ref, w } = useWidth(m.phase + m.myHand.length);
  const anim = useFly(m.ev, props.anim);
  const narrow = w < 520;
  const river = narrow ? 16 : 22;
  const oppMeld = narrow ? 13 : 18;
  const myMeld = narrow ? 20 : 26;
  const handSize = narrow ? 30 : 38;
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [m.turn, m.phase, m.myHand.join(","), m.myDrawn]);
  const myTurn = !!m.prompt && m.prompt.kind === "turn" && !anim.blocking;
  const right = (m.me + 1) % 4;
  const top = (m.me + 2) % 4;
  const left = (m.me + 3) % 4;
  const hideRiver = (p: number) => anim.cur?.kind === "discard" && anim.cur.p === p ? anim.cur.idx : -1;
  const hideMeld = (p: number) => anim.cur && ["chi", "pon", "kan", "ankan"].includes(anim.cur.kind) && anim.cur.p === p ? anim.cur.idx : -1;

  let hand = m.myHand.map((t, i) => ({ t, i }));
  let drawn: { t: number; i: number } | null = null;
  if (m.myDrawn !== null) {
    const di = m.myHand.lastIndexOf(m.myDrawn);
    if (di >= 0) {
      drawn = { t: m.myDrawn, i: di };
      hand = hand.filter((x) => x.i !== di);
    }
  }
  const tap = (i: number, t: number) => {
    if (!myTurn || !props.onAction) return;
    if (sel === i) props.onAction({ type: "discard", tile: t });
    else setSel(i);
  };
  const selTile = sel !== null ? m.myHand[sel] : null;
  const hint = hintOf(m);
  const actions = actionButtons(m, anim.blocking, selTile, props.onAction);

  return (
    <div ref={ref}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>{hint}</strong>
        {props.header}
      </div>
      <div className="opp-grid">
        {([[left, "左"], [top, "上"], [right, "右"]] as const).map(([p, place]) => (
          <Opp key={p} model={m} seat={p} place={place} meldSize={oppMeld} hide={hideMeld(p)} />
        ))}
      </div>
      <div className="felt">
        <div className="r-n"><River model={m} seat={top} size={river} align="center" hide={hideRiver(top)} /></div>
        <div className="r-w"><River model={m} seat={left} size={river} align="start" hide={hideRiver(left)} /></div>
        <div className="info">
          <div>{HONORS[m.wind]}風圈</div>
          <div>第{m.handNo + 1}局{m.streak > 0 ? ` 連${m.streak}` : ""}</div>
          <div>莊 {m.names[m.dealer]}</div>
          <div>剩 {m.wallLeft}</div>
        </div>
        <div className="r-e"><River model={m} seat={right} size={river} align="end" hide={hideRiver(right)} /></div>
        <div className="r-s"><River model={m} seat={m.me} size={river} align="center" hide={hideRiver(m.me)} /></div>
        {anim.cur ? <Fly ev={anim.cur} fly={anim.fly} narrow={narrow} me={m.me} myMelds={m.myMelds} /> : null}
      </div>
      <div className={"me-box" + (myTurn || m.prompt?.kind === "claim" || m.prompt?.kind === "rob" ? " on" : "")}>
        <SeatLine model={m} seat={m.me} plain />
        <MeldRow melds={m.myMelds} size={myMeld} hide={hideMeld(m.me)} seat={m.me} />
        {actions}
        <div className="hand">
          {hand.map((x) => (
            <Tile key={x.i} t={x.t} size={handSize} selected={sel === x.i} onClick={myTurn ? () => tap(x.i, x.t) : undefined} />
          ))}
          {drawn ? (
            <div className="drawn">
              <span className="muted">摸入</span>
              <Tile t={drawn.t} size={handSize} selected={sel === drawn.i} mark={sel === drawn.i ? undefined : "drawn"} onClick={myTurn ? () => tap(drawn.i, drawn.t) : undefined} />
            </div>
          ) : null}
        </div>
      </div>
      {m.phase === "end" && props.settlement && props.stake ? (
        <ResultCard model={m} settlement={props.settlement} stake={props.stake} />
      ) : null}
      {props.footer}
      <div className="muted" style={{ marginTop: 8 }}>{(m.log ?? []).slice(-3).map((l, i) => <div key={i}>{l}</div>)}</div>
    </div>
  );
}

function hintOf(m: TableModel): string {
  if (m.phase === "end") return "本局結束";
  if (m.prompt?.kind === "claim") return `${m.names[m.prompt.from]}打出${tileName(m.prompt.tile)}`;
  if (m.prompt?.kind === "rob") return `${m.names[m.prompt.from]}加槓，可以搶槓`;
  if (m.prompt?.kind === "turn") return "點牌選取，再點一次打出";
  if (m.phase === "claim" || m.phase === "robkan") return "等待叫牌";
  return `${m.names[m.turn] || ""}出牌中`;
}

function actionButtons(m: TableModel, blocking: boolean, selTile: number | null, onAction?: (a: Action) => void) {
  if (blocking || !onAction || !m.prompt) return null;
  const p = m.prompt;
  const nodes: ReactNode[] = [];
    if (p.kind === "turn") {
    if (p.canTsumo) nodes.push(<button key="ts" className="big primary" onClick={() => onAction({ type: "tsumo" })}>自摸</button>);
    for (const k of p.kans ?? []) nodes.push(
      <button key={k.kind + k.tile} className="big" onClick={() => onAction({ type: "kan", tile: k.tile, kanKind: k.kind })}>
        {k.kind === "ankan" ? "暗槓" : "加槓"}<Tile t={k.tile} size={22} />
      </button>,
    );
    if (selTile !== null) nodes.push(
      <button key="d" className={"big" + (p.canTsumo ? "" : " primary")} onClick={() => onAction({ type: "discard", tile: selTile })}>
        打出<Tile t={selTile} size={22} />
      </button>,
    );
  } else if (p.kind === "claim") {
    const o = p.options ?? { ron: false, pon: false, kan: false, chi: [] as number[][] };
    if (o.ron) nodes.push(<button key="ron" className="big primary" onClick={() => onAction({ type: "claim", kind: "ron" })}>胡<Tile t={p.tile} size={22} /></button>);
    if (o.kan) nodes.push(<button key="kan" className="big" onClick={() => onAction({ type: "claim", kind: "kan" })}>槓<Tile t={p.tile} size={22} /></button>);
    if (o.pon) nodes.push(<button key="pon" className="big" onClick={() => onAction({ type: "claim", kind: "pon" })}>碰<Tile t={p.tile} size={22} /></button>);
    const chi = Array.isArray(o.chi) ? o.chi : [];
    if (chi.length) nodes.push(
      <span key="chi" className="row">
        <b>吃</b>
        {chi.map((ch) => (
          <button key={ch.join()} className="big" onClick={() => onAction({ type: "claim", kind: "chi", tiles: ch })}>
            {ch.map((t) => <Tile key={t} t={t} size={22} mark={t === p.tile ? "drawn" : undefined} />)}
          </button>
        ))}
      </span>,
    );
    nodes.push(<button key="pass" className="big" onClick={() => onAction({ type: "claim", kind: "pass" })}>過</button>);
  } else if (p.kind === "rob") {
    nodes.push(<button key="rob" className="big primary" onClick={() => onAction({ type: "rob", yes: true })}>搶槓胡<Tile t={p.tile} size={22} /></button>);
    nodes.push(<button key="n" className="big" onClick={() => onAction({ type: "rob", yes: false })}>過</button>);
  }
  if (nodes.length === 0) return null;
  return <div className="actions">{nodes}</div>;
}

function SeatLine(props: { model: TableModel; seat: number; plain?: boolean }) {
  const { model: m, seat } = props;
  const wind = HONORS[seatWind(seat, m.dealer)];
  const dealer = m.dealer === seat ? (m.streak > 0 ? `莊連${m.streak}` : "莊") : "";
  const status = !props.plain && m.connected && m.connected[seat] === false && !m.bots?.[seat] ? "離線" : props.plain && m.auto?.[seat] ? "託管" : "";
  return (
    <div className="row" style={{ justifyContent: props.plain ? "flex-start" : "center", gap: 6, fontSize: 13 }}>
      <b className="who">{m.names[seat]}</b>
      <span>{wind}</span>
      {dealer ? <span>{dealer}</span> : null}
      {status ? <span className="muted">{status}</span> : null}
      <span>{money(m.scores[seat] || 0)}</span>
    </div>
  );
}

function Opp(props: { model: TableModel; seat: number; place: string; meldSize: number; hide: number }) {
  const pl = props.model.players[props.seat] ?? { handCount: 0, melds: [], discards: [], revealed: null };
  const reveal = props.model.reveal;
  const on = props.model.phase !== "end" && props.model.turn === props.seat;
  return (
    <div className={"opp" + (on ? " on" : "")}>
      <div className="place">{props.place}</div>
      <SeatLine model={props.model} seat={props.seat} />
      <div className="backs" style={{ marginTop: 4 }}>
        {reveal && pl.revealed
          ? pl.revealed.map((t, i) => <Tile key={i} t={t} size={props.meldSize} />)
          : Array.from({ length: pl.handCount }, (_, i) => <TileBack key={i} />)}
      </div>
      <MeldRow melds={pl.melds} size={props.meldSize} hide={props.hide} seat={props.seat} />
    </div>
  );
}

function River(props: { model: TableModel; seat: number; size: number; align: "start" | "center" | "end"; hide: number }) {
  const ds = props.model.players[props.seat]?.discards ?? [];
  return (
    <div className={"river " + (props.align === "center" ? "center" : props.align === "end" ? "end" : "start")} data-rv={props.seat}>
      <div className="river-cap">{props.model.names[props.seat]}打出</div>
      <div className="river-grid" style={{ gridTemplateColumns: `repeat(6, ${props.size}px)` }}>
        {ds.map((t, i) => (
          <div key={i} data-rl={`${props.seat}-${i}`} style={{ visibility: props.hide === i ? "hidden" : "visible" }}>
            <Tile t={t} size={props.size} mark={props.model.recent === props.seat && i === ds.length - 1 ? "recent" : undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Fly(props: { ev: Ev; fly: boolean; narrow: boolean; me: number; myMelds: Meld[] }) {
  const e = props.ev;
  const word = e.kind === "chi" ? "吃" : e.kind === "pon" ? "碰" : e.kind === "kan" ? "槓" : e.kind === "ankan" ? "暗槓" : e.kind === "added" ? "加槓" : e.kind === "ron" ? "胡" : e.kind === "tsumo" ? "自摸" : e.kind === "rob" ? "搶槓胡" : "";
  let tiles = Array.isArray(e.tiles) ? e.tiles : [];
  if (e.kind === "ankan" && e.p === props.me) {
    const mine = props.myMelds.find((m) => m.kind === "ankan");
    if (mine && Array.isArray(mine.tiles)) tiles = mine.tiles;
  }
  const size = e.kind === "discard" ? (props.narrow ? 44 : 56) : (props.narrow ? 30 : 40);
  return (
    <div className="fly" style={{
      left: props.fly ? "70%" : "50%",
      top: props.fly ? "78%" : "46%",
      transform: `translate(-50%, -50%) scale(${props.fly ? 0.45 : 1})`,
      opacity: props.fly ? 0.2 : 1,
      transition: "left 280ms ease, top 280ms ease, transform 280ms ease, opacity 280ms ease",
    }}>
      <b>{e.kind === "discard" ? `打出 ${tileName(e.tiles[0])}` : word}</b>
      <div className="row">
        {tiles.map((t, i) => <Tile key={i} t={t < 0 ? 0 : t} size={size} back={t < 0 || (e.kind === "ankan" && e.p !== props.me)} />)}
      </div>
    </div>
  );
}

export function ResultCard(props: { model: TableModel; settlement: Settlement; stake: { base: number; per: number } }) {
  const s = props.settlement;
  const names = props.model.names;
  return (
    <div className="banner">
      {(s.payments ?? []).length === 0 ? <div>流局。保留的 16 張不再摸，不計分。連莊最多 3 次。</div> : (
        <>
          <div>{(s.items ?? []).map((it) => `${it.name} ${it.tai}`).join("、") || "胡牌"}{s.handTai ? `，合計 ${s.handTai} 台` : ""}</div>
          <table>
            <thead><tr><th>付 → 收</th><th className="num">金額</th></tr></thead>
            <tbody>
              {(s.payments ?? []).map((p, i) => (
                <tr key={i}>
                  <td>{names[p.from]} → {names[p.to]}{p.dealerTai ? `（莊${p.dealerTai}）` : ""}{p.minTai ? "（最低 1 台）" : ""}</td>
                  <td className="num">{p.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted">底 {props.stake.base}／每台 {props.stake.per}。{(s.deltas ?? []).map((d, i) => (d ? `${names[i]} ${money(d)}` : "")).filter(Boolean).join("，")}</div>
        </>
      )}
    </div>
  );
}

export function modelFromLocal(g: Game, scores: number[], match: { wind: number; handNo: number; streak: number }): TableModel {
  const me = 0;
  const reveal = g.phase === "end";
  const prompt: Prompt | null = g.phase === "turn" && g.turn === me
    ? { kind: "turn", canTsumo: canTsumo(g, me), kans: kanOptions(g, me), drawn: g.drawn }
    : g.phase === "claim" && g.options
      ? { kind: "claim", tile: g.last?.tile ?? 0, from: g.last?.from ?? 0, options: g.options, deadline: 0 }
      : g.phase === "robkan" && g.wait.includes(me)
        ? { kind: "rob", tile: g.robTile, from: g.turn, deadline: 0 }
        : null;
  return {
    me,
    names: g.names,
    scores,
    dealer: g.dealer,
    streak: match.streak,
    wind: match.wind,
    handNo: match.handNo,
    wallLeft: Math.max(0, g.wall.length - 16),
    phase: g.phase,
    turn: g.turn,
    players: g.players.map((p, i) => ({
      handCount: p.hand.length,
      melds: p.melds.map((meld) => meld.kind === "ankan" && !reveal && i !== me ? { ...meld, tiles: [-1, -1, -1, -1] } : { ...meld, tiles: [...meld.tiles] }),
      discards: p.discards,
      revealed: reveal ? [...p.hand] : null,
    })),
    myHand: [...g.players[me].hand],
    myDrawn: g.turn === me ? g.drawn : null,
    myMelds: g.players[me].melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
    recent: g.recent,
    last: g.last,
    prompt,
    log: g.log,
    ev: g.ev.map((e) => e.kind === "ankan" && e.p !== me && !reveal ? { ...e, tiles: [-1, -1, -1, -1] } : e),
    reveal,
    bots: [false, true, true, true],
    connected: [true, true, true, true],
  };
}

export function winningText(hand: number[], melds: Meld[]): string {
  return `${decompText(toCounts(hand))}${melds.length ? "　＋副露 " + melds.map((m) => groupText(m.tiles.slice(0, 3))).join("　") : ""}`;
}
