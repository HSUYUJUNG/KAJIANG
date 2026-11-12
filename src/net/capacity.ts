/** 接近免費方案 100 條連線時先擋住，留一點空位給已經在打牌的人重連。 */
export const SOFT_CAP = 95;
/** 剛打開時先等這段時間，避免把慢網路當成額滿。 */
export const CONNECT_WAIT_MS = 9000;

export function shouldShowWaiting(opts: {
  admitted: boolean;
  connected: boolean;
  elapsedMs: number;
  presenceCount: number | null;
  forced?: boolean;
}): boolean {
  if (opts.forced) return true;
  if (opts.admitted) return false;
  if (opts.connected && opts.presenceCount !== null && opts.presenceCount >= SOFT_CAP) return true;
  if (!opts.connected && opts.elapsedMs >= CONNECT_WAIT_MS) return true;
  return false;
}

export function isReturningVisit(search: string, admittedFlag: string | null): boolean {
  const room = new URLSearchParams(search).get("room");
  return !!room || admittedFlag === "1";
}
