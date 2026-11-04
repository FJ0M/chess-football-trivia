// Which power-up a bot buys before its move, and what it targets.
// The game validates every pick and ignores an invalid one, so this only has
// to make sensible choices, not enforce the rules.

import type { Chess } from "chessops/chess";
import type { Color, Square } from "chessops/types";
import { makeSquare, opposite, squareRank } from "chessops/util";
import { PIECE_VALUE, positionFromFen, type Rng } from "./movePicker";
import type { BotProfile, PowerUpChoice, PowerUpId, PowerUpRequest } from "./types";

/** Chance per turn that the bot buys something when it can. Keeps bots from spending every single turn. */
const SPEND_CHANCE = 0.6;

const relRank = (sq: Square, color: Color) => (color === "white" ? squareRank(sq) : 7 - squareRank(sq));

function piecesOf(pos: Chess, color: Color, role?: string): Square[] {
  const out: Square[] = [];
  for (const sq of pos.board[color]) {
    const p = pos.board.get(sq)!;
    if (!role || p.role === role) out.push(sq);
  }
  return out;
}

function checkers(pos: Chess): Set<Square> {
  const king = pos.board.kingOf(pos.turn);
  if (king === undefined) return new Set();
  return new Set(pos.kingAttackers(king, opposite(pos.turn), pos.board.occupied));
}

/** Enemy piece worth freezing: the most valuable non-king piece that isn't giving check. */
function tacticalFoulTarget(pos: Chess, me: Color): Square | undefined {
  const giving = checkers(pos);
  return piecesOf(pos, opposite(me))
    .filter((sq) => pos.board.get(sq)!.role !== "king" && !giving.has(sq))
    .sort((a, b) => PIECE_VALUE[pos.board.get(b)!.role] - PIECE_VALUE[pos.board.get(a)!.role])[0];
}

/** Enemy pawn to send off: the most advanced one that is still allowed (not on its 6th or 7th rank). */
function redCardTarget(pos: Chess, me: Color): Square | undefined {
  const them = opposite(me);
  return piecesOf(pos, them, "pawn")
    .filter((sq) => relRank(sq, them) < 5)
    .sort((a, b) => relRank(b, them) - relRank(a, them))[0];
}

/** Own pawn to upgrade: the most advanced, central-ish one. */
function superSubTarget(pos: Chess, me: Color): Square | undefined {
  return piecesOf(pos, me, "pawn")
    .filter((sq) => relRank(sq, me) < 6)
    .sort((a, b) => relRank(b, me) - relRank(a, me) || Math.abs(3.5 - (a & 7)) - Math.abs(3.5 - (b & 7)))[0];
}

/** Own pawn for a two-square dash: furthest forward with both squares ahead empty. */
function counterAttackTarget(pos: Chess, me: Color): Square | undefined {
  const step = me === "white" ? 8 : -8;
  return piecesOf(pos, me, "pawn")
    .filter((sq) => {
      const r = relRank(sq, me);
      if (r >= 5) return false; // can't promote with it
      return !pos.board.occupied.has(sq + step) && !pos.board.occupied.has(sq + 2 * step);
    })
    .sort((a, b) => relRank(b, me) - relRank(a, me))[0];
}

function choose(id: PowerUpId, pos: Chess, me: Color): PowerUpChoice | null {
  const sq = (s: Square | undefined) => (s === undefined ? undefined : makeSquare(s));
  switch (id) {
    case "tactical-foul": {
      const t = tacticalFoulTarget(pos, me);
      return t === undefined ? null : { id, target: sq(t) };
    }
    case "red-card": {
      const t = redCardTarget(pos, me);
      return t === undefined ? null : { id, target: sq(t) };
    }
    case "super-sub": {
      const t = superSubTarget(pos, me);
      return t === undefined ? null : { id, target: sq(t) };
    }
    case "counter-attack": {
      const t = counterAttackTarget(pos, me);
      return t === undefined ? null : { id, target: sq(t) };
    }
    case "formation-change":
    case "substitution":
      // Needs real board judgement to be worth it; bots leave these alone for now.
      return null;
    default:
      return { id };
  }
}

export function choosePowerUp(profile: BotProfile, req: PowerUpRequest, rng: Rng, lastMoveLossCp: number): PowerUpChoice | null {
  if (req.available.length === 0) return null;
  const pos = positionFromFen(req.fen);
  const me = pos.turn;
  const has = new Map(req.available.map((a) => [a.id, a.cost]));
  const drop = req.lastMoveEvalDrop ?? lastMoveLossCp;

  // Emergencies first.
  if (has.has("var-review") && drop >= 250 && (profile.id !== "freddie" || drop >= 400)) return { id: "var-review" };
  if (has.has("fergie-time") && req.timed && (req.clockMs ?? Infinity) < 60000) return { id: "fergie-time" };
  if (req.inCheck) return null;

  if (rng() > SPEND_CHANCE) return null;

  for (const id of profile.favouritePowerUps) {
    if (!has.has(id)) continue;
    if (id === "var-review") continue; // only after a blunder (above)
    const cost = has.get(id)!;
    // Freddie keeps a reserve for the big ones.
    if (profile.saveFor && !profile.saveFor.ids.includes(id) && req.form - cost < profile.saveFor.reserve) continue;
    // Park the Bus only when under pressure.
    if (id === "park-the-bus" && (req.evalCp ?? 0) > -150) continue;
    // Golden Boot only if there is something to take soon; keep it simple: when ahead or level.
    if (id === "golden-boot" && (req.evalCp ?? 0) < -200) continue;
    const pick = choose(id as PowerUpId, pos, me);
    if (pick) return pick;
  }
  return null;
}
