import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { endAt, get, limitToFirst, orderByValue, query, ref, remove, set, update } from "firebase/database";
import { serverTimestamp } from "firebase/database";
import { mulberry } from "../src/logic/engine";
import {
  applyHuman,
  beginMatch,
  emptySeats,
  handsOf,
  lobbyState,
  suggestFromPrivate,
  suggestIntent,
  tick,
  toPublic,
  toSecret,
  type HostState,
  type RoomMeta,
  type Seat,
} from "../src/net/host";

const URL = "https://demo-kajiang-default-rtdb.asia-southeast1.firebasedatabase.app";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-kajiang",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

function db(uid?: string) {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.database(URL);
}

async function seedLobby() {
  const alice = db("alice");
  await assertSucceeds(set(ref(alice, "rooms/TEST/meta"), {
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
    hostUid: "alice",
    status: "lobby",
    hostOnline: true,
    nextHost: null,
    settings: { len: "quan", base: 50, per: 20, anim: "off" },
  }));
  await assertSucceeds(set(ref(alice, "rooms/TEST/seats/0"), { uid: "alice", name: "春", bot: false, connected: true, auto: false }));
  await assertSucceeds(set(ref(db("bob"), "rooms/TEST/seats/1"), { uid: "bob", name: "夏", bot: false, connected: true, auto: false }));
  for (const i of [2, 3]) {
    await assertSucceeds(set(ref(alice, `rooms/TEST/seats/${i}`), { uid: null, name: "", bot: false, connected: false, auto: false }));
  }
}

