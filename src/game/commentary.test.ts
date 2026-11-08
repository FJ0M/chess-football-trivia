import { describe, expect, it } from "vitest";
import { bucketOf, comment, namesASquare, safeCp, type CommentEvent } from "./commentary";

const names = { white: "Ryan", black: "Ollie" };

describe("commentator", () => {
  it("never strays more than 1.5 pawns from the material, and ignores mate scores", () => {
    // A hanging queen the opponent hasn't taken yet: the engine says +9, the board says level.
    expect(safeCp(900, 0)).toBe(150);
    expect(safeCp(-900, 0)).toBe(-150);
    expect(safeCp(99990, 300)).toBe(300);
    expect(safeCp(null, -200)).toBe(-200);
    expect(safeCp(40, 0)).toBe(40);
  });

  it("buckets the balance of play", () => {
    expect([0, 59, 60, 199, 200, 499, 500].map(bucketOf)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(bucketOf(-250)).toBe(-2);
  });

  it("only calls a side 'cruising' when the material shows it", () => {
    // The engine sees a big win coming (a fork, say) but nothing has been taken yet.
    const c = comment({ event: { kind: "move", color: "white", captured: null, check: false, castle: false }, names, evalCp: 2000, materialCp: 0, prevBucket: 0, rand: () => 0 });
    expect(c.bucket).toBeLessThanOrEqual(1);
    expect(c.text).not.toMatch(/cruising|riot|one-way/i);
  });

  it("never names a square, in thousands of lines", () => {
    const events: CommentEvent[] = [
      { kind: "kickoff" }, { kind: "shootout" }, { kind: "checkmate", winner: "black" }, { kind: "ebk", color: "white" }, { kind: "hot-spot", color: "black" },
      { kind: "power", color: "white", name: "Red Card" }, { kind: "whoami", color: "black", correct: true }, { kind: "whoami", color: "black", correct: false },
      { kind: "answer", color: "white", correct: true, puskas: false, hatTrick: false }, { kind: "answer", color: "white", correct: false, puskas: true, hatTrick: false },
      { kind: "answer", color: "white", correct: true, puskas: false, hatTrick: true },
      { kind: "move", color: "white", captured: "q", check: false, castle: false }, { kind: "move", color: "black", captured: null, check: true, castle: false },
      { kind: "move", color: "black", captured: null, check: false, castle: true }, { kind: "move", color: "white", captured: null, check: false, castle: false },
    ];
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 3000; k++) {
      const event = events[k % events.length];
      const text = comment({ event, names, evalCp: Math.round((rand() - 0.5) * 2000), materialCp: Math.round((rand() - 0.5) * 1200), prevBucket: Math.floor(rand() * 7) - 3, rand }).text;
      expect(namesASquare(text), text).toBe(false);
      expect(text).not.toMatch(/mate in|threat|hanging|watch out|should|best move|undefined/i);
    }
  });
});
