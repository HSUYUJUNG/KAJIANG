import { describe, expect, it } from "vitest";
import { CONNECT_WAIT_MS, shouldShowWaiting, SOFT_CAP } from "./capacity";
import { roomIsStale, staleActivityCodes } from "./host";

describe("額滿等待", () => {
  it("慢一點載入先不當額滿，已進場的人不會被趕去等待頁", () => {
    expect(shouldShowWaiting({ admitted: false, connected: false, elapsedMs: 2000, presenceCount: null })).toBe(false);
    expect(shouldShowWaiting({ admitted: false, connected: false, elapsedMs: CONNECT_WAIT_MS, presenceCount: null })).toBe(true);
    expect(shouldShowWaiting({ admitted: true, connected: false, elapsedMs: 60_000, presenceCount: SOFT_CAP })).toBe(false);
  });

  it("連上之後人數接近上限就等待", () => {
    expect(shouldShowWaiting({ admitted: false, connected: true, elapsedMs: 100, presenceCount: SOFT_CAP - 1 })).toBe(false);
    expect(shouldShowWaiting({ admitted: false, connected: true, elapsedMs: 100, presenceCount: SOFT_CAP })).toBe(true);
  });
});

describe("過期房間", () => {
  const now = 2_000_000_000_000;
  const day = 24 * 60 * 60 * 1000;

  it("一天內的房間留下，超過一天或沒有時間戳的刪掉", () => {
    expect(roomIsStale({ lastActive: now - 1000, createdAt: now - day * 3 }, now)).toBe(false);
    expect(roomIsStale({ lastActive: now - day - 1, createdAt: now }, now)).toBe(true);
    expect(roomIsStale({ createdAt: now - day - 1 }, now)).toBe(true);
    expect(roomIsStale({ createdAt: now - 1000 }, now)).toBe(false);
    expect(roomIsStale({}, now)).toBe(true);
    expect(roomIsStale(null, now)).toBe(false);
  });

  it("查詢只挑出過期代碼，而且最多 50 間", () => {
    const index: Record<string, number> = { FRESH: now - 1000, OLD: now - day - 5, OLDER: 1 };
    expect(staleActivityCodes(index, now)).toEqual(["OLDER", "OLD"]);
    const many: Record<string, number> = {};
    for (let i = 0; i < 60; i++) many["R" + i] = i;
    expect(staleActivityCodes(many, now)).toHaveLength(50);
  });
});
