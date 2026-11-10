// 台灣十六張、無花。牌理從單機練習版移植，並改成可指定哪些座位是玩家（其餘為電腦）。

export type Rng = () => number;
export const NT = 34;
export const RESERVE = 16;
export const STREAK_CAP = 3;
export const CLAIM_MS = 9000;

export const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
export const SUITS = ["萬", "筒", "條"];
export const HONORS = ["東", "南", "西", "北", "中", "發", "白"];

export function suitOf(t: number): number {
  return t < 27 ? Math.floor(t / 9) : 3;
}
export function tileName(t: number): string {
  if (t < 0) return "牌";
  if (t < 27) return NUMS[t % 9] + SUITS[suitOf(t)];
  return HONORS[t - 27];
}
export function toCounts(tiles: number[]): number[] {
  const c = new Array<number>(NT).fill(0);
  for (const t of tiles) if (t >= 0 && t < NT) c[t]++;
  return c;
}
export function sortTiles(tiles: number[]): number[] {
  return [...tiles].sort((a, b) => a - b);
}
export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

export function allMelds(c: number[]): boolean {
  let i = 0;
  while (i < NT && c[i] === 0) i++;
  if (i === NT) return true;
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = allMelds(c);
    c[i] += 3;
    if (ok) return true;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--;
    c[i + 1]--;
    c[i + 2]--;
    const ok = allMelds(c);
    c[i]++;
    c[i + 1]++;
    c[i + 2]++;
    if (ok) return true;
  }
  return false;
}
export function isWin(counts: number[]): boolean {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total % 3 !== 2) return false;
  const c = [...counts];
  for (let i = 0; i < NT; i++) {
    if (c[i] >= 2) {
      c[i] -= 2;
      const ok = allMelds(c);
      c[i] += 2;
      if (ok) return true;
    }
  }
  return false;
}
export function decompose(counts: number[]): number[][] | null {
  const c = [...counts];
  const groups: number[][] = [];
  const rec = (): boolean => {
    let i = 0;
    while (i < NT && c[i] === 0) i++;
    if (i === NT) return true;
    if (c[i] >= 3) {
      c[i] -= 3;
      groups.push([i, i, i]);
      if (rec()) return true;
      groups.pop();
      c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      groups.push([i, i + 1, i + 2]);
      if (rec()) return true;
      groups.pop();
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
    return false;
  };
  for (let p = 0; p < NT; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      if (rec()) return [[p, p], ...groups];
      c[p] += 2;
    }
  }
  return null;
}
export function waits(counts: number[]): number[] {
  const res: number[] = [];
  for (let t = 0; t < NT; t++) {
    if (counts[t] >= 4) continue;
    counts[t]++;
    if (isWin(counts)) res.push(t);
    counts[t]--;
  }
  return res;
}

const shCache = new Map<string, number>();
export function shanten(counts: number[], need: number): number {
  const key = need + ":" + counts.join("");
  const hit = shCache.get(key);
  if (hit !== undefined) return hit;
  const c = [...counts];
  let best = 2 * need;
  const scan = (i: number, m: number, t: number, p: number): void => {
    while (i < NT && c[i] === 0) i++;
    if (i >= NT) {
      let mm = m, tt = t;
      if (mm > need) mm = need;
      if (mm + tt > need) tt = need - mm;
      const v = 2 * need - 2 * mm - tt - p;
      if (v < best) best = v;
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      scan(i, m + 1, t, p);
      c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      scan(i, m + 1, t, p);
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
    if (c[i] >= 2) {
      c[i] -= 2;
      if (p === 0) scan(i, m, t, 1);
      scan(i, m, t + 1, p);
      c[i] += 2;
    }
    if (i < 27 && i % 9 <= 7 && c[i + 1] > 0) {
      c[i]--;
      c[i + 1]--;
      scan(i, m, t + 1, p);
      c[i]++;
      c[i + 1]++;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 2] > 0) {
      c[i]--;
      c[i + 2]--;
      scan(i, m, t + 1, p);
      c[i]++;
      c[i + 2]++;
    }
    const save = c[i];
    c[i] = 0;
    scan(i + 1, m, t, p);
    c[i] = save;
  };
  scan(0, 0, 0, 0);
  if (isWin(counts) && counts.reduce((s, x) => s + x, 0) === 3 * need + 2) best = -1;
  if (shCache.size > 200000) shCache.clear();
  shCache.set(key, best);
  return best;
}
function relevant(counts: number[], t: number): boolean {
  if (counts[t] > 0) return true;
  if (t >= 27) return false;
  const r = t % 9;
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const r2 = r + d;
    if (r2 >= 0 && r2 <= 8 && counts[t + d] > 0) return true;
  }
  return false;
}
export interface Ukeire { tiles: number[]; total: number }
export function ukeire(counts: number[], need: number, visible: number[]): Ukeire {
  const base = shanten(counts, need);
  const tiles: number[] = [];
  let total = 0;
  for (let t = 0; t < NT; t++) {
    const left = 4 - visible[t];
    if (left <= 0) continue;
    if (!relevant(counts, t)) continue;
    counts[t]++;
    const s = shanten(counts, need);
    counts[t]--;
    if (s < base) {
      tiles.push(t);
      total += left;
    }
  }
  return { tiles, total };
}
export interface DiscardEval { tile: number; shanten: number; uke: Ukeire }
export function evalDiscards(hand: number[], need: number, visible: number[]): DiscardEval[] {
  const c = toCounts(hand);
  const out: DiscardEval[] = [];
  for (let t = 0; t < NT; t++) {
    if (c[t] === 0) continue;
    c[t]--;
    const s = shanten(c, need);
    out.push({ tile: t, shanten: s, uke: s <= 6 ? ukeire(c, need, visible) : { tiles: [], total: 0 } });
    c[t]++;
  }
  out.sort((a, b) => a.shanten - b.shanten || b.uke.total - a.uke.total || b.uke.tiles.length - a.uke.tiles.length || a.tile - b.tile);
  return out;
}

