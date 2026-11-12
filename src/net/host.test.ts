import { describe, expect, it } from "vitest";
import { discard, makeGame, mulberry } from "../logic/engine";
import {
  applyHuman,
  absentLongEnough,
  beginMatch,
  claimBlocksTimeout,
  DISCONNECT_GRACE_MS,
  emptySeats,
  handsOf,
  illusion,
  lobbyState,
  mergeLiveSeats,
  suggestFromPrivate,
  suggestIntent,
  tick,
  toPublic,
  type RoomMeta,
  type Seat,
} from "./host";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function meta(): RoomMeta {
  return {
    createdAt: 1,
    lastActive: 1,
    hostUid: "alice",
    status: "lobby",
    hostOnline: true,
    nextHost: null,
    settings: { len: "quan", base: 50, per: 20, anim: "off", shuffle: false },
  };
}
function seats(): Seat[] {
  const s = emptySeats();
  s[0] = { uid: "alice", name: "春", bot: false, connected: true, auto: false };
  s[1] = { uid: "bob", name: "夏", bot: false, connected: true, auto: false };
  return s;
}

describe("兩人加兩電腦", () => {
  it("打完一局，金額合計為 0，公開狀態不含他家手牌", () => {
    const rng = mulberry(42);
    let state = beginMatch(lobbyState(meta(), seats()), rng, 1_000);
    expect(state.seats[2].bot).toBe(true);
    expect(state.seats[3].bot).toBe(true);
    const gone = [0, 0, 0, 0];
    let now = 1_000;
    let guard = 0;
    while (state.game && state.game.phase !== "end" && guard++ < 500) {
      const g = state.game;
      const humanSeat = g.phase === "turn" ? g.turn : g.wait.find((p) => g.humans.includes(p) && !g.auto.includes(p));
      if (humanSeat !== undefined && state.seats[humanSeat]?.uid) {
        const intent = suggestIntent(g, humanSeat, state.seats[humanSeat].uid as string);
        if (!intent) throw new Error("沒有可送出的動作");
        const next = applyHuman(state, intent, now);
        if (next === state) throw new Error("動作被拒絕 " + intent.kind);
        state = next;
      } else {
        const next = tick(state, now, gone, 0);
        if (next === state) {
          now += 10_000;
          state = tick(state, now, gone, 0);
          if (state.game?.phase !== "end" && next === state) throw new Error("牌局卡住 " + state.game?.phase);
        } else state = next;
      }
      now += 50;
    }
    expect(state.game?.phase).toBe("end");
    expect(state.settlement).toBeTruthy();
    expect(sum(state.settlement!.deltas)).toBe(0);
    const pub = toPublic(state);
    const hands = handsOf(state);
    const blob = JSON.stringify(pub);
    const secretTiles = state.game!.players[1].hand;
    if (state.game!.phase === "end") {
      expect(pub.view?.reveal).toBe(true);
    }
    expect(hands[0]?.tiles).toEqual(state.game!.players[0].hand);
    expect(hands[1]?.tiles).toEqual(state.game!.players[1].hand);
    expect(hands[2]).toBeNull();
    if (pub.view && !pub.view.reveal) {
      expect(blob.includes(JSON.stringify(secretTiles))).toBe(false);
    }
    const illus = illusion(pub.view!, hands[0]!, 0);
    expect(illus.players[1].hand).toEqual([]);
    expect(illus.wall.every((t) => t === 0) || illus.wall.length === pub.view!.wallLeft + 16).toBe(true);
  });

  it("短暫斷線不會交給電腦，回來後仍是自己打", () => {
    const rng = mulberry(7);
    let state = beginMatch(lobbyState(meta(), seats()), rng, 5_000);
    const human = 0;
    state = { ...state, game: { ...state.game!, turn: human, phase: "turn", justClaimed: true } };
    state.seats[human] = { ...state.seats[human], connected: false, auto: false };
    const gone = [5_000, 0, 0, 0];
    const brief = tick(state, 5_000 + 3_000, gone, 0);
    expect(brief.game?.turn).toBe(human);
    expect(brief.game?.auto.includes(human)).toBe(false);
    const lateNow = 5_000 + DISCONNECT_GRACE_MS + 1_000;
    expect(absentLongEnough(state.seats[human], gone[human] ?? 0, lateNow)).toBe(true);
    const before = state.game!.players[human].discards.length;
    const late = tick(state, lateNow, gone, 0);
    expect(late.game?.players[human].discards.length).toBe(before + 1);
    expect(late.seats[human].auto).toBe(false);
    state.seats[human] = { ...state.seats[human], connected: true };
    const back = tick(state, 5_000 + DISCONNECT_GRACE_MS + 5_000, gone, 0);
    expect(back.game?.turn).toBe(human);
  });

  it("玩家逾時沒按就自動過", () => {
    const filler = [0, 0, 1, 1, 2, 2, 3, 3, 5, 5, 6, 6, 7, 7];
    const g0 = makeGame({
      hands: [[4, 26, ...filler.slice(0, 14)], [2, 3, ...filler], [8], [8]],
      wall: new Array(24).fill(9),
      turn: 0,
      humans: [1],
      names: ["春", "夏", "電腦", "電腦"],
    });
    const g = discard(g0, 0, 4);
    expect(g.phase).toBe("claim");
    g.optionsBySeat = [null, { ron: false, pon: false, kan: false, chi: [[2, 3, 4]] }, null, null];
    expect(claimBlocksTimeout(g)).toBe(false);
    let state = beginMatch(lobbyState(meta(), seats()), mulberry(1), 1);
    state = { ...state, game: g, deadline: 500, meta: { ...state.meta, status: "playing" } };
    const next = tick(state, 600, [0, 0, 0, 0], 0);
    expect(next.game?.phase).not.toBe("claim");
    expect(next.game?.players[1].melds.length).toBe(0);
  });

  it("可以胡或自摸時不會倒數自動過", () => {
    const tenpai = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5];
    const g0 = makeGame({
      hands: [[8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 6, 5], tenpai, [7], [7]],
      wall: new Array(24).fill(20),
      turn: 0,
      humans: [1],
      names: ["春", "夏", "電腦", "電腦"],
    });
    const g = discard(g0, 0, 5);
    expect(g.phase).toBe("claim");
    expect(claimBlocksTimeout(g)).toBe(true);
    let state = beginMatch(lobbyState(meta(), seats()), mulberry(1), 1);
    state = { ...state, game: g, deadline: 500, meta: { ...state.meta, status: "playing" } };
    const waited = tick(state, 20_000, [0, 0, 0, 0], 0);
    expect(waited.game?.phase).toBe("claim");
    expect(waited.deadline).toBe(500);

    const win = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 17];
    const tg = makeGame({
      hands: [win, [7], [7], [7]],
      wall: new Array(24).fill(20),
      turn: 0,
      humans: [0],
      names: ["春", "夏", "電腦", "電腦"],
    });
    state = { ...state, game: tg, seats: seats().map((s, i) => (i === 0 ? { ...s, connected: false, auto: false } : s)) };
    const gone = [1, 0, 0, 0];
    const still = tick(state, DISCONNECT_GRACE_MS + 10_000, gone, 0);
    expect(still.game?.phase).toBe("turn");
    expect(still.game?.result).toBeNull();
  });

  it("客人只憑自己的手牌與公開資訊就能產生合法動作", () => {
    const rng = mulberry(3);
    const state = beginMatch(lobbyState(meta(), seats()), rng, 9_000);
    const pub = toPublic(state);
    const hands = handsOf(state);
    const seat = pub.view!.turn;
    if (hands[seat]) {
      const intent = suggestFromPrivate(pub.view!, hands[seat]!, seat, state.seats[seat].uid as string);
      expect(intent).toBeTruthy();
      const next = applyHuman(state, intent!, 9_000);
      expect(next === state || next.game !== state.game).toBe(true);
    }
  });
});

