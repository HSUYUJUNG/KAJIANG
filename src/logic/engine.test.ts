import { describe, expect, it } from "vitest";
import {
  advanceMatch,
  botAct,
  canRonWith,
  countTai,
  cpuClaim,
  declareKan,
  discard,
  drawTile,
  isWin,
  kanOptions,
  makeGame,
  mulberry,
  newGame,
  newMatch,
  optionsFor,
  projectHand,
  projectPublic,
  RESERVE,
  resolveClaims,
  resolveRob,
  settle,
  shanten,
  waits,
  type Game,
  type Meld,
  type WinCtx,
} from "./engine";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pairs = (tiles: number[]) => tiles.flatMap((t) => [t, t]);

function seqHand(): number[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17];
}

describe("胡牌", () => {
  it("五組面子加一對才算胡", () => {
    const win = seqHand();
    expect(isWin(countsOf(win))).toBe(true);
    expect(isWin(countsOf(win.slice(0, 16)))).toBe(false);
    expect(waits(countsOf(win.filter((t) => t !== 4)))).toContain(4);
  });

  it("向聽：已胡是 -1，聽牌是 0", () => {
    const c = countsOf(seqHand());
    expect(shanten(c, 5)).toBe(-1);
    c[4]--;
    expect(shanten(c, 5)).toBe(0);
  });
});

function countsOf(tiles: number[]): number[] {
  const c = new Array(34).fill(0);
  for (const t of tiles) c[t]++;
  return c;
}

describe("吃碰槓優先", () => {
  const filler = pairs([27, 28, 29, 30, 31, 32, 33]);
  const chiHand = [2, 3, ...filler];
  const ponHand = [4, 4, ...pairs([0, 1, 2, 3, 5, 6, 7])];
  const ron16 = seqHand().filter((t, i) => !(t === 4 && seqHand().indexOf(4) === i));

  const dealer = [4, 26, ...pairs([18, 19, 20, 21, 22, 23, 24])];
  const junk = pairs([10, 11, 12, 13, 14, 15, 16, 25]);
  function g(humans: number[], hands = [dealer, chiHand, ponHand, junk]): Game {
    return makeGame({
      hands,
      wall: [8, 9, ...new Array(28).fill(26)],
      turn: 0,
      humans,
    });
  }

  it("胡優先於碰與吃，離出牌者近的人截胡", () => {
    const two = g([1, 2, 3], [dealer, ron16, ponHand, ron16]);
    const d2 = discard(two, 0, 4);
    expect(d2.phase).toBe("claim");
    const won = resolveClaims(d2, { 1: { kind: "ron" }, 3: { kind: "ron" }, 2: { kind: "pon" } });
    expect(won.result).toMatchObject({ kind: "ron", winner: 1, from: 0, tile: 4 });
    expect(won.players[0].discards).toEqual([]);
  });

  it("沒有胡時，碰優先於吃", () => {
    const base = g([1, 2]);
    const d = discard(base, 0, 4);
    const r = resolveClaims(d, { 1: { kind: "chi", tiles: [2, 3, 4] }, 2: { kind: "pon" } });
    expect(r.players[2].melds[0].kind).toBe("pon");
    expect(r.players[1].melds).toHaveLength(0);
    expect(r.phase).toBe("turn");
    expect(r.turn).toBe(2);
    expect(r.justClaimed).toBe(true);
  });

  it("只有上家可以吃，對家送吃會被拒絕", () => {
    const base = g([1, 2]);
    expect(optionsFor(base, 1, 4, 0).chi.length).toBeGreaterThan(0);
    expect(optionsFor(base, 2, 4, 0).chi).toEqual([]);
    const d = discard(base, 0, 4);
    expect(() => resolveClaims(d, { 2: { kind: "chi", tiles: [2, 3, 4] } })).toThrow(/illegal/);
    const ok = resolveClaims(d, { 1: { kind: "chi", tiles: [2, 3, 4] }, 2: { kind: "pass" } });
    expect(ok.players[1].melds[0]).toMatchObject({ kind: "chi", tiles: [2, 3, 4] });
  });

  it("電腦已能胡就不再等較低的吃", () => {
    const ronA = ron16;
    const base = g([2], [dealer, ronA, chiHand, pairs([0, 1, 2, 3, 5, 6, 7, 8])]);
    const d = discard(base, 0, 4);
    expect(d.phase).toBe("end");
    expect(d.result).toMatchObject({ kind: "ron", winner: 1 });
  });

  it("玩家能胡時會等他，不讓後面的電腦先碰走", () => {
    const base = g([1], [dealer, ron16, ponHand, pairs([0, 1, 2, 3, 5, 6, 7, 8])]);
    const d = discard(base, 0, 4);
    expect(d.phase).toBe("claim");
    expect(d.wait).toContain(1);
    const won = resolveClaims(d, { 1: { kind: "ron" } });
    expect(won.result?.winner).toBe(1);
  });
});

