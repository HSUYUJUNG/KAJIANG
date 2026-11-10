import { useEffect, useMemo, useState } from "react";
import {
  advanceMatch,
  cpuChooseDiscard,
  cpuStep,
  declareKan,
  discard,
  makeDiscardQuiz,
  makeWaitQuiz,
  mulberry,
  newGame,
  newMatch,
  ranking,
  resolveClaims,
  resolveRob,
  settle,
  shText,
  tileName,
  toCounts,
  tsumo,
  type DiscardEval,
  type Game,
  type Match,
  type Settlement,
} from "../logic/engine";
import { TableView, modelFromLocal, money, winningText, type Action } from "./TableView";
import { Tile } from "./Tile";

const RNG = mulberry((Date.now() ^ 0x9e3779b9) >>> 0);

function demoPosition(): { game: Game; match: Match } {
  const rng = mulberry(20261110);
  const match = newMatch("quan", rng, 0);
  let game = newGame(rng, 0, { humans: [0], names: ["你", "下家", "對家", "上家"] });
  let guard = 0;
  while (guard++ < 90 && game.phase !== "end") {
    const n = game.players.reduce((s, p) => s + p.discards.length, 0);
    if (game.phase === "turn" && game.turn === 0 && n >= 6) break;
    if (game.phase === "claim") { game = resolveClaims(game, { 0: { kind: "pass" } }); continue; }
    if (game.phase === "robkan") { game = resolveRob(game, { 0: false }); continue; }
    if (game.phase === "turn" && game.turn === 0) { game = discard(game, 0, cpuChooseDiscard(game, 0)); continue; }
    if (game.phase === "turn") { game = cpuStep(game); continue; }
    break;
  }
  return { game, match };
}

export function Practice(props: { onHome: () => void; demo?: boolean }) {
  const [mode, setMode] = useState<"discard" | "wait" | "play">(props.demo ? "play" : "discard");
  return (
    <div>
      <div className="top">
        <div>
          <h1>單機練習</h1>
          <p className="sub">出牌解析、猜聽牌，或跟三家電腦打</p>
        </div>
        <button className="btn quiet" onClick={props.onHome}>回首頁</button>
      </div>
      {!props.demo ? (
        <div className="tabs seg">
          <button aria-pressed={mode === "discard"} onClick={() => setMode("discard")}>出牌解析</button>
          <button aria-pressed={mode === "wait"} onClick={() => setMode("wait")}>猜聽牌</button>
          <button aria-pressed={mode === "play"} onClick={() => setMode("play")}>對戰電腦</button>
        </div>
      ) : null}
      {mode === "discard" ? <DiscardDrill /> : null}
      {mode === "wait" ? <WaitDrill /> : null}
      {mode === "play" ? <CpuMatch demo={!!props.demo} /> : null}
    </div>
  );
}

function DiscardDrill() {
  const [quiz, setQuiz] = useState(() => makeDiscardQuiz(RNG));
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState({ n: 0, top: 0 });
  const all = [...quiz.hand, quiz.drawn];
  const best = quiz.evals[0];
  const isTop = (e: DiscardEval) => e.shanten === best.shanten && e.uke.total === best.uke.total;
  const choose = (idx: number) => {
    if (pick !== null) return;
    setPick(idx);
    const e = quiz.evals.find((x) => x.tile === all[idx]);
    if (e) setScore((s) => ({ n: s.n + 1, top: s.top + (isTop(e) ? 1 : 0) }));
  };
  const picked = pick !== null ? quiz.evals.find((x) => x.tile === all[pick]) : null;
  const tops = quiz.evals.filter(isTop);
  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>摸進一張，打哪張？</b>
        <span className="muted">{score.n ? `${score.top}/${score.n} 進張最多` : ""}</span>
      </div>
      <div className="hand">
        {quiz.hand.map((t, i) => (
          <Tile key={i} t={t} size={32} onClick={() => choose(i)} mark={pick !== null && all[pick] === t ? (picked && isTop(picked) ? "good" : "bad") : undefined} />
        ))}
        <div className="drawn">
          <span className="muted">摸入</span>
          <Tile t={quiz.drawn} size={32} mark={pick === null ? "drawn" : all[pick] === quiz.drawn ? (picked && isTop(picked) ? "good" : "bad") : "drawn"} onClick={() => choose(quiz.hand.length)} />
        </div>
      </div>
      {picked ? (
        <div className="banner">
          <div>打{tileName(picked.tile)}：{shText(picked.shanten)}，進張 {picked.uke.tiles.length} 種 {picked.uke.total} 張</div>
          <p className="muted">{isTop(picked) ? (tops.length > 1 ? "這是並列進張最多的打法。" : "這手牌進張最多的打法。") : `進張最多是 ${tops.map((e) => "打" + tileName(e.tile)).join("、")}。`}</p>
          <p className="muted">只比較向聽與進張，不含防守或台數，所以不一定是實戰唯一正解。</p>
        </div>
      ) : <p className="muted">點一張要打的牌。</p>}
      <button className="btn" onClick={() => { setQuiz(makeDiscardQuiz(RNG)); setPick(null); }}>下一題</button>
    </section>
  );
}

