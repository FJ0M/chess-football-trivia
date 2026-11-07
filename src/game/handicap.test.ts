import { describe, expect, it } from "vitest";
import { applyOdds, boostForm, suggestHandicap, type Handicap } from "./handicap";
import { startFen } from "./chess960";
import { material, newGame, applyAnswer } from "./rules";

const START = startFen(518);
const h = (o: Partial<Handicap>): Handicap => ({ weaker: "black", odds: "none", formBoost: 1, ...o });

describe("piece odds", () => {
  it("takes the piece off the stronger player's side", () => {
    expect(applyOdds(START, h({ odds: "p" }))).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1");
    expect(applyOdds(START, h({ odds: "n" }))).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1");
    expect(applyOdds(START, h({ odds: "r" }))).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1");
    expect(applyOdds(START, h({ odds: "q", weaker: "white" }))).toBe("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(applyOdds(START, h({ odds: "r", weaker: "white" }))).toBe("1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1");
  });

  it("works on a Chess960 back rank", () => {
    const fen = startFen(0); // bbqnnrkr
    expect(applyOdds(fen, h({ odds: "r" })).split(" ")[0].split("/")[7]).toBe("BBQNN1KR");
    expect(applyOdds(fen, h({ odds: "n" })).split(" ")[0].split("/")[7]).toBe("BBQ1NRKR");
  });

  it("is applied at kick-off", () => {
    const g = newGame({ mode: "local", trivia: true, timed: false, chess960: false, position: 518, handicap: h({ odds: "q" }) },
      { white: { name: "A", kind: "human", club: null }, black: { name: "B", kind: "human", club: null } }, () => 0.5);
    expect(material(g.fen)).toEqual({ white: 30, black: 39 });
  });
});

describe("Form boost", () => {
  it("carries fractions so nothing is lost", () => {
    let carry = 0, total = 0;
    for (let i = 0; i < 4; i++) { const r = boostForm(1, 1.25, carry); total += r.gained; carry = r.carry; }
    expect(total).toBe(5);
    expect(boostForm(3, 2, 0)).toEqual({ gained: 6, carry: 0 });
  });

  it("boosts only the weaker player's right answers, and odds don't trigger catch-up for the giver", () => {
    const g = newGame({ mode: "local", trivia: true, timed: false, chess960: false, position: 518, handicap: h({ odds: "n", formBoost: 2 }) },
      { white: { name: "A", kind: "human", club: null }, black: { name: "B", kind: "human", club: null } }, () => 0.5);
    const ans = (color: "white" | "black") => applyAnswer(g, { color, correct: true, difficulty: "medium", puskas: false, bonus: false, ms: 9000, landed: "e4" } as never);
    expect(ans("black").formGained).toBe(4);
    expect(ans("white").formGained).toBe(2);
  });
});

describe("suggested handicap", () => {
  it("picks odds and a boost from the rating gap", () => {
    expect(suggestHandicap(1200, 1230)).toBeNull();
    expect(suggestHandicap(1000, 1150)).toEqual({ weaker: "white", odds: "p", formBoost: 1 });
    expect(suggestHandicap(1600, 1200)).toEqual({ weaker: "black", odds: "n", formBoost: 1.25 });
    expect(suggestHandicap(800, 1800)).toEqual({ weaker: "white", odds: "q", formBoost: 1.5 });
  });
});