describe("槓", () => {
  it("明槓、暗槓、加槓都從牌尾補牌", () => {
    const wall = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const hand = [27, 27, 27, 27, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const g = makeGame({ hands: [hand, [0], [0], [0]], wall: [...wall], turn: 0, humans: [0] });
    const n = declareKan(g, 0, { kind: "ankan", tile: 27 });
    expect(n.phase).toBe("turn");
    expect(n.drawn).toBe(20);
    expect(n.wall[0]).toBe(1);
    const passed = discard(makeGame({
      hands: [[4], [0], [0], [0]],
      wall: [8, 9, ...new Array(20).fill(1)],
      turn: 0,
      humans: [],
    }), 0, 4);
    expect(passed.turn).toBe(1);
    expect(passed.drawn).toBe(8);
    expect(n.kanDraw).toBe(true);
    expect(n.players[0].melds[0].kind).toBe("ankan");
  });

  it("加槓可搶，暗槓不可搶；搶到後槓變回碰", () => {
    const waitZhong = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 31];
    expect(canRonWith({ hand: waitZhong, melds: [], discards: [] }, 31)).toBe(true);
    const kongHand = [31, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const melds: Meld[][] = [[{ kind: "pon", tiles: [31, 31, 31], from: 2 }], [], [], []];
    const wall = new Array(20).fill(8);
    const g = makeGame({
      hands: [kongHand, waitZhong, [0], [0]],
      melds,
      wall,
      turn: 0,
      humans: [0, 1],
    });
    expect(kanOptions(g, 0).some((k) => k.kind === "added" && k.tile === 31)).toBe(true);
    const added = declareKan(g, 0, { kind: "added", tile: 31 });
    expect(added.phase).toBe("robkan");
    expect(added.wait).toContain(1);
    const robbed = resolveRob(added, { 1: true });
    expect(robbed.result).toMatchObject({ kind: "rob", winner: 1, from: 0, tile: 31 });
    expect(robbed.players[0].melds[0]).toMatchObject({ kind: "pon", tiles: [31, 31, 31] });

    const an = declareKan(
      makeGame({
        hands: [[31, 31, 31, 31, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], waitZhong, [0], [0]],
        wall,
        turn: 0,
        humans: [0, 1],
      }),
      0,
      { kind: "ankan", tile: 31 },
    );
    expect(an.phase).toBe("turn");
    expect(an.players[0].melds[0].kind).toBe("ankan");
  });

  it("牌牆只剩 16 張時流局，也不能再槓", () => {
    const g = makeGame({
      hands: [[0, 0, 0, 0, 1], [1], [1], [1]],
      wall: new Array(RESERVE).fill(5),
      turn: 0,
      humans: [],
    });
    expect(kanOptions(g, 0)).toEqual([]);
    drawTile(g, 0, false);
    expect(g.result?.kind).toBe("draw");
    const g2 = makeGame({
      hands: [[1], [1], [1], [1]],
      wall: new Array(RESERVE + 1).fill(5),
      turn: 1,
      humans: [],
    });
    const tail = g2.wall[g2.wall.length - 1];
    drawTile(g2, 1, true);
    expect(g2.drawn).toBe(tail);
    expect(g2.phase).toBe("turn");
  });
});

describe("南部台計分", () => {
  function ctx(over: Partial<WinCtx> & Pick<WinCtx, "hand" | "winTile">): WinCtx {
    return {
      melds: [],
      tsumo: false,
      rob: false,
      kanDraw: false,
      haitei: false,
      heaven: false,
      earth: false,
      human: false,
      ...over,
    };
  }
  const names = (hand: number[], winTile: number, extra?: Partial<WinCtx>) =>
    countTai(ctx({ hand, winTile, ...extra })).map((i) => `${i.name}${i.tai}`);

  it("邊張、中洞、單吊都算獨聽；兩面聽不算", () => {
    const edge = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17, 2];
    expect(names(edge, 2)).toContain("獨聽1");
    const hole = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17, 1];
    expect(names(hole, 1)).toContain("獨聽1");
    const pair = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17];
    expect(names(pair, 17)).toContain("獨聽1");
    const ryan = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17, 0];
    expect(names(ryan, 0).some((n) => n.startsWith("獨聽"))).toBe(false);
    expect(names(ryan, 0)).toContain("平胡2");
    expect(names(ryan, 0)).toContain("門清1");
  });

  it("見字有台；字一色不再另計字牌刻", () => {
    const hand = [31, 31, 31, 0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 17, 17];
    expect(names(hand, 17, { tsumo: true }).some((n) => n.startsWith("字牌刻"))).toBe(true);
    const honors = [27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 30, 31, 31, 31, 32, 32];
    const zi = names(honors, 32, { tsumo: true });
    expect(zi).toContain("字一色16");
    expect(zi.some((n) => n.startsWith("字牌刻"))).toBe(false);
    expect(zi).toContain("大四喜16");
  });

  it("門清自摸是 3 台，不拆成門清加自摸", () => {
    const hand = seqHand();
    const items = countTai(ctx({ hand, winTile: 17, tsumo: true }));
    expect(items.some((i) => i.name === "門清自摸" && i.tai === 3)).toBe(true);
    expect(items.some((i) => i.name === "門清" || i.name === "自摸")).toBe(false);
  });

  it("放槍付一筆、自摸三家付，莊家台只加在莊家那幾筆，胡牌最少 1 台", () => {
    const chicken = [1, 2, 12, 13, 14, 15, 16, 17, 18, 19, 20, 26, 26, 0];
    const meld: Meld = { kind: "pon", tiles: [8, 8, 8], from: 2 };
    const g = makeGame({
      hands: [chicken, [0], [0], [0]],
      melds: [[meld], [], [], []],
      dealer: 2,
      humans: [],
      calls: 2,
      discardCount: 6,
    });
    g.phase = "end";
    g.result = { kind: "ron", winner: 0, from: 1, tile: 0 };
    const s = settle(g, 0, 50, 20);
    expect(isWin(countsOf(chicken))).toBe(true);
    expect(s.handTai).toBe(0);
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0].minTai).toBe(true);
    expect(s.payments[0].amount).toBe(50 + 20);
    expect(sum(s.deltas)).toBe(0);

    g.dealer = 0;
    const asDealer = settle(g, 2, 30, 10);
    expect(asDealer.payments[0].dealerTai).toBe(1 + 4);
    expect(asDealer.payments[0].minTai).toBe(false);
    expect(asDealer.payments[0].amount).toBe(30 + 5 * 10);

    g.dealer = 3;
    g.result = { kind: "tsumo", winner: 0, from: -1, tile: 0 };
    const ts = settle(g, 0, 50, 20);
    expect(ts.payments).toHaveLength(3);
    expect(sum(ts.deltas)).toBe(0);
    const dealerPay = ts.payments.find((p) => p.from === 3)!;
    const other = ts.payments.find((p) => p.from === 1)!;
    expect(dealerPay.dealerTai).toBe(1);
    expect(other.dealerTai).toBe(0);
    expect(ts.deltas[0]).toBe(-sum([ts.deltas[1], ts.deltas[2], ts.deltas[3]]));
  });

  it("搶槓由加槓者付一筆", () => {
    const g = makeGame({
      hands: [[0], seqHand(), [0], [0]],
      dealer: 2,
      calls: 1,
      discardCount: 4,
    });
    g.phase = "end";
    g.result = { kind: "rob", winner: 1, from: 0, tile: 17 };
    const s = settle(g, 0, 100, 30);
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0].from).toBe(0);
    expect(s.items.some((i) => i.name === "搶槓")).toBe(true);
    expect(sum(s.deltas)).toBe(0);
  });
});

