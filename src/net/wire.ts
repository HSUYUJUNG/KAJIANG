import {
  startingChips,
  type ClaimChoice,
  type Ev,
  type Game,
  type HandPrivate,
  type HumanOptions,
  type Match,
  type Meld,
  type Player,
  type Prompt,
  type PublicView,
  type Settlement,
} from "../logic/engine";

/**
 * Realtime Database 不保存 null，也不保存空陣列。
 * 有空洞的陣列會變成 {"1": ...} 這種物件。讀回來時要補回原本的形狀。
 */
export function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, T>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const max = Math.max(...keys.map((k) => Number(k)));
      const out: T[] = [];
      for (let i = 0; i <= max; i++) out.push(obj[i] as T);
      return out;
    }
  }
  return [];
}

function asFixed<T>(value: unknown, n: number, fill: T): T[] {
  const list = asList<T>(value);
  return Array.from({ length: n }, (_, i) => (list[i] === undefined ? fill : list[i]));
}

function normalizeMeld(raw: Meld | null | undefined): Meld {
  return {
    kind: raw?.kind ?? "pon",
    from: raw?.from ?? -1,
    tiles: asList<number>(raw?.tiles),
  };
}

function normalizeOptions(raw: HumanOptions | null | undefined): HumanOptions | null {
  if (!raw) return null;
  return {
    ron: !!raw.ron,
    pon: !!raw.pon,
    kan: !!raw.kan,
    chi: asList<unknown>(raw.chi).map((row) => asList<number>(row)),
  };
}

export function normalizePrompt(raw: Prompt | null | undefined): Prompt | null {
  if (!raw || (raw.kind !== "turn" && raw.kind !== "claim" && raw.kind !== "rob")) return null;
  if (raw.kind === "turn") {
    return { kind: "turn", canTsumo: !!raw.canTsumo, kans: asList(raw.kans), drawn: raw.drawn ?? null };
  }
  if (raw.kind === "claim") {
    return {
      kind: "claim",
      tile: raw.tile ?? 0,
      from: raw.from ?? 0,
      deadline: raw.deadline ?? 0,
      options: normalizeOptions(raw.options) ?? { ron: false, pon: false, kan: false, chi: [] },
    };
  }
  return { kind: "rob", tile: raw.tile ?? 0, from: raw.from ?? 0, deadline: raw.deadline ?? 0 };
}

export function normalizeHand(raw: HandPrivate | null | undefined): HandPrivate | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    tiles: asList<number>(raw.tiles),
    drawn: raw.drawn ?? null,
    melds: asList<Meld>(raw.melds).map((m) => normalizeMeld(m)),
    prompt: normalizePrompt(raw.prompt),
  };
}

function normalizeEv(raw: unknown): Ev[] {
  return asList<Ev>(raw).map((e) => ({ ...e, tiles: asList<number>(e?.tiles) }));
}

export function normalizeView(raw: PublicView | null | undefined): PublicView | null {
  if (!raw || typeof raw !== "object" || !raw.phase) return null;
  const players = asList<PublicView["players"][number]>(raw.players).map((p) => ({
    handCount: p?.handCount ?? 0,
    melds: asList<Meld>(p?.melds).map((m) => normalizeMeld(m)),
    discards: asList<number>(p?.discards),
    revealed: p?.revealed == null ? null : asList<number>(p.revealed),
  }));
  while (players.length < 4) players.push({ handCount: 0, melds: [], discards: [], revealed: null });
  return {
    ...raw,
    last: raw.last ?? null,
    result: raw.result ?? null,
    log: asList<string>(raw.log),
    ev: normalizeEv(raw.ev),
    players,
    wait: asList<number>(raw.wait),
    names: asList<string>(raw.names),
  };
}

export function normalizeMatch(raw: Match | null | undefined): Match | null {
  if (!raw) return null;
  return {
    ...raw,
    scores: asFixed<number>(raw.scores, 4, 0),
    startChips: startingChips(raw.startChips),
    busted: asList<number>(raw.busted),
  };
}

export function normalizeSettlement(raw: Settlement | null | undefined): Settlement | null {
  if (!raw) return null;
  return {
    items: asList(raw.items),
    handTai: raw.handTai ?? 0,
    payments: asList(raw.payments),
    deltas: asFixed<number>(raw.deltas, 4, 0),
  };
}

export function normalizePublic<T extends {
  view?: PublicView | null;
  match?: Match | null;
  settlement?: Settlement | null;
  names?: string[] | null;
  deadline?: number | null;
}>(raw: T | null | undefined): T | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    view: raw.view ? normalizeView(raw.view) : null,
    match: normalizeMatch(raw.match),
    settlement: normalizeSettlement(raw.settlement),
    names: asList<string>(raw.names),
    deadline: raw.deadline ?? null,
  };
}

export function normalizeGame(raw: Game | null | undefined): Game | null {
  if (!raw || typeof raw !== "object" || !raw.phase) return null;
  const players = asList<Player>(raw.players).map((p) => ({
    hand: asList<number>(p?.hand),
    melds: asList<Meld>(p?.melds).map((m) => normalizeMeld(m)),
    discards: asList<number>(p?.discards),
  }));
  while (players.length < 4) players.push({ hand: [], melds: [], discards: [] });
  return {
    ...raw,
    wall: asList<number>(raw.wall),
    players,
    drawn: raw.drawn ?? null,
    last: raw.last ?? null,
    options: normalizeOptions(raw.options),
    optionsBySeat: raw.optionsBySeat == null
      ? null
      : asFixed<HumanOptions | null>(raw.optionsBySeat, 4, null).map((o) => (o ? normalizeOptions(o) : null)),
    wait: asList<number>(raw.wait),
    log: asList<string>(raw.log),
    result: raw.result ?? null,
    draws: asFixed<number>(raw.draws, 4, 0),
    ev: normalizeEv(raw.ev),
    humans: asList<number>(raw.humans),
    auto: asList<number>(raw.auto),
    names: asList<string>(raw.names),
  };
}

export function normalizeAnswers(value: unknown): (ClaimChoice | null)[] {
  const list = asList<ClaimChoice | null>(value);
  return [0, 1, 2, 3].map((i) => list[i] ?? null);
}

export function normalizeRobs(value: unknown): (boolean | null)[] {
  const list = asList<boolean | null>(value);
  return [0, 1, 2, 3].map((i) => (list[i] === undefined ? null : list[i]));
}
