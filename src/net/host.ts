// 房主權威：只在房主瀏覽器上推進牌局。其他玩家送出意圖。

import {
  CLAIM_MS,
  canRonWith,
  canTsumo,
  controlled,
  cpuChooseDiscard,
  cpuClaim,
  cpuStep,
  kanOptions,
  needOf,
  shanten,
  toCounts,
  declareKan,
  discard,
  legalChoice,
  newGame,
  newMatch,
  finishHand,
  optionsFor,
  projectHand,
  projectPublic,
  resolveClaims,
  resolveRob,
  settle,
  tsumo,
  type ClaimChoice,
  type Game,
  type HandPrivate,
  type KanOpt,
  type Match,
  type PublicView,
  type Rng,
  type Settlement,
} from "../logic/engine";
import { normalizeAnswers, normalizeGame, normalizeMatch, normalizeRobs, normalizeSettlement } from "./wire";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** 人離開連線超過這段時間，才代打一張（不是整場託管）。胡牌和自摸不代打。 */
export const DISCONNECT_GRACE_MS = 45_000;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Seat {
  uid: string | null;
  name: string;
  bot: boolean;
  connected: boolean;
  auto: boolean;
}
export interface Settings {
  len: "quan" | "jiang";
  base: number;
  per: number;
  anim: "normal" | "fast" | "off";
  /** 按開始時重抽四個座位。沒寫進房間時視為開。 */
  shuffle?: boolean;
  /** 每人起始籌碼。沒寫時是 2000。 */
  chips?: number;
}
export interface RoomMeta {
  createdAt: number;
  lastActive: number;
  hostUid: string;
  status: "lobby" | "playing" | "ended";
  hostOnline: boolean;
  nextHost: string | null;
  settings: Settings;
}
export type Intent =
  | { uid: string; seat: number; kind: "discard"; tile: number }
  | { uid: string; seat: number; kind: "tsumo" }
  | { uid: string; seat: number; kind: "kan"; kan: KanOpt }
  | { uid: string; seat: number; kind: "claim"; claim: ClaimChoice }
  | { uid: string; seat: number; kind: "rob"; rob: boolean };

export interface HostState {
  meta: RoomMeta;
  seats: Seat[];
  game: Game | null;
  match: Match | null;
  settlement: Settlement | null;
  deadline: number | null;
  answers: (ClaimChoice | null)[];
  robs: (boolean | null)[];
}

export interface PublicState {
  view: PublicView | null;
  match: Match | null;
  settlement: Settlement | null;
  deadline: number | null;
  status: RoomMeta["status"];
  settings: Settings;
  hostOnline: boolean;
  names: string[];
}
export interface SecretState {
  hostUid: string;
  game: Game | null;
  match: Match | null;
  settlement: Settlement | null;
  deadline: number | null;
  answers: (ClaimChoice | null)[];
  robs: (boolean | null)[];
}

export function emptySeat(): Seat {
  return { uid: null, name: "", bot: false, connected: false, auto: false };
}
export function emptySeats(): Seat[] {
  return [0, 1, 2, 3].map(() => emptySeat());
}
export function blankAnswers(): (ClaimChoice | null)[] {
  return [null, null, null, null];
}
export function blankRobs(): (boolean | null)[] {
  return [null, null, null, null];
}
export function paceMs(anim: Settings["anim"]): number {
  if (anim === "off") return 280;
  if (anim === "fast") return 650;
  return 1100;
}
export function makeCode(rng: Rng = Math.random): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return s;
}
export function normalizeSeat(raw: Partial<Seat> | null | undefined): Seat {
  if (!raw) return emptySeat();
  return {
    uid: raw.uid ? String(raw.uid) : null,
    name: String(raw.name ?? "").slice(0, 8),
    bot: !!raw.bot,
    connected: !!raw.connected,
    auto: !!raw.auto,
  };
}
export function seatName(seat: Seat, index: number): string {
  if (seat.name) return seat.name;
  if (seat.bot || !seat.uid) return "電腦";
  return `玩家${"東南西北"[index]}`;
}

function sameNums(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
export function controlOf(seats: Seat[]): { humans: number[]; auto: number[] } {
  const humans: number[] = [];
  const auto: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = seats[i];
    if (!s?.uid || s.bot) continue;
    humans.push(i);
    if (s.auto) auto.push(i);
  }
  return { humans, auto };
}
/** 這次叫牌裡有玩家可以胡，就不能倒數自動過。碰、吃、槓仍倒數。搶槓維持倒數。 */
export function claimBlocksTimeout(g: Game): boolean {
  if (g.phase !== "claim" || !g.last) return false;
  const tile = g.last.tile;
  const from = g.last.from;
  return g.wait.some((p) => {
    if (!controlled(g, p)) return false;
    const o = g.optionsBySeat?.[p] ?? optionsFor(g, p, tile, from);
    return !!o?.ron;
  });
}