function pickSuitBias(rng: Rng): number[] {
  const main = Math.floor(rng() * 3);
  const w = [1, 1, 1, 0.5];
  w[main] = 2.2;
  return w;
}
function randomMeld(c: number[], rng: Rng, w: number[]): number[] | null {
  for (let tries = 0; tries < 50; tries++) {
    const tot = w[0] + w[1] + w[2] + w[3];
    let r = rng() * tot, s = 0;
    while (s < 3 && r >= w[s]) {
      r -= w[s];
      s++;
    }
    if (s === 3) {
      const t = 27 + Math.floor(rng() * 7);
      if (c[t] <= 1) return [t, t, t];
      continue;
    }
    const n = Math.floor(rng() * 9);
    if (rng() < 0.7 && n <= 6) {
      const t = s * 9 + n;
      if (c[t] < 4 && c[t + 1] < 4 && c[t + 2] < 4) return [t, t + 1, t + 2];
    } else {
      const t = s * 9 + n;
      if (c[t] <= 1) return [t, t, t];
    }
  }
  return null;
}
export function randomWinHand(rng: Rng): number[] {
  for (;;) {
    const c = new Array<number>(NT).fill(0);
    const w = pickSuitBias(rng);
    const tiles: number[] = [];
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const m = randomMeld(c, rng, w);
      if (!m) {
        ok = false;
        break;
      }
      for (const t of m) {
        c[t]++;
        tiles.push(t);
      }
    }
    if (!ok) continue;
    let pair = -1;
    for (let tries = 0; tries < 30; tries++) {
      const t = rng() < 0.85 ? Math.floor(rng() * 27) : 27 + Math.floor(rng() * 7);
      if (c[t] <= 2) {
        pair = t;
        break;
      }
    }
    if (pair < 0) continue;
    tiles.push(pair, pair);
    return sortTiles(tiles);
  }
}
export interface WaitQuiz { hand: number[]; answers: number[] }
export function makeWaitQuiz(rng: Rng, minWaits: number): WaitQuiz {
  for (;;) {
    const win = randomWinHand(rng);
    const idx = Math.floor(rng() * win.length);
    const hand = win.filter((_, i) => i !== idx);
    const ans = waits(toCounts(hand));
    if (ans.length >= minWaits) return { hand, answers: ans };
  }
}
export interface DiscardQuiz { hand: number[]; drawn: number; evals: DiscardEval[] }
export function makeDiscardQuiz(rng: Rng): DiscardQuiz {
  for (;;) {
    const win = randomWinHand(rng);
    const c = toCounts(win);
    const k = 1 + Math.floor(rng() * 3);
    const tiles = [...win];
    for (let j = 0; j < k; j++) {
      const idx = Math.floor(rng() * tiles.length);
      let nt = -1;
      for (let tries = 0; tries < 30; tries++) {
        const t = Math.floor(rng() * NT);
        if (c[t] < 4 && t !== tiles[idx]) {
          nt = t;
          break;
        }
      }
      if (nt < 0) continue;
      c[tiles[idx]]--;
      c[nt]++;
      tiles[idx] = nt;
    }
    if (isWin(c)) continue;
    const drawnIdx = Math.floor(rng() * tiles.length);
    const drawn = tiles[drawnIdx];
    const hand = sortTiles(tiles.filter((_, i) => i !== drawnIdx));
    const evals = evalDiscards(tiles, 5, c);
    if (evals[0].shanten > 3) continue;
    const top = evals[0];
    const distinct = evals.some((e) => e.shanten !== top.shanten || e.uke.total !== top.uke.total);
    if (!distinct) continue;
    return { hand, drawn, evals };
  }
}

export type MeldKind = "chi" | "pon" | "kan" | "ankan";
export interface Meld { kind: MeldKind; tiles: number[]; from: number }
export interface Player { hand: number[]; melds: Meld[]; discards: number[] }
export type Phase = "turn" | "claim" | "robkan" | "end";
export interface HumanOptions { ron: boolean; pon: boolean; kan: boolean; chi: number[][] }
export interface Result { kind: "ron" | "tsumo" | "rob" | "draw"; winner: number; from: number; tile: number }
export interface Ev {
  n: number;
  kind: "discard" | "chi" | "pon" | "kan" | "ankan" | "added" | "ron" | "tsumo" | "rob";
  p: number;
  tiles: number[];
  taken: number;
  from: number;
  idx: number;
}
export interface Game {
  wall: number[];
  players: Player[];
  dealer: number;
  turn: number;
  phase: Phase;
  drawn: number | null;
  justClaimed: boolean;
  last: { tile: number; from: number } | null;
  options: HumanOptions | null;
  optionsBySeat: (HumanOptions | null)[] | null;
  wait: number[];
  robTile: number;
  log: string[];
  result: Result | null;
  steps: number;
  recent: number;
  kanDraw: boolean;
  calls: number;
  draws: number[];
  discardCount: number;
  ev: Ev[];
  evSeq: number;
  humans: number[];
  auto: number[];
  names: string[];
}
export type ClaimChoice =
  | { kind: "pass" }
  | { kind: "ron" }
  | { kind: "pon" }
  | { kind: "kan" }
  | { kind: "chi"; tiles: number[] };
export interface KanOpt { kind: "ankan" | "added"; tile: number }

export function controlled(g: Game, p: number): boolean {
  return g.humans.includes(p) && !g.auto.includes(p);
}
function nm(g: Game, p: number): string {
  return g.names[p] || `座位${p + 1}`;
}
function addEv(g: Game, e: Omit<Ev, "n">): void {
  g.evSeq++;
  g.ev.push({ ...e, n: g.evSeq });
  if (g.ev.length > 16) g.ev.shift();
}
export function needOf(p: Player): number {
  return 5 - p.melds.length;
}
export function cloneGame(g: Game): Game {
  return {
    ...g,
    wall: [...g.wall],
    players: g.players.map((p) => ({
      hand: [...p.hand],
      melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
      discards: [...p.discards],
    })),
    log: [...g.log],
    draws: [...g.draws],
    ev: g.ev.map((e) => ({ ...e, tiles: [...e.tiles] })),
    last: g.last ? { ...g.last } : null,
    options: g.options ? { ...g.options, chi: g.options.chi.map((x) => [...x]) } : null,
    optionsBySeat: g.optionsBySeat
      ? g.optionsBySeat.map((o) => (o ? { ...o, chi: o.chi.map((x) => [...x]) } : null))
      : null,
    wait: [...g.wait],
    result: g.result ? { ...g.result } : null,
    humans: [...g.humans],
    auto: [...g.auto],
    names: [...g.names],
  };
}
function removeTiles(hand: number[], tiles: number[]): void {
  for (const t of tiles) {
    const i = hand.indexOf(t);
    if (i < 0) throw new Error("remove missing tile " + t);
    hand.splice(i, 1);
  }
}
function addLog(g: Game, s: string): void {
  g.log.push(s);
  if (g.log.length > 60) g.log.shift();
}

