import { describe, expect, it } from "vitest";
import { material, materialCp } from "./material";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("material", () => {
  it("is 0-0 with empty benches at kick-off", () => {
    expect(material({ white: [], black: [] })).toEqual({ bench: { white: [], black: [] }, score: { white: 0, black: 0 } });
    expect(materialCp(START)).toBe(0);
  });

  it("puts taken pieces on the taker's bench, best first, and scores them", () => {
    // Black lost a pawn then a knight (White took them); White lost a pawn.
    const m = material({ white: ["p"], black: ["p", "n"] });
    expect(m.bench.white).toEqual(["n", "p"]);
    expect(m.bench.black).toEqual(["p"]);
    expect(m.score).toEqual({ white: 4, black: 1 });
  });

  it("reads the material lead from the board, promotions included", () => {
    expect(materialCp("r1bqkbnr/ppp1pppp/8/8/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 4")).toBe(300);
    // White's h-pawn became a second queen and its h1 rook is gone: +9 -5 -1.
    expect(materialCp("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNQ w Qkq - 0 1")).toBe(300);
  });
});