export function absentLongEnough(seat: Seat | undefined, goneAt: number, now: number): boolean {
  return !!seat && !seat.bot && !!seat.uid && !seat.connected && !seat.auto && goneAt > 0 && now - goneAt >= DISCONNECT_GRACE_MS;
}

function withControl(g: Game, seats: Seat[]): Game {
  const { humans, auto } = controlOf(seats);
  if (sameNums(g.humans, humans) && sameNums(g.auto, auto)) return g;
  return { ...g, humans: [...humans], auto: [...auto] };
}
function adopt(state: HostState, g: Game, now: number): HostState {
  const waiting = g.phase === "claim" || g.phase === "robkan";
  const was = state.game;
  const continued = !!was && was.phase === g.phase && waiting;
  let deadline = state.deadline;
  let answers = state.answers;
  let robs = state.robs;
  if (waiting && !continued) {
    deadline = claimBlocksTimeout(g) ? null : now + CLAIM_MS;
    answers = blankAnswers();
    robs = blankRobs();
  } else if (!waiting) {
    deadline = null;
    answers = blankAnswers();
    robs = blankRobs();
  }
  let settlement = state.settlement;
  let match = state.match;
  let meta = state.meta;
  if (g.phase === "end" && g.result && match) {
    if (!was || was.phase !== "end" || !settlement) {
      settlement = settle(g, match.streak, state.meta.settings.base, state.meta.settings.per);
      const done = finishHand(match, g.result, settlement.deltas);
      if (done.over) {
        match = done;
        meta = { ...state.meta, status: "ended" };
      }
    }
  }
  return { ...state, game: g, deadline, answers, robs, settlement, match, meta };
}

export function lobbyState(meta: RoomMeta, seats: Seat[]): HostState {
  return {
    meta, seats, game: null, match: null, settlement: null, deadline: null,
    answers: blankAnswers(), robs: blankRobs(),
  };
}

/** 沒有明確關掉時，開始牌局會重抽座位。 */
export function shuffleSeatsOn(settings: Pick<Settings, "shuffle"> | null | undefined): boolean {
  return settings?.shuffle !== false;
}

/** 空位補成電腦。shuffle 為真時，再用同一個 rng 把四個座位整組打亂。 */
export function arrangeSeats(seats: Seat[], rng: Rng, shuffle: boolean): Seat[] {
  const filled = seats.map((s) => {
    if (s.uid && !s.bot) return { ...s, auto: false };
    return { uid: null, name: "電腦", bot: true, connected: true, auto: false };
  });
  if (!shuffle) return filled;
  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = filled[i];
    filled[i] = filled[j];
    filled[j] = tmp;
  }
  return filled;
}

/**
 * 牌局進行中，座位以房主剛排好的為準，只按 uid 同步連線與託管。
 * 大廳則直接採用線上座位。
 */
export function mergeLiveSeats(current: Seat[], live: Seat[], playing: boolean): Seat[] {
  if (!playing) return live.map((s) => ({ ...s }));
  return current.map((s) => {
    if (!s.uid || s.bot) return { ...s, connected: true };
    const found = live.find((r) => r.uid === s.uid);
    if (!found) return s;
    return { ...s, connected: found.connected, auto: found.auto, name: found.name || s.name };
  });
}

export function beginMatch(state: HostState, rng: Rng, now: number): HostState {
  const shuffle = shuffleSeatsOn(state.meta.settings);
  const seats = arrangeSeats(state.seats, rng, shuffle);
  const match = newMatch(state.meta.settings.len, rng, undefined, state.meta.settings.chips);
  const started = startHand({
    ...state,
    seats,
    match,
    game: null,
    settlement: null,
    deadline: null,
    answers: blankAnswers(),
    robs: blankRobs(),
    meta: { ...state.meta, status: "playing" },
  }, rng, now);
  if (shuffle && started.game) started.game.log.push("座位已隨機排好。");
  return started;
}
export function startHand(state: HostState, rng: Rng, now: number): HostState {
  if (!state.match) return state;
  const names = state.seats.map(seatName);
  const humans = state.seats.flatMap((s, i) => (s.uid && !s.bot ? [i] : []));
  const g = newGame(rng, state.match.dealer, { humans, names, auto: state.seats.flatMap((s, i) => (s.auto ? [i] : [])) });
  return adopt({ ...state, settlement: null }, g, now);
}
export function nextHand(state: HostState, rng: Rng, now: number): HostState {
  if (!state.game?.result || !state.settlement || !state.match) return state;
  if (state.match.over) return state;
  const match = finishHand(state.match, state.game.result, state.settlement.deltas);
  if (match.over) {
    return {
      ...state,
      match,
      meta: { ...state.meta, status: "ended" },
    };
  }
  return startHand({ ...state, match, settlement: null }, rng, now);
}
export function returnToLobby(state: HostState): HostState {
  return {
    ...state,
    game: null,
    match: null,
    settlement: null,
    deadline: null,
    answers: blankAnswers(),
    robs: blankRobs(),
    meta: { ...state.meta, status: "lobby" },
  };
}

