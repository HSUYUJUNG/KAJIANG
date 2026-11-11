import { describe, expect, it } from "vitest";
import { finishHand, newMatch, startingChips, bustedSeats, chipTotals, mulberry } from "./engine";
import { normalizeMatch } from "../net/wire";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("籌碼", () => {
  it("沒寫起始籌碼時是 2000", () => {
    expect(startingChips(undefined)).toBe(2000);
    expect(newMatch("quan", mulberry(1)).startChips).toBe(2000);
  });

  it("流局不改籌碼，胡牌把底加台記進去且四家合計為 0", () => {
    const match = newMatch("quan", () => 0, 0, 2000);
    const draw = finishHand(match, { kind: "draw", winner: -1, from: -1, tile: -1 }, [0, 0, 0, 0]);
    expect(draw.scores).toEqual([0, 0, 0, 0]);
    expect(draw.over).toBe(false);
    expect(chipTotals(draw.startChips, draw.scores)).toEqual([2000, 2000, 2000, 2000]);

    const won = finishHand(match, { kind: "ron", winner: 1, from: 0, tile: 3 }, [-70, 70, 0, 0]);
    expect(won.scores).toEqual([-70, 70, 0, 0]);
    expect(sum(won.scores)).toBe(0);
    expect(chipTotals(won.startChips, won.scores)).toEqual([1930, 2070, 2000, 2000]);
    expect(won.over).toBe(false);
  });

  it("有人籌碼變成 0 或以下就結束，並記下是誰", () => {
    const match = newMatch("quan", () => 0, 0, 50);
    const done = finishHand(match, { kind: "tsumo", winner: 0, from: -1, tile: 1 }, [210, -70, -70, -70]);
    expect(done.over).toBe(true);
    expect(done.busted).toEqual([1, 2, 3]);
    expect(bustedSeats(done.startChips, done.scores)).toEqual([1, 2, 3]);
    expect(chipTotals(done.startChips, done.scores)[0]).toBe(260);
  });

  it("從資料庫讀回時補上起始籌碼和空的輸光名單", () => {
    const raw = { len: "quan" as const, startDealer: 0, wind: 0, handNo: 0, dealer: 0, streak: 0, scores: [0, 0, 0, 0], played: 1, over: false };
    const back = normalizeMatch(raw as never);
    expect(back?.startChips).toBe(2000);
    expect(back?.busted).toEqual([]);
  });
});
