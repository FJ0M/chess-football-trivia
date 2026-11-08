// The commentator: one line of text under the board after each event, like a live text
// commentary. It reacts to the engine's evaluation, but it must never give a hint, so:
//  - it only ever talks about what has already happened (a capture, a check, an answer),
//    never about squares, pieces under attack, threats or what to play next;
//  - the evaluation it reads is clamped to within 1.5 pawns of the material on the board
//    (safeCp). If the engine sees something big that hasn't happened yet (a hanging queen,
//    a fork, a mate coming) the commentator only describes the material, so it can't tip
//    anyone off;
//  - mate scores are never mentioned until the game is actually over.

import type { Color } from "./types";

export type CommentEvent =
  | { kind: "kickoff" }
  | { kind: "move"; color: Color; captured: string | null; check: boolean; castle: boolean }
  | { kind: "power"; color: Color; name: string }
  | { kind: "answer"; color: Color; correct: boolean; puskas: boolean; hatTrick: boolean }
  | { kind: "whoami"; color: Color; correct: boolean }
  | { kind: "hot-spot"; color: Color }
  | { kind: "ebk"; color: Color }
  | { kind: "shootout" }
  | { kind: "checkmate"; winner: Color };

export interface CommentInput {
  event: CommentEvent;
  names: Record<Color, string>;
  /** Engine score from White's side in centipawns, or null when there's none. */
  evalCp: number | null;
  /** White's material lead in centipawns. */
  materialCp: number;
  /** The bucket the last line was based on, to spot a swing. */
  prevBucket: number | null;
  rand?: () => number;
}

export interface Comment { text: string; bucket: number }

/** How far the evaluation may stray from the material before the commentator ignores it. */
export const HINT_MARGIN_CP = 150;

/** The evaluation the commentator may use: never more than HINT_MARGIN_CP away from the material, and never a mate score. */
export function safeCp(evalCp: number | null, materialCp: number): number {
  if (evalCp === null || !Number.isFinite(evalCp) || Math.abs(evalCp) >= 5000) return materialCp;
  return Math.max(materialCp - HINT_MARGIN_CP, Math.min(materialCp + HINT_MARGIN_CP, evalCp));
}

/** -3 (Black cruising) to +3 (White cruising). */
export function bucketOf(cp: number): number {
  const a = Math.abs(cp);
  const b = a < 60 ? 0 : a < 200 ? 1 : a < 500 ? 2 : 3;
  return cp < 0 ? -b : b;
}

const PIECE_NAME: Record<string, string> = { p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "the queen" };

const pick = <T,>(xs: T[], rand: () => number): T => xs[Math.floor(rand() * xs.length) % xs.length];

