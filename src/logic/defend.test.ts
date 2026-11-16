import { describe, expect, it } from "vitest";
import { cpuChooseDiscard, makeGame, mulberry, newGame, projectPublic, type Meld } from "./engine";

describe("防守電腦", () => {
  it("單機三家電腦每局隨機一或兩家防守，自己不會被標成防守", () => {
    const seen = [0, 0, 0, 0];
    let one = 0;
    let two = 0;
    for (let i = 0; i < 40; i++) {
      const g = newGame(mulberry(i + 1), 0, { humans: [0], names: ["你", "下家", "對家", "上家"] });
      expect(g.defend[0]).toBe(false);
      const n = g.defend.filter(Boolean).length;
      expect(n === 1 || n === 2).toBe(true);
      if (n === 1) one++;
      else two++;
      g.defend.forEach((on, seat) => {
        if (on) seen[seat]++;
      });
      expect(JSON.stringify(projectPublic(g))).not.toContain("defend");
    }
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(0);
    expect(seen[1]).toBeGreaterThan(0);
    expect(seen[2]).toBeGreaterThan(0);
    expect(seen[3]).toBeGreaterThan(0);
  });

  it("剛開局還沒人做牌時，防守家的出牌跟進攻一樣", () => {
    const g = newGame(mulberry(42), 0, { humans: [0], names: ["你", "下家", "對家", "上家"] });
    const classic = cpuChooseDiscard({ ...g, classicAi: true }, 1);
    const folded = cpuChooseDiscard({ ...g, classicAi: false, defend: [false, true, true, true] }, 1);
    expect(folded).toBe(classic);
  });

  it("別家三副露面子時，防守家改打對方丟過的牌", () => {
    const pons: Meld[] = [
      { kind: "pon", tiles: [5, 5, 5], from: 0 },
      { kind: "pon", tiles: [14, 14, 14], from: 1 },
      { kind: "pon", tiles: [23, 23, 23], from: 0 },
    ];
    const g = makeGame({
      hands: [[0, 1, 2, 4, 6, 8, 9, 10, 18, 19, 22, 25, 27, 27, 31, 32], [7], [8], [8]],
      wall: new Array(22).fill(33),
      turn: 0,
      humans: [],
      defend: [true, false, false, false],
      melds: [[], [], pons, []],
      discards: [[], [], [27, 11, 16], []],
    });
    const classic = cpuChooseDiscard({ ...g, classicAi: true, defend: [false, false, false, false] }, 0);
    const folded = cpuChooseDiscard(g, 0);
    expect(classic).toBe(31);
    expect(folded).toBe(27);
  });
});