const PRACTICE_NAMES = ["你", "下家", "對家", "上家"];

export function newGame(rng: Rng, dealerSeat?: number, opts?: { humans?: number[]; names?: string[]; auto?: number[] }): Game {
  const all: number[] = [];
  for (let t = 0; t < NT; t++) for (let k = 0; k < 4; k++) all.push(t);
  const wall = shuffle(all, rng);
  const dealer = dealerSeat ?? Math.floor(rng() * 4);
  const players: Player[] = [0, 1, 2, 3].map(() => ({ hand: [] as number[], melds: [] as Meld[], discards: [] as number[] }));
  for (let r = 0; r < 16; r++) for (let p = 0; p < 4; p++) players[(dealer + p) % 4].hand.push(wall.shift() as number);
  const g: Game = {
    wall, players, dealer, turn: dealer, phase: "turn", drawn: null, justClaimed: false, last: null,
    options: null, optionsBySeat: null, wait: [], robTile: -1, log: [], result: null, steps: 0, recent: -1,
    kanDraw: false, calls: 0, draws: [0, 0, 0, 0], discardCount: 0, ev: [], evSeq: 0,
    humans: opts?.humans ? [...opts.humans] : [0],
    auto: opts?.auto ? [...opts.auto] : [],
    names: opts?.names ? [...opts.names] : [...PRACTICE_NAMES],
  };
  for (const p of players) p.hand = sortTiles(p.hand);
  addLog(g, `新局開始，${nm(g, dealer)}當莊。`);
  drawTile(g, dealer, false);
  return g;
}

/** 測試用：直接擺好手牌與牌牆。牌牆由前到後，補牌從尾端取。 */
export function makeGame(partial: {
  hands: number[][];
  wall?: number[];
  dealer?: number;
  turn?: number;
  humans?: number[];
  names?: string[];
  melds?: Meld[][];
  discards?: number[][];
  calls?: number;
  discardCount?: number;
  draws?: number[];
}): Game {
  const players: Player[] = [0, 1, 2, 3].map((i) => ({
    hand: sortTiles(partial.hands[i] ?? []),
    melds: (partial.melds?.[i] ?? []).map((m) => ({ ...m, tiles: [...m.tiles] })),
    discards: [...(partial.discards?.[i] ?? [])],
  }));
  const dealer = partial.dealer ?? 0;
  const g: Game = {
    wall: [...(partial.wall ?? new Array(40).fill(0))],
    players, dealer, turn: partial.turn ?? dealer, phase: "turn", drawn: null, justClaimed: false, last: null,
    options: null, optionsBySeat: null, wait: [], robTile: -1, log: [], result: null, steps: 0, recent: -1,
    kanDraw: false, calls: partial.calls ?? 0, draws: partial.draws ? [...partial.draws] : [1, 0, 0, 0],
    discardCount: partial.discardCount ?? 1, ev: [], evSeq: 0,
    humans: partial.humans ? [...partial.humans] : [],
    auto: [],
    names: partial.names ? [...partial.names] : ["甲", "乙", "丙", "丁"],
  };
  return g;
}

export function drawTile(g: Game, p: number, replacement: boolean): void {
  if (g.wall.length <= RESERVE) {
    g.phase = "end";
    g.result = { kind: "draw", winner: -1, from: -1, tile: -1 };
    g.wait = [];
    g.options = null;
    g.optionsBySeat = null;
    addLog(g, "牌牆只剩保留的 16 張，流局。");
    return;
  }
  const t = replacement ? (g.wall.pop() as number) : (g.wall.shift() as number);
  const pl = g.players[p];
  pl.hand = sortTiles([...pl.hand, t]);
  g.turn = p;
  g.drawn = t;
  g.draws[p]++;
  g.kanDraw = replacement;
  g.phase = "turn";
  g.justClaimed = false;
  g.last = null;
  g.options = null;
  g.optionsBySeat = null;
  g.wait = [];
  if (replacement) addLog(g, `${nm(g, p)}槓後補牌。`);
}
export function canTsumo(g: Game, p: number): boolean {
  return g.phase === "turn" && g.turn === p && !g.justClaimed && isWin(toCounts(g.players[p].hand));
}
export function kanOptions(g: Game, p: number): KanOpt[] {
  if (g.phase !== "turn" || g.turn !== p || g.justClaimed) return [];
  if (g.wall.length <= RESERVE) return [];
  const pl = g.players[p];
  const c = toCounts(pl.hand);
  const res: KanOpt[] = [];
  for (let t = 0; t < NT; t++) if (c[t] === 4) res.push({ kind: "ankan", tile: t });
  for (const m of pl.melds) if (m.kind === "pon" && c[m.tiles[0]] >= 1) res.push({ kind: "added", tile: m.tiles[0] });
  return res;
}
export function canRonWith(pl: Player, t: number): boolean {
  const c = toCounts(pl.hand);
  c[t]++;
  return isWin(c);
}
export function chiOptionsFor(pl: Player, t: number): number[][] {
  if (t >= 27) return [];
  const c = toCounts(pl.hand);
  const r = t % 9;
  const res: number[][] = [];
  if (r >= 2 && c[t - 2] > 0 && c[t - 1] > 0) res.push([t - 2, t - 1, t]);
  if (r >= 1 && r <= 7 && c[t - 1] > 0 && c[t + 1] > 0) res.push([t - 1, t, t + 1]);
  if (r <= 6 && c[t + 1] > 0 && c[t + 2] > 0) res.push([t, t + 1, t + 2]);
  return res;
}
export function optionsFor(g: Game, p: number, t: number, from: number): HumanOptions {
  const pl = g.players[p];
  const cnt = pl.hand.filter((x) => x === t).length;
  const wallOk = g.wall.length > RESERVE;
  return {
    ron: canRonWith(pl, t),
    pon: cnt >= 2,
    kan: cnt >= 3 && wallOk,
    chi: (from + 1) % 4 === p ? chiOptionsFor(pl, t) : [],
  };
}
export function hasAny(o: HumanOptions | null | undefined): boolean {
  return !!o && (o.ron || o.pon || o.kan || o.chi.length > 0);
}
export function sameChi(a: number[], b: number[]): boolean {
  return a.join() === b.join();
}

