import { endAt, get, limitToFirst, onDisconnect, orderByValue, query, remove, set, update } from "firebase/database";
import { db, ensureUser, knownRooms, ref, rememberRoom, roomPath, roomRef, serverTimestamp } from "./firebase";
import {
  handsOf,
  makeCode,
  normalizeSeat,
  ROOM_TTL_MS,
  roomIsStale,
  staleActivityCodes,
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

export async function markRoomActivity(code: string): Promise<void> {
  const ts = serverTimestamp();
  await update(ref(db), {
    [roomPath(code, "meta/lastActive")]: ts,
    [`roomActivity/${code}`]: ts,
  });
}

export async function createRoom(name: string, settings: Settings): Promise<string> {
  const user = await ensureUser();
  void cleanupStaleRooms();
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
    await set(ref(db, `roomActivity/${code}`), serverTimestamp());
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
  void markRoomActivity(code).catch(() => undefined);
}

export async function patchSeat(code: string, index: number, patch: Partial<Seat>): Promise<void> {
  await update(roomRef(code, `seats/${index}`), clean(patch));
  void markRoomActivity(code).catch(() => undefined);
}

export async function saveSettings(code: string, settings: Settings): Promise<void> {
  await update(roomRef(code, "meta"), { settings, lastActive: serverTimestamp() });
  void set(ref(db, `roomActivity/${code}`), serverTimestamp()).catch(() => undefined);
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
  void set(ref(db, `roomActivity/${code}`), serverTimestamp()).catch(() => undefined);
}

export async function sendIntent(code: string, intent: Intent): Promise<void> {
  await set(roomRef(code, `intents/${intent.seat}`), clean(intent));
  void markRoomActivity(code).catch(() => undefined);
}

/**
 * 連線中斷時把這個欄位設成 false。重新連上要再登記一次，
 * 否則手機把分頁切到背景後，回來也不會把自己標回線上。
 */
export function presenceFlag(target: ReturnType<typeof roomRef>): {
  arm: () => Promise<void>;
  release: (markOffline: boolean) => Promise<void>;
} {
  let chain = Promise.resolve();
  const enqueue = (job: () => Promise<void>) => {
    const run = chain.then(job);
    chain = run.catch(() => undefined);
    return run;
  };
  return {
    arm() {
      return enqueue(async () => {
        await onDisconnect(target).cancel();
        await onDisconnect(target).set(false);
        await set(target, true);
      });
    },
    release(markOffline: boolean) {
      return enqueue(async () => {
        await onDisconnect(target).cancel();
        if (markOffline) await set(target, false);
      });
    },
  };
}

/** markOffline 為假時只取消斷線回呼，避免換座後把新坐在原位的人標成離線。 */
export async function bindSeatPresence(code: string, seat: number): Promise<(markOffline: boolean) => void> {
  const flag = presenceFlag(roomRef(code, `seats/${seat}/connected`));
  await flag.arm();
  return (markOffline: boolean) => {
    void flag.release(markOffline);
  };
}

export async function bindHostPresence(code: string): Promise<() => void> {
  const flag = presenceFlag(roomRef(code, "meta/hostOnline"));
  await flag.arm();
  return () => {
    void flag.release(true);
  };
}

export async function transferHost(code: string, uid: string): Promise<void> {
  await update(roomRef(code, "meta"), { nextHost: uid, lastActive: serverTimestamp() });
  await update(roomRef(code, "meta"), { hostUid: uid, nextHost: null, lastActive: serverTimestamp() });
}

export async function sweepKnownRooms(codes: string[]): Promise<void> {
  for (const code of codes) {
    try {
      const snap = await get(roomRef(code, "meta"));
      if (!roomIsStale(snap.val())) continue;
      await remove(roomRef(code));
      await remove(ref(db, `roomActivity/${code}`));
    } catch {
      /* 過期房間刪不掉就留著，規則會拒絕繼續寫入 */
    }
  }
}

/** 清掉 24 小時沒活動的房間。進行中的房間時間戳還新，刪不掉。 */
export async function cleanupStaleRooms(): Promise<void> {
  const cutoff = Date.now() - ROOM_TTL_MS - 1;
  try {
    const snap = await get(query(ref(db, "roomActivity"), orderByValue(), endAt(cutoff), limitToFirst(50)));
    const codes = staleActivityCodes(snap.val(), Date.now());
    await Promise.all(codes.map(async (code) => {
      await remove(roomRef(code)).catch(() => undefined);
      await remove(ref(db, `roomActivity/${code}`)).catch(() => undefined);
    }));
  } catch {
    /* 還沒登入或規則不允許查詢時略過 */
  }
  await sweepKnownRooms(knownRooms());
}
