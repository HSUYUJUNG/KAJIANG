import { useEffect, useRef, useState, type ReactNode } from "react";
import { goOffline, goOnline, onDisconnect, onValue, set } from "firebase/database";
import { db, ensureUser, ref } from "../net/firebase";
import { isReturningVisit, shouldShowWaiting, SOFT_CAP } from "../net/capacity";

const ADMITTED = "kajiang.admitted";

function WaitingPage() {
  return (
    <div className="capacity-wait" role="status">
      <div className="capacity-spin" aria-hidden="true" />
      <p>目前測試額滿中，請稍待</p>
    </div>
  );
}

function alreadyInside(): boolean {
  try {
    return isReturningVisit(location.search, sessionStorage.getItem(ADMITTED));
  } catch {
    return isReturningVisit(location.search, null);
  }
}

export function CapacityGate(props: { children: ReactNode }) {
  const forced = new URLSearchParams(location.search).get("full") === "1";
  const admitted = useRef(!forced && alreadyInside());
  const [waiting, setWaiting] = useState(forced);

  useEffect(() => {
    if (forced) return;
    let stop = false;
    const started = Date.now();
    let connected = false;
    let count: number | null = null;

    const hold = () => { void claimPresence().catch(() => undefined); };
    const look = () => {
      if (stop || admitted.current) return;
      const show = shouldShowWaiting({
        admitted: false,
        connected,
        elapsedMs: Date.now() - started,
        presenceCount: count,
      });
      setWaiting(show);
      if (!connected || count === null) return;
      if (count >= SOFT_CAP) {
        goOffline(db);
        return;
      }
      admitted.current = true;
      hold();
      try { sessionStorage.setItem(ADMITTED, "1"); } catch { /* 隱私模式就只記在這次開啟 */ }
      setWaiting(false);
    };

    if (admitted.current) hold();
    const unsubConn = onValue(ref(db, ".info/connected"), (snap) => {
      connected = snap.val() === true;
      if (connected && admitted.current) hold();
      else look();
    });
    const unsubCount = onValue(ref(db, "presence"), (snap) => {
      if (admitted.current) return;
      const raw = snap.val();
      count = raw && typeof raw === "object" ? Object.keys(raw).length : 0;
      look();
    }, () => { count = null; });
    const beat = window.setInterval(() => {
      if (admitted.current) return;
      if (!connected) goOnline(db);
      look();
    }, 1000);

    return () => {
      stop = true;
      unsubConn();
      unsubCount();
      window.clearInterval(beat);
    };
  }, [forced]);

  if (forced || waiting) return <WaitingPage />;
  return props.children;
}

async function claimPresence(): Promise<void> {
  const user = await ensureUser();
  const mine = ref(db, `presence/${user.uid}`);
  await onDisconnect(mine).remove();
  await set(mine, true);
}
