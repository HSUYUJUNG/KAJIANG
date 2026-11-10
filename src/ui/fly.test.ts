import { describe, expect, it } from "vitest";
import { nextFlyEvents } from "./TableView";

const ev = (n: number) => ({ n });

describe("打牌動畫在換局後仍要從第一張開始", () => {
  it("同一局只播放新的事件", () => {
    let seen = 0;
    const first = nextFlyEvents([ev(1), ev(2)], seen);
    expect(first.fresh.map((e) => e.n)).toEqual([1, 2]);
    seen = first.seen;
    const more = nextFlyEvents([ev(1), ev(2), ev(3)], seen);
    expect(more.restarted).toBe(false);
    expect(more.fresh.map((e) => e.n)).toEqual([3]);
    expect(more.seen).toBe(3);
  });

  it("新局編號從 1 重來時，不會等它超過上一局才播放", () => {
    let seen = 0;
    for (let n = 1; n <= 22; n++) seen = nextFlyEvents([ev(n)], seen).seen;
    expect(seen).toBe(22);
    const cleared = nextFlyEvents([], seen);
    expect(cleared.restarted).toBe(true);
    expect(cleared.fresh).toEqual([]);
    expect(cleared.seen).toBe(0);
    const again = nextFlyEvents([ev(1)], cleared.seen);
    expect(again.restarted).toBe(false);
    expect(again.fresh.map((e) => e.n)).toEqual([1]);
    const second = nextFlyEvents([ev(1), ev(2)], again.seen);
    expect(second.fresh.map((e) => e.n)).toEqual([2]);
  });

  it("上一局的編號還在畫面上時，新局較小的編號也要整批播放", () => {
    const step = nextFlyEvents([ev(1), ev(2), ev(3)], 40);
    expect(step.restarted).toBe(true);
    expect(step.fresh.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(step.seen).toBe(3);
  });

  it("只留最近 16 張時，不會把已經播過的再播一次", () => {
    const windowed = Array.from({ length: 16 }, (_, i) => ev(i + 10));
    const step = nextFlyEvents(windowed, 20);
    expect(step.restarted).toBe(false);
    expect(step.fresh.map((e) => e.n)).toEqual([21, 22, 23, 24, 25]);
  });
});