describe("資料庫規則與兩人一局", () => {
  it("手牌只有本人讀得到，並能打完一局", async () => {
    await env.clearDatabase();
    await assertFails(get(ref(db(), "rooms/TEST/meta")));
    await seedLobby();
    const alice = db("alice");
    const bob = db("bob");
    await assertFails(set(ref(bob, "rooms/TEST/public"), { nope: true }));
    await assertFails(set(ref(bob, "rooms/TEST/hands/0"), { tiles: [1] }));
    await assertSucceeds(set(ref(bob, "rooms/TEST/intents/1"), { uid: "bob", seat: 1, kind: "discard", tile: 0 }));
    await assertFails(set(ref(bob, "rooms/TEST/intents/0"), { uid: "bob", seat: 0, kind: "discard", tile: 0 }));
    await assertSucceeds(set(ref(alice, "rooms/TEST/seats/0/connected"), true));

    const meta: RoomMeta = {
      createdAt: Date.now(),
      lastActive: Date.now(),
      hostUid: "alice",
      status: "lobby",
      hostOnline: true,
      nextHost: null,
      settings: { len: "quan", base: 50, per: 20, anim: "off", shuffle: false },
    };
    const seats: Seat[] = emptySeats();
    seats[0] = { uid: "alice", name: "春", bot: false, connected: true, auto: false };
    seats[1] = { uid: "bob", name: "夏", bot: false, connected: true, auto: false };
    let state = beginMatch(lobbyState(meta, seats), mulberry(99), Date.now());
    await publish(state);

    await assertFails(get(ref(bob, "rooms/TEST/hands/0")));
    await assertFails(get(ref(bob, "rooms/TEST/secret")));
    await assertSucceeds(get(ref(alice, "rooms/TEST/secret")));
    const own = await get(ref(bob, "rooms/TEST/hands/1"));
    expect(own.exists()).toBe(true);
    expect(own.val().tiles).toEqual(state.game?.players[1].hand);

    const gone = [0, 0, 0, 0];
    let now = Date.now();
    let guard = 0;
    while (state.game && state.game.phase !== "end" && guard++ < 500) {
      const g = state.game;
      const actor = [0, 1].find((p) => {
        if (!g.humans.includes(p) || g.auto.includes(p)) return false;
        if (g.phase === "turn") return g.turn === p;
        return g.wait.includes(p) && (g.phase === "claim" ? !state.answers[p] : state.robs[p] === null);
      });
      if (actor !== undefined) {
        const uid = actor === 0 ? "alice" : "bob";
        const intent = actor === 1
          ? suggestFromPrivate(toPublic(state).view!, handsOf(state)[1]!, 1, uid)
          : suggestIntent(g, actor, uid);
        if (!intent) throw new Error("沒有動作");
        if (actor === 1) await assertSucceeds(set(ref(bob, "rooms/TEST/intents/1"), clean(intent)));
        const next = applyHuman(state, intent, now);
        if (next === state) throw new Error("拒絕 " + intent.kind);
        state = next;
      } else {
        const next = tick(state, now, gone, 0);
        if (next === state) now += 12000;
        state = next === state ? tick(state, now, gone, 0) : next;
      }
      if (guard % 4 === 0) await publish(state);
      now += 30;
    }
    await publish(state);
    expect(state.game?.phase).toBe("end");
    expect(sum(state.settlement?.deltas ?? [1])).toBe(0);
    await assertFails(get(ref(bob, "rooms/TEST/hands/0")));
    const revealed = await get(ref(bob, "rooms/TEST/public"));
    expect(revealed.val().view.reveal).toBe(true);
    expect(revealed.val().view.players[0].revealed.length).toBeGreaterThan(0);

    await assertFails(remove(ref(alice, "rooms/TEST")));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(URL), "rooms/OLD/meta"), { hostUid: "alice", createdAt: 1, lastActive: 1, status: "lobby", hostOnline: false, nextHost: null, settings: meta.settings });
    });
    await assertSucceeds(remove(ref(alice, "rooms/OLD")));
  }, 60000);

  it("只刪超過一天的房間，進行中的留下", async () => {
    await env.clearDatabase();
    const now = Date.now();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.database(URL);
      const meta = (extra: Record<string, unknown>) => ({ hostUid: "alice", status: "lobby", hostOnline: false, nextHost: null, settings: { len: "quan", base: 50, per: 20, anim: "off" }, ...extra });
      await set(ref(d, "rooms/OLDROOM/meta"), meta({ createdAt: 1, lastActive: 1 }));
      await set(ref(d, "rooms/NEWROOM/meta"), meta({ createdAt: now, lastActive: now }));
      await set(ref(d, "rooms/LEGACY/meta"), meta({ createdAt: 1 }));
      await set(ref(d, "rooms/FRESHLEGACY/meta"), meta({ createdAt: now }));
      await set(ref(d, "rooms/EMPTY/meta"), meta({}));
      await set(ref(d, "roomActivity/OLDROOM"), 1);
      await set(ref(d, "roomActivity/NEWROOM"), now);
    });
    const bob = db("bob");
    const listed = await get(query(ref(bob, "roomActivity"), orderByValue(), endAt(now - 86400000 - 1), limitToFirst(50)));
    expect(Object.keys(listed.val() || {})).toEqual(["OLDROOM"]);
    await assertSucceeds(remove(ref(bob, "rooms/OLDROOM")));
    await assertSucceeds(remove(ref(bob, "roomActivity/OLDROOM")));
    await assertFails(remove(ref(bob, "rooms/NEWROOM")));
    await assertFails(remove(ref(bob, "roomActivity/NEWROOM")));
    await assertSucceeds(remove(ref(bob, "rooms/LEGACY")));
    await assertFails(remove(ref(bob, "rooms/FRESHLEGACY")));
    await assertSucceeds(remove(ref(bob, "rooms/EMPTY")));
    await assertFails(set(ref(bob, "presence/alice"), true));
    await assertSucceeds(set(ref(bob, "presence/bob"), true));
    await assertSucceeds(remove(ref(bob, "presence/bob")));
  });
});

async function publish(state: HostState) {
  const alice = db("alice");
  await assertSucceeds(update(ref(alice, "rooms/TEST/meta"), {
    lastActive: serverTimestamp(),
    status: state.meta.status,
    hostOnline: true,
    settings: state.meta.settings,
  }));
  await assertSucceeds(set(ref(alice, "rooms/TEST/public"), clean(toPublic(state))));
  await assertSucceeds(set(ref(alice, "rooms/TEST/secret"), clean(toSecret(state))));
  const hands = handsOf(state);
  for (let i = 0; i < 4; i++) {
    if (hands[i]) await assertSucceeds(set(ref(alice, `rooms/TEST/hands/${i}`), clean(hands[i])));
  }
}
