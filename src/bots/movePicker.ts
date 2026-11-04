// Picks a move from the engine's candidate lines using the bot's strength and
// style. Pure apart from the random number generator, so it is easy to test.

import { Chess, normalizeMove } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { makeUci, parseUci } from "chessops/util";
import type { Role } from "chessops/types";
import { MATE_CP, type EngineLine } from "./engine";
import type { ChessStrength, ChessStyle } from "./types";

export type Rng = () => number;

export const PIECE_VALUE: Record<Role, number> = { pawn: 100, knight: 300, bishop: 320, rook: 500, queen: 900, king: 0 };

export function positionFromFen(fen: string): Chess {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

/** Normalises UCI to the chessops convention (castling as king-to-rook). Returns null if illegal. */
export function normaliseUci(pos: Chess, uci: string): string | null {
  const move = parseUci(uci);
  if (!move) return null;
  const norm = normalizeMove(pos, move);
  return pos.isLegal(norm) ? makeUci(norm) : null;
}

export function legalMoves(pos: Chess): string[] {
  const out: string[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const piece = pos.board.get(from);
      const lastRank = pos.turn === "white" ? 7 : 0;
      if (piece?.role === "pawn" && to >> 3 === lastRank) {
        for (const p of ["q", "r", "b", "n"]) out.push(makeUci({ from, to, promotion: charRole(p) }));
      } else out.push(makeUci({ from, to }));
    }
  }
  return out;
}

const charRole = (c: string): Role => ({ q: "queen", r: "rook", b: "bishop", n: "knight" })[c] as Role;

/** Material balance from `color`'s side, in centipawns. */
export function materialBalance(pos: Chess, color: "white" | "black"): number {
  let sum = 0;
  for (const sq of pos.board.occupied) {
    const p = pos.board.get(sq)!;
    sum += (p.color === color ? 1 : -1) * PIECE_VALUE[p.role];
  }
  return sum;
}

export interface MoveFeatures {
  capture: boolean;
  capturedValue: number;
  moverValue: number;
  check: boolean;
  queenMove: boolean;
  castle: boolean;
}

export function moveFeatures(pos: Chess, uci: string): MoveFeatures {
  const move = parseUci(uci)!;
  const empty: MoveFeatures = { capture: false, capturedValue: 0, moverValue: 0, check: false, queenMove: false, castle: false };
  if (!("from" in move)) return empty;
  const mover = pos.board.get(move.from);
  const target = pos.board.get(move.to);
  const castle = mover?.role === "king" && target?.color === mover.color;
  const epCapture = mover?.role === "pawn" && pos.epSquare === move.to;
  const capture = (!!target && target.color !== mover?.color) || epCapture;
  const after = pos.clone();
  after.play(move);
  return {
    capture,
    capturedValue: epCapture ? 100 : capture && target ? PIECE_VALUE[target.role] : 0,
    moverValue: mover ? PIECE_VALUE[mover.role] : 0,
    check: after.isCheck(),
    queenMove: mover?.role === "queen",
    castle,
  };
}

/**
 * Style bonus in centipawns, added to a candidate's score before choosing.
 * `evalCp` is the best line's score from the bot's side.
 */
export function styleBonus(style: ChessStyle, f: MoveFeatures, evalCp: number, fullmoves: number): number {
  switch (style) {
    case "chaotic": {
      // Ollie: grabs every capture, loves an early queen raid and a cheeky check.
      let b = 0;
      if (f.capture) b += 60;
      if (f.queenMove && fullmoves <= 12) b += 50;
      if (f.check) b += 30;
      if (f.castle) b -= 30;
      return b;
    }
    case "balanced": {
      // Ryan: sensible, but turns aggressive once he's ahead.
      if (evalCp > 150) return (f.capture ? 40 : 0) + (f.check ? 35 : 0);
      return f.castle ? 15 : 0;
    }
    case "positional": {
      // Freddie: castles early, avoids pointless checks, trades down when ahead.
      let b = f.castle ? 25 : 0;
      if (f.check) b -= 10;
      if (evalCp > 100 && f.capture && Math.abs(f.capturedValue - f.moverValue) <= 60) b += 40;
      return b;
    }
  }
}

export interface PickContext {
  pos: Chess;
  lines: EngineLine[];
  /** Moves the bot may play (normalised UCI). */
  allowed: string[];
  strength: ChessStrength;
  style: ChessStyle;
  rng: Rng;
  /** Manager's Tip: take the top line. */
  forceBest?: boolean;
}

export interface Pick {
  uci: string;
  scoreCp: number;
  /** How much worse than the engine's top line, in centipawns (0 = top move). */
  lossCp: number;
  blunder: boolean;
}

export function pickMove(ctx: PickContext): Pick {
  const { pos, strength, style, rng } = ctx;
  const allowedSet = new Set(ctx.allowed);
  const lines = ctx.lines
    .map((l) => ({ ...l, uci: normaliseUci(pos, l.uci) ?? "" }))
    .filter((l) => l.uci && allowedSet.has(l.uci));
  const best = lines[0];

  if (!best) {
    const uci = ctx.allowed[Math.floor(rng() * ctx.allowed.length)];
    return { uci, scoreCp: 0, lossCp: 0, blunder: false };
  }
  if (ctx.forceBest || strength.temperatureCp <= 0 && strength.blunderRate <= 0) {
    return { uci: best.uci, scoreCp: best.scoreCp, lossCp: 0, blunder: false };
  }

  // Never blunder out of a mate we can see, so wins still get finished (badly).
  const mateFound = best.scoreCp > MATE_CP - 100;
  if (!mateFound && rng() < strength.blunderRate && ctx.allowed.length > 1) {
    const uci = ctx.allowed[Math.floor(rng() * ctx.allowed.length)];
    const known = lines.find((l) => l.uci === uci);
    return { uci, scoreCp: known?.scoreCp ?? best.scoreCp - 300, lossCp: known ? best.scoreCp - known.scoreCp : 300, blunder: true };
  }

  const fullmoves = pos.fullmoves;
  const weights = lines.map((l) => {
    if (l.scoreCp > MATE_CP - 100 && l === best) return Infinity;
    const diff = Math.max(-2000, l.scoreCp - best.scoreCp);
    const bonus = styleBonus(style, moveFeatures(pos, l.uci), best.scoreCp, fullmoves);
    const t = Math.max(1, strength.temperatureCp);
    return Math.exp((diff + bonus) / t);
  });
  if (weights.some((w) => w === Infinity)) return { uci: best.uci, scoreCp: best.scoreCp, lossCp: 0, blunder: false };
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  let i = 0;
  for (; i < weights.length - 1; i++) {
    r -= weights[i];
    if (r <= 0) break;
  }
  const chosen = lines[i];
  return { uci: chosen.uci, scoreCp: chosen.scoreCp, lossCp: best.scoreCp - chosen.scoreCp, blunder: false };
}