function orderFrom(from: number): number[] {
  return [1, 2, 3].map((k) => (from + k) % 4);
}

/** 哪些還在線的玩家必須回答。電腦若已形成更高優先的叫牌，就不空等。 */
export function claimWaiters(g: Game, tile: number, from: number): { wait: number[]; optionsBySeat: (HumanOptions | null)[] } {
  const optionsBySeat: (HumanOptions | null)[] = [null, null, null, null];
  const order = orderFrom(from);
  for (const p of order) optionsBySeat[p] = optionsFor(g, p, tile, from);
  const pre = new Map<number, ClaimChoice>();
  const pending = new Set<number>();
  for (const p of order) {
    const o = optionsBySeat[p] as HumanOptions;
    if (!controlled(g, p)) pre.set(p, cpuClaim(g, p, tile, from));
    else if (!hasAny(o)) pre.set(p, { kind: "pass" });
    else pending.add(p);
  }
  const wait = new Set<number>();
  let ronLock: number | null = null;
  for (const p of order) {
    if (pre.get(p)?.kind === "ron") {
      ronLock = p;
      break;
    }
    if (pending.has(p) && optionsBySeat[p]?.ron) wait.add(p);
  }
  if (ronLock !== null) {
    for (const p of [...wait]) if (order.indexOf(p) > order.indexOf(ronLock)) wait.delete(p);
  }
  if (ronLock !== null || [...wait].some((p) => optionsBySeat[p]?.ron)) return { wait: [...wait], optionsBySeat };

  let pkLock: number | null = null;
  for (const p of order) {
    const k = pre.get(p)?.kind;
    if (k === "pon" || k === "kan") {
      pkLock = p;
      break;
    }
    if (pending.has(p) && (optionsBySeat[p]?.pon || optionsBySeat[p]?.kan)) wait.add(p);
  }
  if (pkLock !== null) {
    for (const p of [...wait]) if (order.indexOf(p) > order.indexOf(pkLock)) wait.delete(p);
  }
  if (pkLock !== null || wait.size > 0) return { wait: [...wait], optionsBySeat };

  const chiP = (from + 1) % 4;
  if (pending.has(chiP) && (optionsBySeat[chiP]?.chi.length ?? 0) > 0) wait.add(chiP);
  return { wait: [...wait], optionsBySeat };
}

export function discard(g0: Game, p: number, t: number): Game {
  const g = cloneGame(g0);
  if (g.phase !== "turn" || g.turn !== p) throw new Error("not your turn");
  if (!g.players[p].hand.includes(t)) throw new Error("tile not in hand");
  removeTiles(g.players[p].hand, [t]);
  g.players[p].discards.push(t);
  addEv(g, { kind: "discard", p, tiles: [t], taken: t, from: p, idx: g.players[p].discards.length - 1 });
  g.last = { tile: t, from: p };
  g.recent = p;
  g.discardCount++;
  g.kanDraw = false;
  g.drawn = null;
  g.justClaimed = false;
  g.steps++;
  addLog(g, `${nm(g, p)}打出 ${tileName(t)}。`);
  const plan = claimWaiters(g, t, p);
  g.optionsBySeat = plan.optionsBySeat;
  if (plan.wait.length) {
    g.phase = "claim";
    g.wait = plan.wait;
    const only = g.humans.length === 1 ? plan.optionsBySeat[g.humans[0]] : null;
    g.options = only && plan.wait.includes(g.humans[0]) ? only : null;
    return g;
  }
  g.wait = [];
  return resolveClaims(g, {});
}