describe("隨機排座", () => {
  function four(): Seat[] {
    return ["春", "夏", "秋", "冬"].map((name) => ({
      uid: name, name, bot: false, connected: true, auto: false,
    }));
  }

  it("開啟時重抽座位，手牌跟著 uid，莊家仍是隨機座位", () => {
    const base = meta();
    delete base.settings.shuffle;
    const before = four().map((s) => s.uid);
    let moved = false;
    for (let seed = 1; seed < 40 && !moved; seed++) {
      const state = beginMatch(lobbyState(base, four()), mulberry(seed), 1);
      const ids = state.seats.map((s) => s.uid);
      expect(new Set(ids)).toEqual(new Set(before));
      expect(state.game?.log.some((line) => line.includes("座位已隨機排好"))).toBe(true);
      expect(state.match?.dealer).toBeGreaterThanOrEqual(0);
      expect(state.match?.dealer).toBeLessThan(4);
      const hands = handsOf(state);
      ids.forEach((uid, i) => {
        expect(state.seats[i].uid).toBe(uid);
        expect(hands[i]?.tiles).toEqual(state.game?.players[i].hand);
      });
      const again = beginMatch(lobbyState(base, four()), mulberry(seed), 1).seats.map((s) => s.uid);
      expect(again).toEqual(ids);
      if (ids.some((uid, i) => uid !== before[i])) moved = true;
    }
    expect(moved).toBe(true);
  });

  it("關閉時留在原本的座位，也不寫進紀錄", () => {
    const base = meta();
    base.settings.shuffle = false;
    const state = beginMatch(lobbyState(base, seats()), mulberry(4), 1);
    expect(state.seats.map((s) => s.uid)).toEqual(["alice", "bob", null, null]);
    expect(state.seats[2].bot).toBe(true);
    expect(state.game?.log.join("")).not.toContain("座位已隨機排好");
  });

  it("開局後同步連線狀態時不會把人搬回舊位子", () => {
    const shuffled: Seat[] = [
      { uid: "bob", name: "夏", bot: false, connected: true, auto: false },
      { uid: null, name: "電腦", bot: true, connected: true, auto: false },
      { uid: "alice", name: "春", bot: false, connected: true, auto: false },
      { uid: null, name: "電腦", bot: true, connected: true, auto: false },
    ];
    const stale = seats();
    stale[0] = { ...stale[0], connected: false };
    const merged = mergeLiveSeats(shuffled, stale, true);
    expect(merged.map((s) => s.uid)).toEqual(["bob", null, "alice", null]);
    expect(merged[2].connected).toBe(false);
    expect(merged[2].name).toBe("春");
    expect(merged[1].bot).toBe(true);
  });
});
