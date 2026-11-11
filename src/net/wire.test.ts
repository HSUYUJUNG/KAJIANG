import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { newGame, projectHand, projectPublic, type Game } from "../logic/engine";
import { TableView, type TableModel } from "../ui/TableView";
import { normalizeAnswers, normalizeGame, normalizeHand, normalizeRobs, normalizeView } from "./wire";

/** 模仿 Realtime Database：丟掉 null、空陣列，以及陣列裡的 null。 */
function firebaseStrip(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value.map((item) => firebaseStrip(item));
    if (items.every((item) => item === undefined)) return undefined;
    if (items.some((item) => item === undefined)) {
      const obj: Record<string, unknown> = {};
      items.forEach((item, i) => {
        if (item !== undefined) obj[String(i)] = item;
      });
      return Object.keys(obj).length ? obj : undefined;
    }
    return items;
  }
  if (typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = firebaseStrip(item);
      if (next !== undefined) obj[key] = next;
    }
    return Object.keys(obj).length ? obj : undefined;
  }
  return value;
}

function guestModel(g: Game, seat: number, broken: boolean): TableModel {
  const view = (broken ? firebaseStrip(projectPublic(g)) : normalizeView(firebaseStrip(projectPublic(g)) as never)) as ReturnType<typeof projectPublic>;
  const hand = (broken ? firebaseStrip(projectHand(g, seat, null)) : normalizeHand(firebaseStrip(projectHand(g, seat, null)) as never)) as ReturnType<typeof projectHand>;
  return {
    me: seat,
    names: view.names,
    scores: [0, 0, 0, 0],
    chips: [2000, 2000, 2000, 2000],
    change: null,
    dealer: view.dealer,
    streak: 0,
    wind: 0,
    handNo: 0,
    wallLeft: view.wallLeft,
    phase: view.phase,
    turn: view.turn,
    players: view.players,
    myHand: hand?.tiles ?? [],
    myDrawn: hand?.drawn ?? null,
    myMelds: hand?.melds ?? [],
    recent: view.recent,
    last: view.last ?? null,
    prompt: hand?.prompt ?? null,
    log: view.log ?? [],
    ev: view.ev ?? [],
    reveal: !!view.reveal,
  };
}

describe("Firebase 讀回的牌桌", () => {
  const game = newGame(() => 0.2, 1, { humans: [0, 1], names: ["春", "夏", "電腦", "電腦"] });

  it("把被刪掉的空陣列補回來", () => {
    const view = projectPublic(game);
    const hand = projectHand(game, 1, null);
    const storedView = firebaseStrip(view) as { players: Array<{ discards?: unknown; melds?: unknown }>; ev?: unknown; wait?: unknown };
    const storedHand = firebaseStrip(hand) as { prompt?: { kans?: unknown }; melds?: unknown };
    expect(storedView.players[0].discards).toBeUndefined();
    expect(storedView.players[0].melds).toBeUndefined();
    expect(storedView.ev).toBeUndefined();
    expect(storedView.wait).toBeUndefined();
    expect(storedHand.prompt?.kans).toBeUndefined();
    expect(storedHand.melds).toBeUndefined();

    expect(normalizeView(storedView as never)).toEqual(view);
    expect(normalizeHand(storedHand as never)).toEqual(hand);
    expect(normalizeGame(firebaseStrip(game) as never)).toEqual(game);
  });

  it("空洞的叫牌答案補回四個位子", () => {
    expect(normalizeAnswers({ 1: { kind: "pass" } })).toEqual([null, { kind: "pass" }, null, null]);
    expect(normalizeRobs({ 2: false })).toEqual([null, null, false, null]);
  });

  it("客人用缺陣列的資料渲染也不會拋錯", () => {
    const html = renderToStaticMarkup(createElement(TableView, { model: guestModel(game, 1, true), anim: "off" }));
    expect(html).toContain("夏");
    expect(html).toContain("點牌選取，再點一次打出");
    const fixed = renderToStaticMarkup(createElement(TableView, { model: guestModel(game, 1, false), anim: "off" }));
    expect(fixed).toContain("aria-label");
  });
});
