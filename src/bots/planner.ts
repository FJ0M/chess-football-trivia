// The bot's power-up planner: try every way to use each power-up with the engine,
// and buy the one that gains the most for its Form. The game supplies the positions
// (src/game/botPowers.ts), so this knows nothing about the rules beyond what the
// engine sees.
//
// Each option is scored by playing it out: the bot's best move after the power-up
// (and a second move for Extra Time), then the engine's view of the opponent's reply
// with any freezes or Park the Bus in force. The same is done with no power-up, and
// the difference is the gain in centipawns. Form is worth FORM_CP a point, so a
// power-up is bought only when it gains more than it costs.

import { MATE_CP, type Analyser } from "./engine";
import { legalMoves, normaliseUci, positionFromFen, type Rng } from "./movePicker";
import type { BotProfile, ChessStrength, PowerUpChoice, PowerUpOption, SimNode } from "./types";

/** What a point of Form is worth on the board. A strong quizzer earns about 1.3 a move, and a pawn is about 3 Form. */
export const FORM_CP = 30;
/** Scores are capped here, so a mate found for one option doesn't drown out everything else. */
const CAP_CP = 1500;
/** First pass: every option at a shallow depth. Then the best few get a proper look. */
const QUICK_DEPTH = 3;
const SHORTLIST = 4;
/** A favourite power-up gets this much benefit of the doubt (flavour, not judgement). */
const FAVOURITE_CP = 20;
/** Never buy something for less than this gain, however cheap. */
const MIN_GAIN_CP = 40;
/** Form is capped at 12, so near the cap it's use it or lose it and each point is worth less. */
const FORM_CAP = 12;

const clamp = (cp: number) => Math.max(-CAP_CP, Math.min(CAP_CP, cp));

export interface Planned {
  choice: PowerUpChoice;
  gainCp: number;
  scoreCp: number;
}

export function planDepth(strength: ChessStrength): number {
  return Math.max(3, Math.min(strength.depth, 8));
}

/** Value of a node for the bot, in centipawns, by playing the bot's best moves until it's the opponent's turn. */
async function value(engine: Analyser, node: SimNode, depth: number, plies = 0): Promise<number> {
  if (node.over) return node.over === "win" ? MATE_CP : node.over === "loss" ? -MATE_CP : 0;
  if (!node.moves.length) return 0;
  const pos = positionFromFen(node.fen);
  // Moves the engine can search (a Counter-Attack dash isn't a normal chess move).
  const searchable = node.moves.filter((u) => normaliseUci(pos, u) === u);
  if (!node.mine) {
    if (!searchable.length) return 0;
    // Freezes and Park the Bus show up as moves missing from the opponent's list.
    const restricted = searchable.length < legalMoves(pos).length;
    const lines = await engine.analyse(node.fen, { depth, multiPv: 1, searchMoves: restricted ? searchable : undefined, maxMs: 800 });
    return lines[0] ? -lines[0].scoreCp : 0;
  }
  let uci = node.moves[0];
  if (node.moves.length > 1 && searchable.length) {
    const lines = await engine.analyse(node.fen, { depth, multiPv: 1, searchMoves: searchable, maxMs: 800 });
    const best = lines[0] && normaliseUci(pos, lines[0].uci);
    if (best && node.moves.includes(best)) uci = best;
    else if (lines[0]) uci = searchable[0];
  }
  const next = node.play(uci);
  if (!next) return 0;
  if (plies >= 3) return 0;
  return value(engine, next, depth, plies + 1);
}

/**
 * Picks the best power-up among the options, or null if none is worth its Form.
 * `noiseCp` blurs the judgement for weaker bots.
 */
export async function planPowerUp(
  engine: Analyser,
  profile: BotProfile,
  strength: ChessStrength,
  req: { form: number; base: SimNode; options: PowerUpOption[] },
  rng: Rng,
  extra: { id: PowerUpOption["id"]; gainCp: number; cost: number }[] = [],
): Promise<Planned | null> {
  const depth = planDepth(strength);
  const noiseCp = strength.temperatureCp * 0.5;
  const formCp = req.form >= FORM_CAP - 2 ? FORM_CP / 2 : FORM_CP;
  const score = (id: string, gain: number, cost: number) => {
    let s = gain - cost * formCp + (profile.favouritePowerUps.includes(id as never) ? FAVOURITE_CP : 0) + (rng() - 0.5) * 2 * noiseCp;
    // Bots that save for something big need a very good reason to spend on anything else.
    if (profile.saveFor && !profile.saveFor.ids.includes(id as never) && req.form - cost < profile.saveFor.reserve) s -= 120;
    return s;
  };

  const all: Planned[] = extra.map((e) => ({ choice: { id: e.id }, gainCp: e.gainCp, scoreCp: score(e.id, e.gainCp, e.cost) }));

  if (req.options.length) {
    const quickDepth = Math.min(QUICK_DEPTH, depth);
    const quickBase = clamp(await value(engine, req.base, quickDepth));
    const quick: { o: PowerUpOption; gain: number }[] = [];
    for (const o of req.options) quick.push({ o, gain: clamp(await value(engine, o.node, quickDepth)) - quickBase });
    // Best few by value for Form, at most two of the same power-up.
    quick.sort((a, b) => b.gain - b.o.cost * FORM_CP - (a.gain - a.o.cost * FORM_CP));
    const per = new Map<string, number>();
    const short = quick.filter(({ o }) => {
      const n = per.get(o.id) ?? 0;
      per.set(o.id, n + 1);
      return n < 2;
    }).slice(0, SHORTLIST);
    const baseCp = depth === quickDepth ? quickBase : clamp(await value(engine, req.base, depth));
    for (const { o, gain: g } of short) {
      const gain = depth === quickDepth ? g : clamp(await value(engine, o.node, depth)) - baseCp;
      all.push({ choice: { id: o.id, target: o.target, target2: o.target2 }, gainCp: gain, scoreCp: score(o.id, gain, o.cost) });
    }
  }

  const best = all.filter((p) => p.gainCp >= MIN_GAIN_CP && p.scoreCp > 0).sort((a, b) => b.scoreCp - a.scoreCp)[0];
  return best ?? null;
}
