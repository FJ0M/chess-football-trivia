import { describe, expect, it } from "vitest";
import { tipFor } from "./tips";
import { newGame } from "./rules";
import type { Phase } from "./match";

const g0 = newGame({ mode: "bot", trivia: true, timed: false, chess960: false, position: 518 },
  { white: { name: "You", kind: "human", club: null }, black: { name: "Pawny", kind: "bot", botId: "pawny", club: null } });
const move: Phase = { kind: "move" };

describe("first-game tips", () => {
  it("nothing to say at kick-off", () => {
    expect(tipFor(g0, move, "white", new Set())).toBeNull();
  });
  it("explains the cards when you first pick, and only once", () => {
    const cards: Phase = { kind: "cards", color: "white", cards: [], bonus: false, landed: null, label: "" };
    expect(tipFor(g0, cards, "white", new Set())).toBe("cards");
    expect(tipFor(g0, cards, "white", new Set(["cards"]))).toBeNull();
    // Not when it's the bot picking.
    expect(tipFor(g0, { ...cards, color: "black" }, "white", new Set())).toBeNull();
  });
  it("points at power-ups once you have Form, and at Hot Spots when they arrive", () => {
    const g = { ...g0, hotSpots: ["e4"], players: { ...g0.players, white: { ...g0.players.white, form: 2 } } };
    expect(tipFor(g, move, "white", new Set())).toBe("form");
    expect(tipFor(g, move, "white", new Set(["form"]))).toBe("hot-spots");
  });
  it("no tips in plain chess", () => {
    const g = { ...g0, options: { ...g0.options, trivia: false }, hotSpots: ["e4"] };
    expect(tipFor(g, move, "white", new Set())).toBeNull();
  });
});