describe("連莊與整圈", () => {
  it("莊家胡或流局連莊，最多連 3 次", () => {
    let m = newMatch("quan", mulberry(1), 0);
    const win = { kind: "ron" as const, winner: 0, from: 1, tile: 0 };
    const draw = { kind: "draw" as const, winner: -1, from: -1, tile: -1 };
    m = advanceMatch(m, win, [0, 0, 0, 0]);
    expect(m.dealer).toBe(0);
    expect(m.streak).toBe(1);
    m = advanceMatch(m, draw, [0, 0, 0, 0]);
    expect(m.streak).toBe(2);
    m = advanceMatch(m, win, [0, 0, 0, 0]);
    expect(m.streak).toBe(3);
    m = advanceMatch(m, win, [0, 0, 0, 0]);
    expect(m.dealer).toBe(1);
    expect(m.streak).toBe(0);
    const pass = advanceMatch(m, { kind: "tsumo", winner: 2, from: -1, tile: 1 }, [0, 0, 0, 0]);
    expect(pass.dealer).toBe(2);
  });

  it("一圈打完且多局金額合計為 0", () => {
    const scores = playMatch("quan", 7);
    expect(sum(scores)).toBe(0);
  });
});

function playMatch(len: "quan" | "jiang", seed: number): number[] {
  let m = newMatch(len, mulberry(seed), seed % 4);
  let n = 0;
  while (!m.over) {
    let g = newGame(mulberry(seed * 1000 + n + 1), m.dealer, { humans: [], names: ["甲", "乙", "丙", "丁"] });
    let guard = 0;
    while (g.phase !== "end") {
      const next = botAct(g);
      if (!next) throw new Error("牌局卡住");
      g = next;
      if (++guard > 500) throw new Error("超過步數");
    }
    const s = settle(g, m.streak, 50, 20);
    expect(sum(s.deltas)).toBe(0);
    if (g.result && g.result.kind !== "draw") {
      expect(s.payments.length).toBeGreaterThan(0);
      for (const p of s.payments) expect(p.amount).toBeGreaterThanOrEqual(50 + 20);
    }
    m = advanceMatch(m, g.result!, s.deltas);
    n++;
    if (n > 80) throw new Error("局數異常");
  }
  return m.scores;
}

