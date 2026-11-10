import { get, onDisconnect, remove, set, update } from "firebase/database";
import { db, ensureUser, ref, rememberRoom, roomPath, roomRef, serverTimestamp } from "./firebase";
import {
  handsOf,
  makeCode,
  normalizeSeat,
  roomExpired,
  toPublic,
  toSecret,
  type HostState,
  type Intent,
  type Seat,
  type Settings,
} from "./host";

export function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function createRoom(name: string, settings: Settings): Promise<string> {
  const user = await ensureUser();
  for (let i = 0; i < 6; i++) {
    const code = makeCode();
    const metaRef = roomRef(code, "meta");
    const existing = await get(metaRef);
    if (existing.exists()) continue;
    await set(metaRef, {
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      hostUid: user.uid,
      status: "lobby",
      hostOnline: true,
      nextHost: null,
      settings,
    });
    const seats: Seat[] = [0, 1, 2, 3].map((n) => n === 0
      ? { uid: user.uid, name, bot: false, connected: true, auto: false }
      : { uid: null, name: "", bot: false, connected: false, auto: false });
    await Promise.all(seats.map((s, n) => set(roomRef(code, `seats/${n}`), s)));
    rememberRoom(code);
    return code;
  }
  throw new Error("暫時開不了房間，請再試一次");
}

export function parseSeats(raw: Record<string, Partial<Seat>> | null): Seat[] {
  return [0, 1, 2, 3].map((i) => normalizeSeat(raw?.[i] ?? raw?.[String(i)]));
}

export async function writeSeat(code: string, index: number, seat: Seat): Promise<void> {
  await set(roomRef(code, `seats/${index}`), clean(seat));
}

export async function patchSeat(code: string, index: number, patch: Partial<Seat>): Promise<void> {
  await update(roomRef(code, `seats/${index}`), clean(patch));
}

export async function saveSettings(code: string, settings: Settings): Promise<void> {
  await update(roomRef(code, "meta"), { settings, lastActive: serverTimestamp() });
}

export async function publishState(code: string, state: HostState, writeSeats: boolean): Promise<void> {
  await update(roomRef(code, "meta"), {
    lastActive: serverTimestamp(),
    status: state.meta.status,
    hostOnline: true,
    settings: state.meta.settings,
  });
  const hands = handsOf(state);
  const patch: Record<string, unknown> = {
    [roomPath(code, "public")]: clean(toPublic(state)),
    [roomPath(code, "secret")]: clean(toSecret(state)),
  };
  hands.forEach((hand, i) => {
    patch[roomPath(code, `hands/${i}`)] = hand ? clean(hand) : null;
  });
  if (writeSeats) {
    state.seats.forEach((seat, i) => {
      patch[roomPath(code, `seats/${i}`)] = clean(seat);
    });
  }
  await update(ref(db), patch);
}

export async function sendIntent(code: string, intent: Intent): Promise<void> {
  await set(roomRef(code, `intents/${intent.seat}`), clean(intent));
}

/** markOffline 為假時只取消斷線回呼，避免換座後把新坐在原位的人標成離線。 */
export async function bindSeatPresence(code: string, seat: number): Promise<(markOffline: boolean) => void> {
  const connected = roomRef(code, `seats/${seat}/connected`);
  const disc = onDisconnect(connected);
  await disc.set(false);
  await set(connected, true);
  return (markOffline: boolean) => {
    void disc.cancel();
    if (markOffline) void set(connected, false);
  };
}

export async function bindHostPresence(code: string): Promise<() => void> {
  const online = roomRef(code, "meta/hostOnline");
  await onDisconnect(online).set(false);
  await set(online, true);
  return () => {
    void onDisconnect(online).cancel();
    void set(online, false);
  };
}

export async function transferHost(code: string, uid: string): Promise<void> {
  await update(roomRef(code, "meta"), { nextHost: uid, lastActive: serverTimestamp() });
  await update(roomRef(code, "meta"), { hostUid: uid, nextHost: null, lastActive: serverTimestamp() });
}

export async function sweepKnownRooms(codes: string[]): Promise<void> {
  for (const code of codes) {
    try {
      const snap = await get(roomRef(code, "meta/lastActive"));
      const last = snap.val();
      if (typeof last === "number" && roomExpired(last)) await remove(roomRef(code));
    } catch {
      /* 過期房間刪不掉就留著，規則會拒絕繼續寫入 */
    }
  }
}
