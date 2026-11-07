// Pass and Play handicap: piece odds from the stronger player, and a Form boost for the weaker one.
// The Elo values below are rough starting guesses, to be tuned in playtesting.

import type { Color } from "./types";

export type OddsPiece = "none" | "p" | "n" | "r" | "q";
export const ODDS: OddsPiece[] = ["none", "p", "n", "r", "q"];
export const FORM_BOOSTS = [1, 1.25, 1.5, 2] as const;
export type FormBoost = (typeof FORM_BOOSTS)[number];

export interface Handicap {
  /** The player who gets the help. The other player gives the piece odds. */
  weaker: Color;
  odds: OddsPiece;
  /** Multiplies the Form the weaker player earns from right answers. */
  formBoost: FormBoost;
}

export const ODDS_NAME: Record<OddsPiece, string> = { none: "No piece", p: "Pawn", n: "Knight", r: "Rook", q: "Queen" };
export const ODDS_POINTS: Record<OddsPiece, number> = { none: 0, p: 1, n: 3, r: 5, q: 9 };
/** Roughly what each handicap is worth in Elo. */
export const ODDS_ELO: Record<OddsPiece, number> = { none: 0, p: 150, n: 350, r: 550, q: 900 };
export const BOOST_ELO: Record<FormBoost, number> = { 1: 0, 1.25: 50, 1.5: 100, 2: 200 };

export const isActive = (h: Handicap | null | undefined): h is Handicap => !!h && (h.odds !== "none" || h.formBoost !== 1);

/**
 * Takes the odds piece off the stronger player's side of a starting FEN: the f-pawn, the queenside knight,
 * the queenside rook (and its castling right) or the queen. Works for Chess960 back ranks too.
 */
export function applyOdds(fen: string, h: Handicap): string {
  if (h.odds === "none") return fen;
  const giver: Color = h.weaker === "white" ? "black" : "white";
  const [board, turn, castling, ...rest] = fen.split(" ");
  const rows = board.split("/").map(expand);
  const back = giver === "white" ? 7 : 0;
  const pawns = giver === "white" ? 6 : 1;
  const ch = (c: string) => (giver === "white" ? c.toUpperCase() : c);
  let rights = castling;
  if (h.odds === "p") rows[pawns][5] = ".";
  else {
    const row = rows[back];
    const king = row.indexOf(ch("k"));
    // Queenside first: the leftmost knight or rook; the queen wherever it is.
    const at = h.odds === "q" ? row.indexOf(ch("q")) : row.indexOf(ch(h.odds));
    if (at >= 0) row[at] = ".";
    if (h.odds === "r" && at >= 0 && at < king) {
      rights = rights.replace(giver === "white" ? "Q" : "q", "") || "-";
    }
  }
  return [rows.map(compress).join("/"), turn, rights, ...rest].join(" ");
}

function expand(row: string): string[] {
  return row.replace(/\d/g, (d) => ".".repeat(Number(d))).split("");
}
function compress(cells: string[]): string {
  return cells.join("").replace(/\.+/g, (m) => String(m.length));
}

/**
 * Form for a right answer with the boost. Fractions carry over to the next right answer,
 * so x1.25 on four 1-Form answers gives 5, not 4.
 */
export function boostForm(gained: number, boost: number, carry: number): { gained: number; carry: number } {
  const total = gained * boost + carry;
  const whole = Math.floor(total + 1e-9);
  return { gained: whole, carry: Math.max(0, total - whole) };
}

/**
 * A suggested handicap from two chess ratings: the biggest piece the gap covers,
 * then a Form boost for what's left over (if it's worth one).
 */
export function suggestHandicap(white: number, black: number): Handicap | null {
  const gap = Math.abs(white - black);
  if (!Number.isFinite(gap) || gap < 75) return null;
  const weaker: Color = white < black ? "white" : "black";
  const odds = [...ODDS].reverse().find((o) => ODDS_ELO[o] <= gap + 50) ?? "none";
  const left = gap - ODDS_ELO[odds];
  const formBoost = [...FORM_BOOSTS].reverse().find((b) => BOOST_ELO[b] <= left + 25) ?? 1;
  return { weaker, odds, formBoost };
}

export function describeHandicap(h: Handicap, names: Record<Color, string>): string {
  const giver: Color = h.weaker === "white" ? "black" : "white";
  const parts: string[] = [];
  if (h.odds !== "none") parts.push(`${names[giver]} starts without ${h.odds === "p" ? "the f-pawn" : `a ${ODDS_NAME[h.odds].toLowerCase()}`}`);
  if (h.formBoost !== 1) parts.push(`${names[h.weaker]} earns x${h.formBoost} Form`);
  return parts.join(" · ");
}
