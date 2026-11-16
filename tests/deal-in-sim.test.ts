import { describe, expect, it } from "vitest";
import { botAct, mulberry, newGame } from "../src/logic/engine";

/** 不在 npm test 裡。手動跑：SIM_N=300 npx vitest run tests/deal-in-sim.test.ts */
function run(n: number, classic: boolean) {
  let ron = 0;
  let tsumo = 0;
  let draw = 0;
  let rob = 0;
  let defRon = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    let g = newGame(mulberry(10_000 + i), i % 4, {
      humans: [],
      names: ["甲", "乙", "丙", "丁"],
      classicAi: classic,
    });
    let guard = 0;
    while (g.phase !== "end") {
      const next = botAct(g);
      if (!next) throw new Error("牌局卡住");
      g = next;
      if (++guard > 800) throw new Error("超過步數 " + i);
    }
    const kind = g.result?.kind;
    if (kind === "ron") {
      ron++;
      if (g.defend[g.result!.from]) defRon++;
    } else if (kind === "tsumo") tsumo++;
    else if (kind === "rob") rob++;
    else draw++;
  }
  const wins = ron + tsumo + rob;
  return {
    n,
    ron,
    tsumo,
    draw,
    rob,
    defRon,
    ronPct: Math.round(1000 * ron / n) / 10,
    tsumoPct: Math.round(1000 * tsumo / n) / 10,
    drawPct: Math.round(1000 * draw / n) / 10,
    ronOfWins: wins ? Math.round(1000 * ron / wins) / 10 : 0,
    ms: Date.now() - t0,
  };
}

describe("放槍率對照", () => {
  const n = Number(process.env.SIM_N ?? 0);
  it.skipIf(!n)("數百局電腦對打", () => {
    const before = run(n, true);
    const after = run(n, false);
    console.log(JSON.stringify({ before, after }));
    expect(before.ron + before.tsumo + before.draw + before.rob).toBe(n);
    expect(after.ron + after.tsumo + after.draw + after.rob).toBe(n);
  }, 300_000);
});