function WaitDrill() {
  const [level, setLevel] = useState<"any" | "multi">("any");
  const [quiz, setQuiz] = useState(() => makeWaitQuiz(RNG, 1));
  const [picks, setPicks] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState({ n: 0, perfect: 0 });
  const counts = toCounts(quiz.hand);
  const next = (lv: "any" | "multi") => { setQuiz(makeWaitQuiz(RNG, lv === "multi" ? 3 : 1)); setPicks([]); setDone(false); };
  const miss = quiz.answers.filter((a) => !picks.includes(a));
  const wrong = picks.filter((a) => !quiz.answers.includes(a));
  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>這 16 張聽什麼？</b>
        <span className="muted">{score.n ? `全對 ${score.perfect}/${score.n}` : ""}</span>
      </div>
      <div className="seg">
        <button aria-pressed={level === "any"} onClick={() => { setLevel("any"); next("any"); }}>一般</button>
        <button aria-pressed={level === "multi"} onClick={() => { setLevel("multi"); next("multi"); }}>多面聽</button>
      </div>
      <div className="hand">{quiz.hand.map((t, i) => <Tile key={i} t={t} size={30} />)}</div>
      <p className="muted">選出所有能胡的牌。手上已有 4 張的不能再選。</p>
      {[0, 1, 2, 3].map((s) => (
        <div key={s} className="suit-row">
          {Array.from({ length: s < 3 ? 9 : 7 }, (_, k) => s * 9 + k).map((t) => {
            const on = picks.includes(t);
            const ans = quiz.answers.includes(t);
            const mark = done ? (on && ans ? "good" as const : ans ? "miss" as const : on ? "bad" as const : undefined) : undefined;
            return <Tile key={t} t={t} size={28} selected={!done && on} mark={mark} disabled={counts[t] >= 4} onClick={() => { if (!done) setPicks((ps) => ps.includes(t) ? ps.filter((x) => x !== t) : [...ps, t]); }} />;
          })}
        </div>
      ))}
      {done ? <div className="banner">答案：{quiz.answers.map(tileName).join("、")}。{miss.length === 0 && wrong.length === 0 ? "全部答對。" : [miss.length ? `漏了 ${miss.map(tileName).join("、")}` : "", wrong.length ? `${wrong.map(tileName).join("、")} 不能胡` : ""].filter(Boolean).join("；")}</div> : null}
      <div className="row">
        {!done ? <button className="btn primary" disabled={picks.length === 0} onClick={() => { setDone(true); const perfect = picks.length === quiz.answers.length && quiz.answers.every((a) => picks.includes(a)); setScore((s) => ({ n: s.n + 1, perfect: s.perfect + (perfect ? 1 : 0) })); }}>送出答案</button> : null}
        <button className="btn" onClick={() => next(level)}>下一題</button>
      </div>
    </section>
  );
}