function claimMap(answers: (ClaimChoice | null)[]): Record<number, ClaimChoice> {
  const out: Record<number, ClaimChoice> = {};
  answers.forEach((a, i) => { if (a) out[i] = a; });
  return out;
}
function robMap(robs: (boolean | null)[]): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  robs.forEach((a, i) => { if (a !== null) out[i] = a; });
  return out;
}

export function applyHuman(state: HostState, intent: Intent, now: number): HostState {
  if (!state.game || state.game.phase === "end") return state;
  const seat = state.seats[intent.seat];
  if (!seat || seat.uid !== intent.uid || seat.bot) return state;
  const g = withControl(state.game, state.seats);
  if (!controlled(g, intent.seat)) return state;
  try {
    if (intent.kind === "discard" && g.phase === "turn" && g.turn === intent.seat) {
      return adopt({ ...state, game: g }, discard(g, intent.seat, intent.tile), now);
    }
    if (intent.kind === "tsumo" && canTsumo(g, intent.seat)) {
      return adopt({ ...state, game: g }, tsumo(g, intent.seat), now);
    }
    if (intent.kind === "kan" && g.phase === "turn" && g.turn === intent.seat) {
      return adopt({ ...state, game: g }, declareKan(g, intent.seat, intent.kan), now);
    }
    if (intent.kind === "claim" && g.phase === "claim" && g.wait.includes(intent.seat) && g.last) {
      const o = g.optionsBySeat?.[intent.seat] ?? optionsFor(g, intent.seat, g.last.tile, g.last.from);
      if (!legalChoice(o, intent.claim, g.last.tile)) return state;
      const answers = state.answers.slice() as (ClaimChoice | null)[];
      answers[intent.seat] = intent.claim;
      const held = { ...state, game: g, answers };
      if (g.wait.every((p) => !controlled(g, p) || answers[p])) {
        return adopt(held, resolveClaims(g, claimMap(answers)), now);
      }
      return held;
    }
    if (intent.kind === "rob" && g.phase === "robkan" && g.wait.includes(intent.seat)) {
      if (intent.rob && !canRonWith(g.players[intent.seat], g.robTile)) return state;
      const robs = state.robs.slice() as (boolean | null)[];
      robs[intent.seat] = intent.rob;
      const held = { ...state, game: g, robs };
      if (g.wait.every((p) => !controlled(g, p) || robs[p] !== null)) {
        return adopt(held, resolveRob(g, robMap(robs)), now);
      }
      return held;
    }
  } catch {
    return state;
  }
  return state;
}

/** 推進一步：電腦出牌、逾時自動過、或斷線改由電腦代打。沒有進展時回傳同一個物件。 */
export function tick(state: HostState, now: number, goneAt: number[], earliestBot: number): HostState {
  if (!state.game || !state.match || state.meta.status !== "playing" || state.game.phase === "end") return state;
  const g = withControl(state.game, state.seats);
  if (g.phase === "claim" || g.phase === "robkan") {
    const ready = g.phase === "claim"
      ? g.wait.every((p) => !controlled(g, p) || state.answers[p])
      : g.wait.every((p) => !controlled(g, p) || state.robs[p] !== null);
    const timedOut = state.deadline !== null && now >= state.deadline && !claimBlocksTimeout(g);
    if (ready || timedOut) {
      const base = { ...state, game: g };
      const next = g.phase === "claim" ? resolveClaims(g, claimMap(state.answers)) : resolveRob(g, robMap(state.robs));
      return adopt(base, next, now);
    }
    return g === state.game ? state : { ...state, game: g };
  }
  if (g.phase === "turn" && !controlled(g, g.turn)) {
    if (now < earliestBot) return g === state.game ? state : { ...state, game: g };
    return adopt({ ...state, game: g }, cpuStep(g), now);
  }
  if (g.phase === "turn" && controlled(g, g.turn) && !canTsumo(g, g.turn) && absentLongEnough(state.seats[g.turn], goneAt[g.turn] ?? 0, now)) {
    if (now < earliestBot) return g === state.game ? state : { ...state, game: g };
    return adopt({ ...state, game: g }, discard(g, g.turn, cpuChooseDiscard(g, g.turn)), now);
  }
  return g === state.game ? state : { ...state, game: g };
}

