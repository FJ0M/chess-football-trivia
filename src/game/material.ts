// The material count as a football score: each side's "bench" holds the pieces it has
// taken off the opponent, and the scoreline is the points value of those pieces (3-1).

import type { Color } from "./types";

export type BenchRole = "q" | "r" | "b" | "n" | "p";
export const PIECE_POINTS: Record<BenchRole, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const START: Record<BenchRole, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };
const ORDER: BenchRole[] = ["q", "r", "b", "n", "p"];

export interface Material {
  /** Pieces each side has taken, best first: bench.white = Black's pieces that White took (or sent off). */
  bench: Record<Color, BenchRole[]>;
  /** Points of the pieces each side has taken. */
  score: Record<Color, number>;
}

/** Counts each side's pieces in a FEN. */
function counts(fen: string): Record<Color, Record<BenchRole, number>> {
  const out = { white: { q: 0, r: 0, b: 0, n: 0, p: 0 }, black: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
  for (const ch of fen.split(" ")[0]) {
    const role = ch.toLowerCase() as BenchRole;
    if (!(role in START)) continue;
    out[ch === role ? "black" : "white"][role]++;
  }
  return out;
}

/**
 * The benches and scoreline from the game's list of lost pieces (`captured[victim]`), which
 * the rules keep up to date through captures, Red Cards and substitutions.
 */
export function material(captured: Record<Color, string[]>): Material {
  const sort = (rs: string[]) => rs.filter((r): r is BenchRole => r in START).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const bench = { white: sort(captured.black), black: sort(captured.white) };
  const pts = (rs: BenchRole[]) => rs.reduce((n, r) => n + PIECE_POINTS[r], 0);
  return { bench, score: { white: pts(bench.white), black: pts(bench.black) } };
}

/** White's material lead in centipawns (negative when Black is ahead), counting promotions too. */
export function materialCp(fen: string): number {
  const c = counts(fen);
  const side = (s: Record<BenchRole, number>) => ORDER.reduce((n, r) => n + s[r] * PIECE_POINTS[r], 0);
  return (side(c.white) - side(c.black)) * 100;
}