export function cpuWantsCall(pl: Player, removeFromHand: number[]): boolean {
  const before = shanten(toCounts(pl.hand), needOf(pl));
  const c = toCounts(pl.hand);
  for (const x of removeFromHand) c[x]--;
  let best = 99;
  const need = needOf(pl) - 1;
  for (let d = 0; d < NT; d++) {
    if (c[d] === 0) continue;
    c[d]--;
    const s = shanten(c, need);
    if (s < best) best = s;
    c[d]++;
  }
  return best < before && best <= 2;
}
export function cpuClaim(g: Game, p: number, t: number, from: number): ClaimChoice {
  const pl = g.players[p];
  const o = optionsFor(g, p, t, from);
  if (o.ron) return { kind: "ron" };
  if (o.kan) {
    const c = toCounts(pl.hand);
    const before = shanten(c, needOf(pl));
    c[t] -= 3;
    if (shanten(c, needOf(pl) - 1) <= before) return { kind: "kan" };
  }
  if (o.pon && cpuWantsCall(pl, [t, t])) return { kind: "pon" };
  for (const ch of o.chi) {
    const rest = [...ch];
    rest.splice(rest.indexOf(t), 1);
    if (cpuWantsCall(pl, rest)) return { kind: "chi", tiles: ch };
  }
  return { kind: "pass" };
}
export function legalChoice(o: HumanOptions, ch: ClaimChoice, tile: number): boolean {
  if (ch.kind === "pass") return true;
  if (ch.kind === "ron") return o.ron;
  if (ch.kind === "pon") return o.pon;
  if (ch.kind === "kan") return o.kan;
  return o.chi.some((c) => sameChi(c, ch.tiles) && ch.tiles.includes(tile));
}
export function resolveClaims(g0: Game, human: Record<number, ClaimChoice>): Game {
  const g = g0.phase === "claim" ? cloneGame(g0) : g0;
  const last = g.last;
  if (!last) throw new Error("no discard");
  const { tile: t, from } = last;
  const choices: (ClaimChoice | null)[] = [null, null, null, null];
  for (let k = 1; k <= 3; k++) {
    const p = (from + k) % 4;
    if (controlled(g, p)) {
      const o = (g.optionsBySeat && g.optionsBySeat[p]) || optionsFor(g, p, t, from);
      const ch = human[p] ?? { kind: "pass" };
      if (!legalChoice(o, ch, t)) throw new Error("illegal claim");
      choices[p] = ch;
    } else choices[p] = cpuClaim(g, p, t, from);
  }
  g.options = null;
  g.optionsBySeat = null;
  g.wait = [];
  const order = orderFrom(from);
  const ronP = order.find((p) => choices[p]?.kind === "ron");
  const takeFromRiver = (): void => {
    g.players[from].discards.pop();
    g.recent = -1;
    g.calls++;
  };
  if (ronP !== undefined) {
    g.players[ronP].hand = sortTiles([...g.players[ronP].hand, t]);
    takeFromRiver();
    g.phase = "end";
    g.result = { kind: "ron", winner: ronP, from, tile: t };
    addEv(g, { kind: "ron", p: ronP, tiles: [t], taken: t, from, idx: -1 });
    addLog(g, `${nm(g, ronP)}胡牌！${nm(g, from)}放槍 ${tileName(t)}。`);
    return g;
  }
  const pkP = order.find((p) => choices[p]?.kind === "pon" || choices[p]?.kind === "kan");
  if (pkP !== undefined) {
    const ch = choices[pkP] as ClaimChoice;
    const pl = g.players[pkP];
    takeFromRiver();
    g.steps++;
    if (ch.kind === "kan") {
      removeTiles(pl.hand, [t, t, t]);
      pl.melds.push({ kind: "kan", tiles: [t, t, t, t], from });
      addEv(g, { kind: "kan", p: pkP, tiles: [t, t, t, t], taken: t, from, idx: pl.melds.length - 1 });
      addLog(g, `${nm(g, pkP)}明槓 ${tileName(t)}。`);
      drawTile(g, pkP, true);
      return g;
    }
    removeTiles(pl.hand, [t, t]);
    pl.melds.push({ kind: "pon", tiles: [t, t, t], from });
    addEv(g, { kind: "pon", p: pkP, tiles: [t, t, t], taken: t, from, idx: pl.melds.length - 1 });
    addLog(g, `${nm(g, pkP)}碰 ${tileName(t)}。`);
    g.turn = pkP;
    g.phase = "turn";
    g.justClaimed = true;
    g.drawn = null;
    g.last = null;
    return g;
  }
  const chiP = (from + 1) % 4;
  const cc = choices[chiP];
  if (cc && cc.kind === "chi") {
    const pl = g.players[chiP];
    const rest = [...cc.tiles];
    rest.splice(rest.indexOf(t), 1);
    removeTiles(pl.hand, rest);
    takeFromRiver();
    pl.melds.push({ kind: "chi", tiles: [...cc.tiles], from });
    addEv(g, { kind: "chi", p: chiP, tiles: [...cc.tiles], taken: t, from, idx: pl.melds.length - 1 });
    addLog(g, `${nm(g, chiP)}吃 ${cc.tiles.map(tileName).join("")}。`);
    g.turn = chiP;
    g.phase = "turn";
    g.justClaimed = true;
    g.drawn = null;
    g.last = null;
    g.steps++;
    return g;
  }
  drawTile(g, (from + 1) % 4, false);
  return g;
}
export function tsumo(g0: Game, p: number): Game {
  if (!canTsumo(g0, p)) throw new Error("cannot tsumo");
  const g = cloneGame(g0);
  g.phase = "end";
  g.wait = [];
  g.result = { kind: "tsumo", winner: p, from: -1, tile: g.drawn ?? -1 };
  addEv(g, { kind: "tsumo", p, tiles: [g.drawn ?? -1], taken: -1, from: -1, idx: -1 });
  addLog(g, `${nm(g, p)}自摸胡牌！`);
  return g;
}
export function declareKan(g0: Game, p: number, opt: KanOpt): Game {
  if (!kanOptions(g0, p).some((k) => k.kind === opt.kind && k.tile === opt.tile)) throw new Error("illegal kan");
  const g = cloneGame(g0);
  const pl = g.players[p];
  const t = opt.tile;
  g.steps++;
  g.calls++;
  if (opt.kind === "ankan") {
    removeTiles(pl.hand, [t, t, t, t]);
    pl.melds.push({ kind: "ankan", tiles: [t, t, t, t], from: p });
    addEv(g, { kind: "ankan", p, tiles: [t, t, t, t], taken: -1, from: p, idx: pl.melds.length - 1 });
    addLog(g, `${nm(g, p)}暗槓。`);
    drawTile(g, p, true);
    return g;
  }
  removeTiles(pl.hand, [t]);
  const m = pl.melds.find((x) => x.kind === "pon" && x.tiles[0] === t) as Meld;
  m.kind = "kan";
  m.tiles = [t, t, t, t];
  addEv(g, { kind: "added", p, tiles: [t, t, t, t], taken: t, from: p, idx: pl.melds.indexOf(m) });
  addLog(g, `${nm(g, p)}加槓 ${tileName(t)}。`);
  g.robTile = t;
  g.turn = p;
  g.drawn = null;
  const order = orderFrom(p);
  let botLocked = false;
  const wait: number[] = [];
  for (const q of order) {
    if (!canRonWith(g.players[q], t)) continue;
    if (!controlled(g, q)) {
      botLocked = true;
      break;
    }
    wait.push(q);
    break;
  }
  // 上一段只找到第一個能搶的人。若是玩家，還要把他後面、在任何電腦之前的玩家一起詢問（前面的人可能按過）。
  if (!botLocked && wait.length) {
    const start = order.indexOf(wait[0]);
    for (let i = start + 1; i < order.length; i++) {
      const q = order[i];
      if (!canRonWith(g.players[q], t)) continue;
      if (!controlled(g, q)) break;
      wait.push(q);
    }
  }
  if (!botLocked && wait.length) {
    g.phase = "robkan";
    g.wait = wait;
    return g;
  }
  return resolveRob(g, {});
}
export function resolveRob(g0: Game, humanRob: Record<number, boolean>): Game {
  const g = g0.phase === "robkan" ? cloneGame(g0) : g0;
  const p = g.turn, t = g.robTile;
  for (const q of g.wait) {
    if (humanRob[q] && !canRonWith(g.players[q], t)) throw new Error("illegal rob");
  }
  const order = orderFrom(p);
  const robber = order.find((q) => {
    if (!canRonWith(g.players[q], t)) return false;
    if (controlled(g, q)) return humanRob[q] === true;
    return true;
  });
  g.wait = [];
  if (robber !== undefined) {
    const m = g.players[p].melds.find((x) => (x.kind === "kan" || x.kind === "pon") && x.tiles[0] === t) as Meld;
    m.kind = "pon";
    m.tiles = [t, t, t];
    g.players[robber].hand = sortTiles([...g.players[robber].hand, t]);
    g.phase = "end";
    g.result = { kind: "rob", winner: robber, from: p, tile: t };
    addEv(g, { kind: "rob", p: robber, tiles: [t], taken: t, from: p, idx: -1 });
    addLog(g, `${nm(g, robber)}搶槓胡 ${tileName(t)}！`);
    return g;
  }
  g.robTile = -1;
  drawTile(g, p, true);
  return g;
}
export function visibleFor(g: Game, p: number): number[] {
  const v = toCounts(g.players[p].hand);
  g.players.forEach((pl, i) => {
    for (const t of pl.discards) v[t]++;
    for (const m of pl.melds) if (m.kind !== "ankan" || i === p) for (const t of m.tiles) if (t >= 0) v[t]++;
  });
  return v;
}
function isolationScore(c: number[], t: number): number {
  if (t >= 27) return c[t] === 1 ? 3 : 0;
  const r = t % 9;
  let near = 0;
  for (let d = -2; d <= 2; d++) if (d !== 0 && r + d >= 0 && r + d <= 8) near += c[t + d];
  return (near === 0 ? 2 : 0) + (r === 0 || r === 8 ? 1 : 0);
}
export function cpuChooseDiscard(g: Game, p: number): number {
  const pl = g.players[p];
  const need = needOf(pl);
  const c = toCounts(pl.hand);
  const vis = visibleFor(g, p);
  let bestS = 99;
  const cand: number[] = [];
  for (let t = 0; t < NT; t++) {
    if (c[t] === 0) continue;
    c[t]--;
    const s = shanten(c, need);
    c[t]++;
    if (s < bestS) {
      bestS = s;
      cand.length = 0;
      cand.push(t);
    } else if (s === bestS) cand.push(t);
  }
  let best = cand[0], bestU = -1, bestI = -1;
  for (const t of cand) {
    c[t]--;
    const u = ukeire(c, need, vis).total;
    c[t]++;
    const iso = isolationScore(c, t);
    if (u > bestU || (u === bestU && iso > bestI)) {
      best = t;
      bestU = u;
      bestI = iso;
    }
  }
  return best;
}
export function cpuStep(g: Game): Game {
  const p = g.turn;
  if (g.phase !== "turn") throw new Error("cpuStep wrong phase");
  if (canTsumo(g, p)) return tsumo(g, p);
  const pl = g.players[p];
  for (const k of kanOptions(g, p)) {
    const c = toCounts(pl.hand);
    const before = shanten(c, needOf(pl));
    if (k.kind === "ankan") c[k.tile] -= 4;
    else c[k.tile] -= 1;
    const after = shanten(c, k.kind === "ankan" ? needOf(pl) - 1 : needOf(pl));
    if (after <= before) return declareKan(g, p, k);
  }
  return discard(g, p, cpuChooseDiscard(g, p));
}
export function botAct(g: Game): Game | null {
  if (g.phase === "end") return null;
  if (g.phase === "claim") return resolveClaims(g, {});
  if (g.phase === "robkan") return resolveRob(g, {});
  if (g.phase === "turn" && !controlled(g, g.turn)) return cpuStep(g);
  return null;
}