/** The line for this event, or null if the commentator has nothing to add. */
export function comment(i: CommentInput): Comment {
  const rand = i.rand ?? Math.random;
  const cp = safeCp(i.evalCp, i.materialCp);
  const bucket = bucketOf(cp);
  const n = i.names;
  const leader: Color = bucket > 0 ? "white" : "black";
  const L = n[leader], T = n[leader === "white" ? "black" : "white"];
  const swing = i.prevBucket !== null && bucket !== i.prevBucket;

  const state = (): string => {
    switch (Math.abs(bucket)) {
      case 0: return pick([
        "Nothing to separate them. It's anyone's game.",
        "Honours even so far. Tight as you like.",
        "Cagey stuff. Neither side giving an inch.",
        "Level pegging in midfield.",
      ], rand);
      case 1: return pick([
        `${L} edging it on the balance of play.`,
        `Slight edge to ${L}, but ${T} is well in this.`,
        `${L} just shading it at the moment.`,
      ], rand);
      case 2: return pick([
        `${L} on top now. ${T} needs a response.`,
        `${L} in the driving seat.`,
        `You'd make ${L} favourites from here.`,
      ], rand);
      default: return pick([
        `${L} cruising. ${T} needs a miracle.`,
        `This is one-way traffic towards ${T}'s goal.`,
        `${L} running riot. Can ${T} find a way back?`,
      ], rand);
    }
  };
  const swingLine = (): string =>
    bucket === 0 ? pick(["And we're all square again!", "Back to level. Game on!"], rand)
      : Math.sign(bucket) !== Math.sign(i.prevBucket ?? 0) ? pick([`What a turnaround! ${L} has the upper hand now.`, `Momentum shift! ${L} is on top.`], rand)
        : Math.abs(bucket) > Math.abs(i.prevBucket ?? 0) ? pick([`${L} turning the screw.`, `${L} pulling clear.`], rand)
          : pick([`${T} clawing their way back.`, `${T} has steadied the ship.`], rand);
  const withState = (lead: string) => `${lead} ${swing ? swingLine() : state()}`;

  const e = i.event;
  switch (e.kind) {
    case "kickoff":
      return { bucket, text: pick([`We're under way! ${n.white} kick off against ${n.black}.`, `And they're off! ${n.white} v ${n.black}.`], rand) };
    case "checkmate":
      return { bucket, text: pick([`CHECKMATE! ${n[e.winner]} wins it! Scenes!`, `It's all over! ${n[e.winner]} finishes it with checkmate.`], rand) };
    case "shootout":
      return { bucket, text: "It's going to penalties! Nerves of steel needed now." };
    case "ebk":
      return { bucket, text: `ELITE BALL KNOWLEDGE! Ten in a row for ${n[e.color]}. Take a bow.` };
    case "hot-spot":
      return { bucket, text: pick([`${n[e.color]} sets the Hot Spot alight!`, `The crowd are up as ${n[e.color]} hits the Hot Spot!`], rand) };
    case "power":
      return { bucket, text: pick([`${n[e.color]} goes to the bench for ${e.name}.`, `${e.name} from ${n[e.color]}. Tactical genius or panic?`], rand) };
    case "whoami":
      return { bucket, text: e.correct ? pick([`${n[e.color]} knew exactly who that was.`, `Spot on from ${n[e.color]}. A promotion well earned.`], rand)
        : pick([`${n[e.color]} drew a blank there.`, `Not even close, ${n[e.color]}. A knight it is.`], rand) };
    case "answer":
      if (e.hatTrick) return { bucket, text: `Hat-trick for ${n[e.color]}! Three right on the bounce.` };
      if (e.correct && e.puskas) return { bucket, text: `A PUSKÁS from ${n[e.color]}! Goal of the season contender!` };
      if (e.correct) return { bucket, text: pick([`Back of the net for ${n[e.color]}!`, `${n[e.color]} knows the game.`, `Textbook from ${n[e.color]}.`], rand) };
      return { bucket, text: e.puskas ? `${n[e.color]} went for the Puskás and skied it. Sent off!` : pick([`${n[e.color]} fluffs their lines.`, `Off the post for ${n[e.color]}.`, `That one's in Row Z, ${n[e.color]}.`], rand) };
    case "move": {
      const who = n[e.color];
      if (e.captured) {
        const what = PIECE_NAME[e.captured] ?? "a piece";
        return { bucket, text: withState(e.captured === "q" ? `${who} takes ${what}! Huge moment.` : pick([`${who} picks off ${what}.`, `${who} wins ${what}.`, `${what[0].toUpperCase()}${what.slice(1)} goes to ${who}'s bench.`], rand)) };
      }
      if (e.check) return { bucket, text: withState(pick([`Check from ${who}!`, `${who} asks a question of the king.`], rand)) };
      if (e.castle) return { bucket, text: pick([`${who} tucks the king away.`, `${who} castles. Safety first.`], rand) };
      if (swing) return { bucket, text: swingLine() };
      // Quiet moves: talk about the state now and then, otherwise a bit of colour.
      return { bucket, text: rand() < 0.5 ? state() : pick([
        "Patient build-up play here.",
        "Plenty of probing, not much penetration.",
        "The manager will be happy with the shape.",
        "You can feel the tension in the stands.",
        "A real chess match, this.",
        "Lovely weather for it.",
      ], rand) };
    }
  }
}

/** True if a line names a square (e4) or a move, which the commentator must never do. */
export function namesASquare(text: string): boolean {
  return /\b[a-h][1-8]\b/.test(text);
}