function CpuMatch(props: { demo: boolean }) {
  const opened = useMemo(() => (props.demo ? demoPosition() : null), [props.demo]);
  const [len, setLen] = useState<"quan" | "jiang">("quan");
  const [stakeKey, setStakeKey] = useState("50/20");
  const [customBase, setCustomBase] = useState("50");
  const [customPer, setCustomPer] = useState("20");
  const [anim, setAnim] = useState<"normal" | "fast" | "off">(props.demo ? "off" : "normal");
  const [match, setMatch] = useState<Match | null>(opened?.match ?? null);
  const [game, setGame] = useState<Game | null>(opened?.game ?? null);
  const [settled, setSettled] = useState<Settlement | null>(null);
  const [stake, setStake] = useState({ base: 50, per: 20 });
  const chosen = stakeKey === "custom"
    ? (/^\d+$/.test(customBase) && /^\d+$/.test(customPer) && +customBase > 0 && +customPer > 0 ? { base: +customBase, per: +customPer } : null)
    : { base: +stakeKey.split("/")[0], per: +stakeKey.split("/")[1] };

  useEffect(() => {
    if (!game || game.phase === "end" || (game.phase === "turn" && game.turn === 0) || game.phase === "claim" || game.phase === "robkan") return;
    const id = window.setTimeout(() => setGame((g) => (g && g.phase === "turn" && g.turn !== 0 ? cpuStep(g) : g)), anim === "off" ? 220 : anim === "fast" ? 500 : 800);
    return () => window.clearTimeout(id);
  }, [game, anim]);
  useEffect(() => {
    if (game?.phase === "end" && game.result && match && !settled) setSettled(settle(game, match.streak, stake.base, stake.per));
  }, [game, match, settled, stake]);

  const start = () => {
    if (!chosen) return;
    setStake(chosen);
    const m = newMatch(len, RNG);
    setMatch(m);
    setSettled(null);
    setGame(newGame(RNG, m.dealer, { humans: [0], names: ["你", "下家", "對家", "上家"] }));
  };
  const onAction = (a: Action) => {
    if (!game) return;
    if (a.type === "discard") setGame(discard(game, 0, a.tile));
    else if (a.type === "tsumo") setGame(tsumo(game, 0));
    else if (a.type === "kan") setGame(declareKan(game, 0, { kind: a.kanKind, tile: a.tile }));
    else if (a.type === "claim") setGame(resolveClaims(game, { 0: a.kind === "chi" ? { kind: "chi", tiles: a.tiles ?? [] } : { kind: a.kind } }));
    else if (a.type === "rob") setGame(resolveRob(game, { 0: a.yes }));
  };
  const next = () => {
    if (!match || !game?.result || !settled) return;
    const m2 = advanceMatch(match, game.result, settled.deltas);
    setMatch(m2);
    setSettled(null);
    setGame(m2.over ? null : newGame(RNG, m2.dealer, { humans: [0], names: ["你", "下家", "對家", "上家"] }));
  };

  if (!match) {
    return (
      <section className="card stack">
        <p>跟三家電腦連續對局。南部台，底加台，胡牌最少 1 台。</p>
        <div className="seg">
          {["30/10", "50/20", "100/30", "custom"].map((k) => <button key={k} aria-pressed={stakeKey === k} onClick={() => setStakeKey(k)}>{k === "custom" ? "自訂" : k}</button>)}
        </div>
        {stakeKey === "custom" ? (
          <div className="row">
            <label className="field">底<input value={customBase} onChange={(e) => setCustomBase(e.target.value)} inputMode="numeric" /></label>
            <label className="field">每台<input value={customPer} onChange={(e) => setCustomPer(e.target.value)} inputMode="numeric" /></label>
          </div>
        ) : null}
        <div className="seg">
          <button aria-pressed={len === "quan"} onClick={() => setLen("quan")}>一圈</button>
          <button aria-pressed={len === "jiang"} onClick={() => setLen("jiang")}>一將</button>
        </div>
        <div className="seg">
          <button aria-pressed={anim === "normal"} onClick={() => setAnim("normal")}>動畫正常</button>
          <button aria-pressed={anim === "fast"} onClick={() => setAnim("fast")}>快速</button>
          <button aria-pressed={anim === "off"} onClick={() => setAnim("off")}>關閉</button>
        </div>
        <p className="muted">{chosen ? `1 台付 ${chosen.base + chosen.per}。${len === "quan" ? "一圈是四家各當過莊，連莊最多 3 次。" : "一將是東南西北四圈。"}` : "底和每台都要是正整數。"}</p>
        <button className="btn primary" disabled={!chosen} onClick={start}>開始</button>
      </section>
    );
  }
  if (match.over) {
    const order = ranking(match.scores);
    return (
      <section className="card stack">
        <h2>{match.len === "quan" ? "一圈" : "一將"}結束，共 {match.played} 局</h2>
        <table>
          <tbody>{order.map((p, i) => <tr key={p}><td>第 {i + 1}</td><td>{["你", "下家", "對家", "上家"][p]}</td><td className="num">{money(match.scores[p])}</td></tr>)}</tbody>
        </table>
        <div className="row">
          <button className="btn primary" onClick={start}>再來一場</button>
          <button className="btn" onClick={() => { setMatch(null); setGame(null); }}>重設</button>
        </div>
      </section>
    );
  }
  if (!game) return null;
  const scores = match.scores.map((s, i) => s + (settled?.deltas[i] || 0));
  const model = modelFromLocal(game, scores, match);
  return (
    <div>
      <TableView
        model={model}
        anim={anim}
        onAction={onAction}
        settlement={settled}
        stake={stake}
        header={<button className="btn quiet" onClick={() => { setMatch(null); setGame(null); setSettled(null); }}>結束</button>}
        footer={game.phase === "end" && settled ? (
          <div className="stack" style={{ marginTop: 8 }}>
            {game.result && game.result.kind !== "draw" ? <p className="muted">{winningText(game.players[game.result.winner].hand, game.players[game.result.winner].melds)}</p> : null}
            <button className="btn primary" onClick={next}>{advanceMatch(match, game.result!, settled.deltas).over ? "看總排名" : "下一局"}</button>
          </div>
        ) : null}
      />
    </div>
  );
}
