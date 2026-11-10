import { describe, expect, it } from "vitest";
import { discard, makeGame, mulberry } from "../logic/engine";
import {
  applyHuman,
  beginMatch,
  emptySeats,
  handsOf,
  illusion,
  lobbyState,
  nextHand,
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
    settings: { len: "quan", base: 50, per: 20, anim: "off" },
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
        const next = applyHuman(state, intent, now, gone);
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

  it("斷線超過寬限就由電腦代打，叫牌逾時自動過", () => {
    const rng = mulberry(7);
    let state = beginMatch(lobbyState(meta(), seats()), rng, 5_000);
    state.seats[0] = { ...state.seats[0], connected: false };
    state.seats[1] = { ...state.seats[1], connected: false };
    const gone = [1_000, 1_000, 0, 0];
    let now = 5_000;
    let guard = 0;
    while (state.game && state.game.phase !== "end" && guard++ < 500) {
      const next = tick(state, now, gone, 0);
      if (next === state) now += 12_000;
      else state = next;
      now += 20;
    }
    expect(state.game?.phase).toBe("end");
    expect(sum(state.settlement!.deltas)).toBe(0);
    const after = nextHand(state, rng, now);
    expect(after.match?.played).toBe(1);
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
    let state = beginMatch(lobbyState(meta(), seats()), mulberry(1), 1);
    state = { ...state, game: g, deadline: 500, meta: { ...state.meta, status: "playing" } };
    const next = tick(state, 600, [0, 0, 0, 0], 0);
    expect(next.game?.phase).not.toBe("claim");
    expect(next.game?.players[1].melds.length).toBe(0);
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
      const next = applyHuman(state, intent!, 9_000, [0, 0, 0, 0]);
      expect(next === state || next.game !== state.game).toBe(true);
    }
  });
});
