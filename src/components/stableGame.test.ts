import { describe, expect, it } from "vitest";
import { sameApartFromClocks } from "./GameScreen";
import { newGame, setClock, usePowerUp } from "../game/rules";

const g = newGame({ mode: "local", trivia: true, timed: true, minutes: 10, chess960: false, position: 518 },
  { white: { name: "A", kind: "human", club: null }, black: { name: "B", kind: "human", club: null } }, () => 0.3);

describe("sameApartFromClocks", () => {
  it("ignores a clock tick", () => {
    expect(sameApartFromClocks(g, setClock(g, "white", 1234))).toBe(true);
  });
  it("notices anything else", () => {
    expect(sameApartFromClocks(g, { ...g, fen: g.fen.replace(" w ", " b ") })).toBe(false);
    const rich = { ...g, players: { ...g.players, white: { ...g.players.white, form: 12, cooldowns: { ...g.players.white.cooldowns, "park-the-bus": 0 } } } };
    expect(sameApartFromClocks(rich, usePowerUp(rich, "park-the-bus").state)).toBe(false);
  });
});