export function suggestIntent(g: Game, seat: number, uid: string): Intent | null {
  if (g.phase === "turn" && g.turn === seat) {
    if (canTsumo(g, seat)) return { uid, seat, kind: "tsumo" };
    const pl = g.players[seat];
    for (const k of kanOptions(g, seat)) {
      const c = toCounts(pl.hand);
      const before = shanten(c, needOf(pl));
      if (k.kind === "ankan") c[k.tile] -= 4;
      else c[k.tile] -= 1;
      const after = shanten(c, k.kind === "ankan" ? needOf(pl) - 1 : needOf(pl));
      if (after <= before) return { uid, seat, kind: "kan", kan: k };
    }
    return { uid, seat, kind: "discard", tile: cpuChooseDiscard(g, seat) };
  }
  if (g.phase === "claim" && g.wait.includes(seat) && g.last) {
    return { uid, seat, kind: "claim", claim: cpuClaim(g, seat, g.last.tile, g.last.from) };
  }
  if (g.phase === "robkan" && g.wait.includes(seat)) {
    return { uid, seat, kind: "rob", rob: canRonWith(g.players[seat], g.robTile) };
  }
  return null;
}

/** 用公開桌面加上自己的手牌，組成電腦策略看得到的局面（不含他家暗牌）。 */
export function illusion(pub: PublicView, hand: HandPrivate, seat: number): Game {
  const players = [0, 1, 2, 3].map((i) => ({
    hand: i === seat ? [...hand.tiles] : [],
    melds: (i === seat ? hand.melds : pub.players[i].melds).map((m) => ({ ...m, tiles: [...m.tiles] })),
    discards: [...pub.players[i].discards],
  }));
  return {
    wall: new Array(Math.max(0, pub.wallLeft) + 16).fill(0),
    players,
    dealer: pub.dealer,
    turn: pub.turn,
    phase: pub.phase,
    drawn: hand.drawn,
    justClaimed: pub.justClaimed,
    last: pub.last ? { ...pub.last } : null,
    options: null,
    optionsBySeat: null,
    wait: [...pub.wait],
    robTile: pub.robTile,
    log: [],
    result: pub.result ? { ...pub.result } : null,
    steps: 0,
    recent: pub.recent,
    kanDraw: false,
    calls: 0,
    draws: [1, 1, 1, 1],
    discardCount: 1,
    ev: [],
    evSeq: 0,
    humans: [seat],
    auto: [],
    names: [...pub.names],
  };
}
export function suggestFromPrivate(pub: PublicView, hand: HandPrivate, seat: number, uid: string): Intent | null {
  if (!hand.prompt) return null;
  return suggestIntent(illusion(pub, hand, seat), seat, uid);
}

export function toPublic(state: HostState): PublicState {
  return {
    view: state.game ? projectPublic(state.game) : null,
    match: state.match,
    settlement: state.settlement,
    deadline: state.deadline,
    status: state.meta.status,
    settings: state.meta.settings,
    hostOnline: state.meta.hostOnline,
    names: state.seats.map(seatName),
  };
}
export function toSecret(state: HostState): SecretState {
  return {
    hostUid: state.meta.hostUid,
    game: state.game,
    match: state.match,
    settlement: state.settlement,
    deadline: state.deadline,
    answers: state.answers,
    robs: state.robs,
  };
}
export function handsOf(state: HostState): (HandPrivate | null)[] {
  if (!state.game) return [null, null, null, null];
  return [0, 1, 2, 3].map((i) => {
    const s = state.seats[i];
    if (!s?.uid || s.bot) return null;
    return projectHand(state.game as Game, i, state.deadline);
  });
}
export function stateFromSecret(meta: RoomMeta, seats: Seat[], secret: SecretState): HostState {
  return {
    meta,
    seats,
    game: normalizeGame(secret.game),
    match: normalizeMatch(secret.match),
    settlement: normalizeSettlement(secret.settlement),
    deadline: secret.deadline ?? null,
    answers: normalizeAnswers(secret.answers),
    robs: normalizeRobs(secret.robs),
  };
}

export function roomExpired(lastActive: number, now = Date.now()): boolean {
  return !lastActive || now - lastActive > ROOM_TTL_MS;
}

/** 沒有 lastActive 的舊房間改看 createdAt；兩個都沒有就當作已過期。 */
export function roomIsStale(meta: { lastActive?: unknown; createdAt?: unknown } | null, now = Date.now()): boolean {
  if (!meta) return false;
  const last = typeof meta.lastActive === "number" ? meta.lastActive : null;
  const created = typeof meta.createdAt === "number" ? meta.createdAt : null;
  const stamp = last ?? created ?? 0;
  return now - stamp > ROOM_TTL_MS;
}

/** 給清理用：挑出活動時間早於 24 小時的房間代碼，最多 limit 間。 */
export function staleActivityCodes(index: Record<string, number> | null, now = Date.now(), limit = 50): string[] {
  const cutoff = now - ROOM_TTL_MS;
  return Object.entries(index ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] < cutoff)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([code]) => code);
}
