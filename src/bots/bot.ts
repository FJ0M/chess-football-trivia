import type { Analyser } from "./engine";
import { legalMoves, normaliseUci, pickMove, positionFromFen, type Rng } from "./movePicker";
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

const THINK_MS: Record<BotId, [number, number]> = {
  ollie: [400, 1400],
  ryan: [700, 2000],
  freddie: [900, 2600],
};

const PROMOTION_AIM: Record<BotId, Record<BotLevel, PromotionRole>> = {
  ollie: { low: "r", medium: "q", hard: "q" },
  ryan: { low: "b", medium: "r", hard: "r" },
  freddie: { low: "n", medium: "n", hard: "b" },
};

export interface Bot {
  readonly profile: BotProfile;
  readonly level: BotLevel;
  chooseMove(req: MoveRequest): Promise<MoveResult>;
  chooseCard(req: CardRequest): CardChoice;
  answer(req: AnswerRequest): AnswerResult;
  choosePowerUp(req: PowerUpRequest): PowerUpChoice | null;
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
  let lastLossCp = 0;

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
      const pick = pickMove({ pos, lines, allowed, strength: chess, style: profile.style, rng, forceBest: req.managersTip });
      lastLossCp = pick.lossCp;
      talker.tickMove();
      const [lo, hi] = THINK_MS[id];
      return { uci: pick.uci, evalCp: pick.scoreCp, thinkMs: Math.round(lo + rng() * (hi - lo)) };
    },

    chooseCard: (req) => chooseCard(profile, trivia, req, rng),
    answer: (req) => answerQuestion(profile, trivia, req, rng),
    choosePowerUp: (req) => choosePowerUp(profile, req, rng, lastLossCp),
    promotionPick: () => PROMOTION_AIM[id][level],
    say: (moment) => talker.say(moment),
  };
}