export type MatchLen = "quan" | "jiang";
export interface Match {
  len: MatchLen;
  startDealer: number;
  wind: number;
  handNo: number;
  dealer: number;
  streak: number;
  scores: number[];
  played: number;
  over: boolean;
}
export function newMatch(len: MatchLen, rng: Rng, dealer?: number): Match {
  const d = dealer ?? Math.floor(rng() * 4);
  return { len, startDealer: d, wind: 0, handNo: 0, dealer: d, streak: 0, scores: [0, 0, 0, 0], played: 0, over: false };
}
export function advanceMatch(m: Match, r: Result, d: number[]): Match {
  const scores = m.scores.map((x, i) => x + d[i]);
  const played = m.played + 1;
  const stays = (r.kind === "draw" || r.winner === m.dealer) && m.streak < STREAK_CAP;
  if (stays) return { ...m, scores, played, streak: m.streak + 1 };
  let handNo = m.handNo + 1, wind = m.wind;
  if (handNo === 4) {
    handNo = 0;
    wind++;
  }
  const over = wind >= (m.len === "quan" ? 1 : 4);
  return { ...m, scores, played, dealer: (m.dealer + 1) % 4, streak: 0, handNo, wind: over ? m.wind : wind, over };
}
export function seatWind(p: number, dealer: number): number {
  return (p - dealer + 4) % 4;
}
export function ranking(scores: number[]): number[] {
  return [0, 1, 2, 3].sort((a, b) => scores[b] - scores[a] || a - b);
}

