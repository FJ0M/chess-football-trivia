// Chess960 start positions, numbered 0 to 959 with the standard Scharnagl scheme.
// Position 518 is the normal chess start.

const KNIGHTS = ["NN---", "N-N--", "N--N-", "N---N", "-NN--", "-N-N-", "-N--N", "--NN-", "--N-N", "---NN"];

/** The white back rank for a Chess960 number, e.g. 518 -> "RNBQKBNR". */
export function backRank(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 959) throw new Error(`Chess960 number out of range: ${n}`);
  const rank: (string | null)[] = Array(8).fill(null);
  let r = n;
  rank[(r % 4) * 2 + 1] = "B"; r = Math.floor(r / 4);
  rank[(r % 4) * 2] = "B"; r = Math.floor(r / 4);
  const empties = () => rank.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  rank[empties()[r % 6]] = "Q"; r = Math.floor(r / 6);
  const pattern = KNIGHTS[r];
  const e = empties();
  for (let i = 0; i < 5; i++) if (pattern[i] === "N") rank[e[i]] = "N";
  const rest = empties();
  rank[rest[0]] = "R"; rank[rest[1]] = "K"; rank[rest[2]] = "R";
  return rank.join("");
}

/** Full starting FEN for a Chess960 number (X-FEN castling, which chessops and Stockfish both read). */
export function startFen(n: number): string {
  const w = backRank(n);
  return `${w.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${w} w KQkq - 0 1`;
}

export const STANDARD_POSITION = 518;

export function randomPosition(rng: () => number = Math.random): number {
  return Math.floor(rng() * 960);
}
