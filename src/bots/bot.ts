import type { Analyser } from "./engine";
import { legalMoves, moveFeatures, normaliseUci, pickMove, positionFromFen, type Rng } from "./movePicker";
import { BOT_PROFILES } from "./profiles";
import { choosePowerUp } from "./powerUps";
import { Talker } from "./talk";
import { answerQuestion, chooseCard } from "./trivia";
import type {
  AnswerRequest,
  AnswerResult,
  BotId,
  BotLevel,
  BotProfile,
  CardChoice,
  CardRequest,
  MoveRequest,
  MoveResult,
  PowerUpChoice,
  PowerUpRequest,
  PromotionRole,
  TalkMoment,
} from "./types";

const THINK_MS: Partial<Record<BotId, [number, number]>> = {
  ollie: [400, 1400],
  ryan: [700, 2000],
  freddie: [900, 2600],
};

const PROMOTION_AIM: Partial<Record<BotId, Record<BotLevel, PromotionRole>>> = {
  ollie: { low: "r", medium: "q", hard: "q" },
  ryan: { low: "b", medium: "r", hard: "r" },
  freddie: { low: "n", medium: "n", hard: "b" },
};

/** Depth of the bot's quick look at the position before it decides on a power-up. */
const LOOK_DEPTH = 8;

/** What a Hot Spot is worth to a bot in centipawns: good quizzers on their own club chase them a little. */
export function hotSpotValue(profile: BotProfile, level: BotLevel): number {
  if (profile.hotSpotCp !== undefined) return profile.hotSpotCp;
  const acc = profile.levels[level].trivia.ownClubAccuracy;
  // A Hot Spot is a club question at normal Form (playtest round 3), so it's worth less than a pawn.
  return Math.max(0, Math.min(40, Math.round((acc - 0.5) * 100)));
}

export interface Bot {
  readonly profile: BotProfile;
  readonly level: BotLevel;
  chooseMove(req: MoveRequest): Promise<MoveResult>;
  chooseCard(req: CardRequest): CardChoice;
  answer(req: AnswerRequest): AnswerResult;
  /** Async because the bot first takes a quick look at the position with the engine. */
  choosePowerUp(req: PowerUpRequest): Promise<PowerUpChoice | null>;
  /**
   * Piece the bot aims for on a promotion "Who am I?": q guesses on clue 1, r on clue 2,
   * b on clue 3, n on clue 4. A wrong guess costs Form, so bad quizzers aim low.
   */
  promotionPick(): PromotionRole;
  say(moment: TalkMoment): string | null;
}

export function createBotWith(
  id: BotId,
  level: BotLevel,
  engine: Analyser,
  rng: Rng = Math.random,
  /** Override the profile (the playtest uses this to try custom strengths). */
  profile: BotProfile = BOT_PROFILES[id],
): Bot {
  const { chess, trivia } = profile.levels[level];
  const talker = new Talker(id, profile.clubName, rng);
  const hotSpotCp = hotSpotValue(profile, level);
  let lastLossCp = 0;
  /** Eval the bot expected after its own last move, from its side. */
  let expectedCp: number | null = null;
  /** Latest eval the bot knows, from its side. */
  let knownCp: number | undefined;

  return {
    profile,
    level,

    async chooseMove(req) {
      const pos = positionFromFen(req.fen);
      const legal = legalMoves(pos);
      const allowed = req.allowedMoves
        ? req.allowedMoves.map((u) => normaliseUci(pos, u)).filter((u): u is string => !!u)
        : legal;
      if (allowed.length === 0) throw new Error("Bot was asked to move with no legal moves");

      const restricted = allowed.length < legal.length;
      const lines =
        allowed.length === 1
          ? []
          : await engine.analyse(req.fen, {
              depth: req.managersTip ? Math.max(chess.depth, 12) : chess.depth,
              multiPv: req.managersTip ? 1 : Math.min(chess.multiPv, allowed.length),
              searchMoves: restricted ? allowed : undefined,
              maxMs: 4000,
            });
      // A Hot Spot move outside the top lines still gets considered: search those too.
      if (!req.managersTip && hotSpotCp > 0 && req.hotSpots?.length && allowed.length > 1) {
        const have = new Set(lines.map((l) => normaliseUci(pos, l.uci)));
        const spotMoves = allowed.filter((u) => req.hotSpots!.includes(u.slice(2, 4)) && !have.has(u) && !moveFeatures(pos, u).castle);
        if (spotMoves.length) {
          const extra = await engine.analyse(req.fen, { depth: chess.depth, multiPv: Math.min(3, spotMoves.length), searchMoves: spotMoves, maxMs: 2000 });
          lines.push(...extra.map((l) => ({ ...l, multipv: lines.length + l.multipv })));
          lines.sort((a, b) => b.scoreCp - a.scoreCp);
        }
      }
      const pick = pickMove({
        pos, lines, allowed, strength: chess, style: profile.style, rng, forceBest: req.managersTip,
        hotSpots: req.hotSpots, hotSpotCp, goldenBoot: req.goldenBoot,
      });
      lastLossCp = pick.lossCp;
      expectedCp = pick.scoreCp;
      knownCp = pick.scoreCp;
      talker.tickMove();
      const [lo, hi] = profile.thinkMs ?? THINK_MS[id] ?? [600, 1800];
      return { uci: pick.uci, evalCp: pick.scoreCp, thinkMs: Math.round(lo + rng() * (hi - lo)) };
    },

    // The card comes after the bot's move, so its eval is the one it expected from that move.
    chooseCard: (req) => chooseCard(profile, trivia, { ...req, evalCp: req.evalCp ?? knownCp }, rng),
    answer: (req) => answerQuestion(profile, trivia, req, rng),

    async choosePowerUp(req) {
      if (req.available.length === 0) return null;
      // Look at the position first, so the bot knows the score (Park the Bus, VAR, playing safe)
      // and whether a capture is on (Golden Boot). The game may pass the eval in instead.
      let evalCp = req.evalCp;
      let bestIsCapture = false;
      try {
        const lines = await engine.analyse(req.fen, { depth: Math.min(chess.depth, LOOK_DEPTH), multiPv: 1, maxMs: 1500 });
        const best = lines[0];
        if (best) {
          evalCp ??= best.scoreCp;
          const pos = positionFromFen(req.fen);
          const uci = normaliseUci(pos, best.uci);
          bestIsCapture = !!uci && moveFeatures(pos, uci).capture;
        }
      } catch {
        // No engine: decide without the eval.
      }
      knownCp = evalCp;
      // How much worse things got since the bot's own last move (its blunder or a reply it missed).
      const swing = expectedCp !== null && evalCp !== undefined ? expectedCp - evalCp : 0;
      const drop = req.lastMoveEvalDrop ?? Math.max(lastLossCp, swing);
      return choosePowerUp(profile, { ...req, evalCp, lastMoveEvalDrop: drop }, rng, lastLossCp, { bestIsCapture });
    },

    promotionPick: () => profile.promotionAim?.[level] ?? PROMOTION_AIM[id]?.[level] ?? "r",
    say: (moment) => talker.say(moment),
  };
}