export interface TaiItem { name: string; tai: number }
export interface Payment { from: number; to: number; tai: number; dealerTai: number; amount: number; minTai: boolean }
export interface Settlement { items: TaiItem[]; handTai: number; payments: Payment[]; deltas: number[] }
interface Grp { seq: boolean; t: number; concealed: boolean }
export function allDecomps(counts: number[]): { pair: number; groups: Grp[] }[] {
  const out: { pair: number; groups: Grp[] }[] = [];
  const c = [...counts];
  const cur: Grp[] = [];
  let pair = -1;
  const rec = (): void => {
    let i = 0;
    while (i < NT && c[i] === 0) i++;
    if (i === NT) {
      out.push({ pair, groups: cur.map((x) => ({ ...x })) });
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      cur.push({ seq: false, t: i, concealed: true });
      rec();
      cur.pop();
      c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      cur.push({ seq: true, t: i, concealed: true });
      rec();
      cur.pop();
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
  };
  for (let p = 0; p < NT; p++) if (c[p] >= 2) {
    c[p] -= 2;
    pair = p;
    rec();
    c[p] += 2;
  }
  return out;
}
export interface WinCtx {
  hand: number[];
  melds: Meld[];
  winTile: number;
  tsumo: boolean;
  rob: boolean;
  kanDraw: boolean;
  haitei: boolean;
  heaven: boolean;
  earth: boolean;
  human: boolean;
}
export function winContext(g: Game): WinCtx {
  const r = g.result as Result;
  const w = r.winner;
  const pl = g.players[w];
  const tsumo = r.kind === "tsumo";
  const noCalls = g.calls === 0;
  return {
    hand: pl.hand, melds: pl.melds, winTile: r.tile, tsumo, rob: r.kind === "rob",
    kanDraw: tsumo && g.kanDraw, haitei: tsumo && g.wall.length === RESERVE,
    heaven: tsumo && w === g.dealer && g.discardCount === 0 && noCalls,
    earth: tsumo && w !== g.dealer && noCalls && g.draws[w] === 1 && pl.discards.length === 0,
    human: r.kind === "ron" && w !== g.dealer && r.from === g.dealer && g.discardCount === 1 && g.calls === 1,
  };
}
export function countTai(x: WinCtx): TaiItem[] {
  const counts = toCounts(x.hand);
  const open = x.melds.filter((m) => m.kind !== "ankan").length;
  const meldGroups: Grp[] = x.melds.map((m) => ({ seq: m.kind === "chi", t: Math.min(...m.tiles.filter((t) => t >= 0)), concealed: m.kind === "ankan" }));
  const allTiles = [...x.hand, ...x.melds.flatMap((m) => m.tiles.filter((t) => t >= 0))];
  const suits = new Set(allTiles.filter((t) => t < 27).map((t) => suitOf(t)));
  const hasHonor = allTiles.some((t) => t >= 27);
  const before = [...counts];
  before[x.winTile]--;
  const dutinRaw = waits(before).length === 1;
  const special = x.heaven || x.earth || x.human;
  const base: TaiItem[] = [];
  if (x.heaven) base.push({ name: "天胡", tai: 24 });
  if (x.earth) base.push({ name: "地胡", tai: 16 });
  if (x.human) base.push({ name: "人胡", tai: 16 });
  if (!special) {
    if (open === 0 && x.tsumo) base.push({ name: "門清自摸", tai: 3 });
    else {
      if (open === 0) base.push({ name: "門清", tai: 1 });
      if (x.tsumo) base.push({ name: "自摸", tai: 1 });
    }
  }
  if (open === 5 && !x.tsumo) base.push({ name: "全求人", tai: 2 });
  if (open === 5 && x.tsumo) base.push({ name: "半求人", tai: 1 });
  const dutin = !special && dutinRaw && open < 5;
  if (dutin) base.push({ name: "獨聽", tai: 1 });
  if (x.rob) base.push({ name: "搶槓", tai: 1 });
  if (x.kanDraw && !special) base.push({ name: "槓上開花", tai: 1 });
  if (x.haitei && !special) base.push({ name: "海底撈月", tai: 1 });
  const allHonor = suits.size === 0;
  if (allHonor) base.push({ name: "字一色", tai: 16 });
  else if (suits.size === 1 && !hasHonor) base.push({ name: "清一色", tai: 8 });
  else if (suits.size === 1 && hasHonor) base.push({ name: "湊一色", tai: 4 });
  let best: TaiItem[] | null = null, bestSum = -1;
  for (const d of allDecomps(counts)) {
    const idxs = d.groups.map((_, i) => i).filter((i) => {
      const grp = d.groups[i];
      return grp.seq ? x.winTile >= grp.t && x.winTile <= grp.t + 2 : grp.t === x.winTile;
    });
    const places: number[] = d.pair === x.winTile ? [-1, ...idxs] : idxs;
    for (const pl of places) {
      const gs = d.groups.map((grp, i) => ({ ...grp, concealed: grp.seq ? true : !(i === pl && !x.tsumo) }));
      const all = [...meldGroups, ...gs];
      const items = [...base];
      const tri = all.filter((grp) => !grp.seq);
      const dragons = tri.filter((grp) => grp.t >= 31).length;
      const winds = tri.filter((grp) => grp.t >= 27 && grp.t <= 30).length;
      const big3 = dragons === 3, small3 = dragons === 2 && d.pair >= 31;
      const big4 = winds === 4, small4 = winds === 3 && d.pair >= 27 && d.pair <= 30;
      if (big3) items.push({ name: "大三元", tai: 8 });
      if (small3) items.push({ name: "小三元", tai: 4 });
      if (big4) items.push({ name: "大四喜", tai: 16 });
      if (small4) items.push({ name: "小四喜", tai: 8 });
      if (!allHonor) {
        for (const grp of tri) {
          if (grp.t < 27) continue;
          if (grp.t >= 31 && (big3 || small3)) continue;
          if (grp.t <= 30 && big4) continue;
          items.push({ name: "字牌刻 " + tileName(grp.t), tai: 1 });
        }
      }
      const an = tri.filter((grp) => grp.concealed).length;
      if (an >= 5) items.push({ name: "五暗刻", tai: 8 });
      else if (an === 4) items.push({ name: "四暗刻", tai: 5 });
      else if (an === 3) items.push({ name: "三暗刻", tai: 2 });
      if (tri.length === 5 && an < 5 && !allHonor) items.push({ name: "碰碰胡", tai: 4 });
      if (!special && all.every((grp) => grp.seq) && !hasHonor && !x.tsumo && !dutin && pl >= 0) {
        const grp = gs[pl];
        const r = grp.t % 9;
        const ryanmen = (x.winTile === grp.t && r <= 5) || (x.winTile === grp.t + 2 && r >= 1);
        if (ryanmen) items.push({ name: "平胡", tai: 2 });
      }
      const sum = items.reduce((a, b) => a + b.tai, 0);
      if (sum > bestSum) {
        bestSum = sum;
        best = items;
      }
    }
  }
  return best ?? base;
}
export function settle(g: Game, streak: number, base: number, perTai: number): Settlement {
  const r = g.result as Result;
  const deltas = [0, 0, 0, 0];
  if (r.kind === "draw") return { items: [], handTai: 0, payments: [], deltas };
  const items = countTai(winContext(g));
  const handTai = items.reduce((a, b) => a + b.tai, 0);
  const payers = r.kind === "tsumo" ? [0, 1, 2, 3].filter((q) => q !== r.winner) : [r.from];
  const payments: Payment[] = payers.map((q) => {
    const dealerTai = q === g.dealer || r.winner === g.dealer ? 1 + 2 * streak : 0;
    const minTai = handTai + dealerTai === 0;
    const amount = base + (minTai ? 1 : handTai + dealerTai) * perTai;
    deltas[q] -= amount;
    deltas[r.winner] += amount;
    return { from: q, to: r.winner, tai: handTai, dealerTai, amount, minTai };
  });
  return { items, handTai, payments, deltas };
}

export function groupText(g: number[]): string {
  const tiles = g.filter((t) => t >= 0);
  if (tiles.length === 0) return "";
  if (tiles[0] >= 27) return tiles.map(tileName).join("");
  return tiles.map((t) => String((t % 9) + 1)).join("") + SUITS[suitOf(tiles[0])];
}
export function decompText(counts: number[]): string {
  const d = decompose(counts);
  if (!d) return "";
  const [pair, ...rest] = d;
  return [...rest.map(groupText), "眼 " + groupText(pair)].join("　");
}
export function shText(s: number): string {
  return s <= 0 ? (s < 0 ? "胡牌" : "聽牌") : `${s} 向聽`;
}
export function meldLabel(m: Meld): string {
  return m.kind === "chi" ? "吃" : m.kind === "pon" ? "碰" : m.kind === "ankan" ? "暗槓" : "槓";
}

export function syncControl(g: Game, humans: number[], auto: number[]): Game {
  const n = cloneGame(g);
  n.humans = [...humans];
  n.auto = [...auto];
  return n;
}

/** 公開桌面。不含牌牆、不含他家手牌；暗槓在結束前蓋住。 */
export interface PublicPlayer { handCount: number; melds: Meld[]; discards: number[]; revealed: number[] | null }
export interface PublicView {
  phase: Phase;
  dealer: number;
  turn: number;
  wallLeft: number;
  last: { tile: number; from: number } | null;
  recent: number;
  result: Result | null;
  log: string[];
  ev: Ev[];
  players: PublicPlayer[];
  wait: number[];
  robTile: number;
  justClaimed: boolean;
  hasDrawn: boolean;
  names: string[];
  reveal: boolean;
}
export function maskMeld(m: Meld, reveal: boolean): Meld {
  if (m.kind === "ankan" && !reveal) return { ...m, tiles: [-1, -1, -1, -1] };
  return { ...m, tiles: [...m.tiles] };
}
export function maskEv(e: Ev, reveal: boolean): Ev {
  if (e.kind === "ankan" && !reveal) return { ...e, tiles: [-1, -1, -1, -1], taken: -1 };
  return { ...e, tiles: [...e.tiles] };
}
export function projectPublic(g: Game): PublicView {
  const reveal = g.phase === "end";
  return {
    phase: g.phase,
    dealer: g.dealer,
    turn: g.turn,
    wallLeft: Math.max(0, g.wall.length - RESERVE),
    last: g.last ? { ...g.last } : null,
    recent: g.recent,
    result: g.result ? { ...g.result } : null,
    log: g.log.slice(-8),
    ev: g.ev.map((e) => maskEv(e, reveal)),
    players: g.players.map((p) => ({
      handCount: p.hand.length,
      melds: p.melds.map((m) => maskMeld(m, reveal)),
      discards: [...p.discards],
      revealed: reveal ? [...p.hand] : null,
    })),
    wait: [...g.wait],
    robTile: g.phase === "robkan" ? g.robTile : -1,
    justClaimed: g.justClaimed,
    hasDrawn: g.drawn !== null,
    names: [...g.names],
    reveal,
  };
}
export interface HandPrivate {
  tiles: number[];
  drawn: number | null;
  melds: Meld[];
  prompt: Prompt | null;
}
export type Prompt =
  | { kind: "turn"; canTsumo: boolean; kans: KanOpt[]; drawn: number | null }
  | { kind: "claim"; tile: number; from: number; options: HumanOptions; deadline: number }
  | { kind: "rob"; tile: number; from: number; deadline: number };

export function projectHand(g: Game, seat: number, deadline: number | null): HandPrivate {
  const pl = g.players[seat];
  let prompt: Prompt | null = null;
  if (g.phase === "turn" && g.turn === seat && controlled(g, seat)) {
    prompt = { kind: "turn", canTsumo: canTsumo(g, seat), kans: kanOptions(g, seat), drawn: g.drawn };
  } else if (g.phase === "claim" && g.wait.includes(seat) && g.last && g.optionsBySeat?.[seat]) {
    prompt = { kind: "claim", tile: g.last.tile, from: g.last.from, options: g.optionsBySeat[seat] as HumanOptions, deadline: deadline ?? 0 };
  } else if (g.phase === "robkan" && g.wait.includes(seat)) {
    prompt = { kind: "rob", tile: g.robTile, from: g.turn, deadline: deadline ?? 0 };
  }
  return {
    tiles: [...pl.hand],
    drawn: g.phase === "turn" && g.turn === seat ? g.drawn : null,
    melds: pl.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    prompt,
  };
}

export function publicJsonLeaksWall(view: PublicView, wall: number[]): boolean {
  const blob = JSON.stringify(view);
  return blob.includes(JSON.stringify(wall));
}