describe("模擬整場", () => {
  it("多種子一圈，四家金額合計為 0", () => {
    for (const seed of [1, 2, 3, 4, 8, 13]) {
      const scores = playMatch("quan", seed);
      expect(sum(scores)).toBe(0);
      expect(scores.some((s) => s !== 0)).toBe(true);
    }
  });

  it("一將打完金額合計為 0", () => {
    const scores = playMatch("jiang", 11);
    expect(sum(scores)).toBe(0);
  });
});

describe("公開資訊", () => {
  it("他家手牌與牌牆不會出現在公開狀態", () => {
    const g = newGame(mulberry(99), 0, { humans: [0], names: ["你", "下家", "對家", "上家"] });
    const secretTile = 33;
    g.wall = [secretTile, secretTile, secretTile, ...g.wall.filter((t) => t !== secretTile)];
    g.players[2].hand = g.players[2].hand.map((t, i) => (i === 0 ? secretTile : t));
    const view = projectPublic(g);
    const blob = JSON.stringify(view);
    expect(blob.includes(`[${secretTile}]`) || blob.includes(`,${secretTile},`) || blob.includes(`,${secretTile}]`)).toBe(false);
    expect(view.players[2].revealed).toBeNull();
    expect(view.players[2].handCount).toBe(16);
    expect(view).not.toHaveProperty("wall");
    expect(JSON.stringify(view.players)).not.toContain(`"hand"`);
    const mine = projectHand(g, 0, null);
    const other = projectHand(g, 2, null);
    expect(mine.tiles).not.toEqual(other.tiles);
    expect(JSON.stringify(mine).includes(JSON.stringify(g.players[1].hand))).toBe(false);
  });

  it("結束後才翻開手牌，進行中暗槓蓋住", () => {
    const g = makeGame({
      hands: [[1, 2], [3], [4], [5]],
      melds: [[{ kind: "ankan", tiles: [9, 9, 9, 9], from: 0 }], [], [], []],
      turn: 0,
    });
    expect(projectPublic(g).players[0].melds[0].tiles).toEqual([-1, -1, -1, -1]);
    g.phase = "end";
    g.result = { kind: "draw", winner: -1, from: -1, tile: -1 };
    expect(projectPublic(g).players[0].melds[0].tiles).toEqual([9, 9, 9, 9]);
    expect(projectPublic(g).players[2].revealed).toEqual([4]);
  });
});

describe("電腦會叫胡", () => {
  it("聽牌的電腦對放槍直接胡", () => {
    const ron16 = seqHand().filter((_, i) => i !== seqHand().indexOf(4));
    const g = makeGame({
      hands: [[4, 0, 1, 2], ron16, [8], [8]],
      wall: new Array(24).fill(7),
      turn: 0,
      humans: [],
    });
    const d = discard(g, 0, 4);
    expect(d.result?.kind).toBe("ron");
    expect(cpuClaim(g, 1, 4, 0).kind).toBe("ron");
  });
});
