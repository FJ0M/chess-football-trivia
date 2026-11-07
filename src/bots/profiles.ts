import type { BotId, BotLevel, BotProfile, ChessStrength, ClassicBotId, LadderBotId, TriviaSkill } from "./types";

// The three bots are mirror images: Ollie out-quizzes you, Freddie out-plays
// you, Ryan does a bit of both. Each has low, medium and hard levels. Medium is
// the version in the design doc; low and hard move chess strength and trivia
// together so the character stays the same.
//
// Chess ratings are what the playtest measured (tools/playtest, docs/bots.md):
// 400 games against Stockfish 17.1 with UCI_Elo, pinned at 1320. Treat them as
// +/-150. Retune here after playtesting with people.

const chess = (rating: number, depth: number, multiPv: number, temperatureCp: number, blunderRate: number): ChessStrength => ({
  rating,
  depth,
  multiPv,
  temperatureCp,
  blunderRate,
});

const trivia = (
  easy: number,
  medium: number,
  hard: number,
  puskas: number,
  ownClubAccuracy: number,
  answerMs: [number, number],
  cardWeights: TriviaSkill["cardWeights"],
  puskasRate: number,
): TriviaSkill => ({ accuracy: { easy, medium, hard, puskas }, ownClubAccuracy, answerMs, cardWeights, puskasRate });

const CLASSIC: Record<ClassicBotId, BotProfile> = {
  ollie: {
    id: "ollie",
    name: "Ollie",
    club: "west-ham",
    clubName: "West Ham",
    blurb: "Knows every answer, hangs every piece. Goes for Puskás goals and raids with his queen.",
    style: "chaotic",
    levels: {
      low: {
        chess: chess(450, 3, 5, 200, 0.45),
        trivia: trivia(0.88, 0.78, 0.62, 0.5, 0.85, [2500, 6000], { easy: 1, medium: 3, hard: 6 }, 0.3),
      },
      medium: {
        chess: chess(600, 4, 5, 160, 0.25),
        trivia: trivia(0.95, 0.88, 0.78, 0.65, 0.9, [2000, 5000], { easy: 1, medium: 2, hard: 7 }, 0.4),
      },
      hard: {
        chess: chess(900, 6, 5, 120, 0.17),
        trivia: trivia(0.98, 0.94, 0.87, 0.78, 0.95, [1500, 4000], { easy: 0, medium: 2, hard: 8 }, 0.5),
      },
    },
    favouritePowerUps: ["var-review", "managers-tip", "golden-boot", "counter-attack", "tactical-foul"],
  },
  ryan: {
    id: "ryan",
    name: "Ryan",
    club: "west-ham",
    clubName: "West Ham",
    blurb: "Solid at both, unbeatable on West Ham. Turns nasty when he's ahead.",
    style: "balanced",
    levels: {
      low: {
        chess: chess(950, 5, 3, 110, 0.2),
        trivia: trivia(0.8, 0.62, 0.45, 0.3, 0.88, [3500, 8000], { easy: 3, medium: 6, hard: 1 }, 0.1),
      },
      medium: {
        chess: chess(1300, 6, 3, 80, 0.1),
        trivia: trivia(0.88, 0.72, 0.55, 0.4, 0.92, [3000, 7500], { easy: 2, medium: 7, hard: 1 }, 0.15),
      },
      hard: {
        chess: chess(1600, 8, 3, 60, 0.06),
        trivia: trivia(0.93, 0.8, 0.66, 0.5, 0.96, [3000, 7000], { easy: 1, medium: 7, hard: 2 }, 0.2),
      },
    },
    favouritePowerUps: ["tactical-foul", "red-card", "golden-boot", "park-the-bus"],
  },
  freddie: {
    id: "freddie",
    name: "Freddie",
    club: "brighton",
    clubName: "Brighton",
    blurb: "Barely knows who won the league, rarely misses a tactic. Saves up and trades into endgames.",
    style: "positional",
    levels: {
      low: {
        chess: chess(1600, 8, 3, 50, 0.05),
        trivia: trivia(0.55, 0.33, 0.18, 0.1, 0.55, [5000, 9000], { easy: 8, medium: 2, hard: 0 }, 0),
      },
      medium: {
        chess: chess(1800, 8, 3, 35, 0.03),
        trivia: trivia(0.65, 0.42, 0.25, 0.15, 0.65, [5000, 9000], { easy: 7, medium: 2, hard: 1 }, 0.05),
      },
      hard: {
        chess: chess(2150, 10, 2, 20, 0.012),
        trivia: trivia(0.72, 0.5, 0.32, 0.2, 0.72, [4500, 8500], { easy: 6, medium: 3, hard: 1 }, 0.05),
      },
    },
    favouritePowerUps: ["extra-time", "super-sub", "park-the-bus", "formation-change"],
    saveFor: { ids: ["extra-time", "super-sub"], reserve: 8 },
  },
};

/** One strength for all three levels: ladder bots have no level picker. */
const fixed = (c: ChessStrength, t: TriviaSkill) => ({ low: { chess: c, trivia: t }, medium: { chess: c, trivia: t }, hard: { chess: c, trivia: t } });

// The Elo ladder: one made-up character at each of 400 to 1600 chess Elo, in steps
// of 200. Four are loosely inspired by footballers known for loving chess (Eze,
// Chilwell, Salah and Haaland); none uses a real name. Chess strengths were
// calibrated with tools/playtest/match.ts against Stockfish's UCI_Elo (docs/bots.md).
// Trivia varies on purpose, so the combined rating doesn't simply follow the chess.
const LADDER: Record<LadderBotId, BotProfile> = {
  pawny: {
    id: "pawny",
    name: "Pawny Dribbles",
    club: "stockport",
    clubName: "Stockport County",
    blurb: "Sunday league legend. Chases every piece like it's the ball, and every piece gets away.",
    style: "chaotic",
    fixedLevel: true,
    levels: fixed(chess(400, 2, 6, 240, 0.5), trivia(0.75, 0.5, 0.3, 0.15, 0.8, [2500, 7000], { easy: 5, medium: 4, hard: 1 }, 0.05)),
    favouritePowerUps: ["golden-boot", "counter-attack", "tactical-foul"],
    promotionAim: { low: "b", medium: "b", hard: "b" },
    thinkMs: [300, 1000],
  },
  eezy: {
    id: "eezy",
    name: "Eezy Peasy",
    club: "crystal-palace",
    clubName: "Crystal Palace",
    blurb: "All flair, no tracking back. Nutmegs your bishop, then leaves his queen hanging.",
    style: "chaotic",
    fixedLevel: true,
    levels: fixed(chess(600, 3, 5, 200, 0.38), trivia(0.92, 0.8, 0.62, 0.45, 0.9, [2000, 6000], { easy: 1, medium: 3, hard: 6 }, 0.3)),
    favouritePowerUps: ["counter-attack", "golden-boot", "managers-tip", "var-review"],
    promotionAim: { low: "q", medium: "q", hard: "q" },
    thinkMs: [400, 1200],
  },
  chillwall: {
    id: "chillwall",
    name: "Billy Chillwall",
    club: "chelsea",
    clubName: "Chelsea",
    blurb: "Wing-back who never crosses halfway. Parks the bus and waits for you to over-commit.",
    style: "positional",
    fixedLevel: true,
    levels: fixed(chess(800, 4, 4, 150, 0.25), trivia(0.82, 0.6, 0.4, 0.25, 0.85, [3000, 7500], { easy: 3, medium: 6, hard: 1 }, 0.05)),
    favouritePowerUps: ["park-the-bus", "tactical-foul", "red-card", "var-review"],
    promotionAim: { low: "r", medium: "r", hard: "r" },
    thinkMs: [700, 2000],
  },
  "gambit-gary": {
    id: "gambit-gary",
    name: "Gambit Gary",
    club: "leicester",
    clubName: "Leicester City",
    blurb: "Pundit who has seen every game since 1992. Offers you a pawn, then quizzes you to death.",
    style: "balanced",
    fixedLevel: true,
    levels: fixed(chess(1000, 5, 3, 115, 0.16), trivia(0.95, 0.86, 0.72, 0.55, 0.92, [2000, 5500], { easy: 1, medium: 4, hard: 5 }, 0.3)),
    favouritePowerUps: ["managers-tip", "golden-boot", "red-card", "var-review"],
    promotionAim: { low: "q", medium: "q", hard: "q" },
    thinkMs: [600, 1800],
  },
  "mo-mate": {
    id: "mo-mate",
    name: "Mo Mate",
    club: "liverpool",
    clubName: "Liverpool",
    blurb: "The Pharaoh of the back rank. Cuts in off the right and finishes with a smile.",
    style: "balanced",
    fixedLevel: true,
    levels: fixed(chess(1200, 6, 3, 95, 0.12), trivia(0.86, 0.68, 0.5, 0.35, 0.9, [3000, 7000], { easy: 2, medium: 6, hard: 2 }, 0.15)),
    favouritePowerUps: ["tactical-foul", "golden-boot", "super-sub", "var-review"],
    promotionAim: { low: "r", medium: "r", hard: "r" },
    thinkMs: [700, 2000],
  },
  knightingale: {
    id: "knightingale",
    name: "Florence Knightingale",
    club: "everton",
    clubName: "Everton",
    blurb: "Deep-lying playmaker. Nurses a small edge for forty moves, then takes your pulse.",
    style: "positional",
    fixedLevel: true,
    levels: fixed(chess(1400, 7, 3, 75, 0.08), trivia(0.88, 0.72, 0.55, 0.4, 0.88, [3000, 7000], { easy: 2, medium: 6, hard: 2 }, 0.1)),
    favouritePowerUps: ["super-sub", "extra-time", "park-the-bus", "tactical-foul"],
    saveFor: { ids: ["super-sub", "extra-time"], reserve: 7 },
    promotionAim: { low: "r", medium: "r", hard: "r" },
    thinkMs: [900, 2400],
  },
  rookland: {
    id: "rookland",
    name: "Ragnar Rookland",
    club: "man-city",
    clubName: "Manchester City",
    blurb: "Norwegian goal machine. Doesn't know who won the 2004 League Cup, doesn't need to.",
    style: "balanced",
    fixedLevel: true,
    levels: fixed(chess(1600, 8, 3, 60, 0.065), trivia(0.68, 0.45, 0.28, 0.15, 0.7, [3500, 8000], { easy: 6, medium: 3, hard: 1 }, 0.05)),
    favouritePowerUps: ["extra-time", "super-sub", "red-card", "tactical-foul"],
    saveFor: { ids: ["extra-time", "super-sub"], reserve: 8 },
    promotionAim: { low: "n", medium: "n", hard: "n" },
    thinkMs: [500, 1500],
  },
};

export const BOT_PROFILES: Record<BotId, BotProfile> = { ...CLASSIC, ...LADDER };

export const CLASSIC_IDS: ClassicBotId[] = ["ollie", "ryan", "freddie"];
export const LADDER_IDS: LadderBotId[] = ["pawny", "eezy", "chillwall", "gambit-gary", "mo-mate", "knightingale", "rookland"];
/** Ladder first, weakest to strongest, then the original three. */
export const BOT_IDS: BotId[] = [...LADDER_IDS, ...CLASSIC_IDS];
export const BOT_LEVELS: BotLevel[] = ["low", "medium", "hard"];

/**
 * Provisional: chess Elo points per percentage point of trivia accuracy above
 * or below an average quizzer (55%). Early full-game playtests show chess
 * skill dominates (Ollie's great trivia won 1 of 47 games against 1320+
 * chess), so trivia moves the match rating by at most about 150. Calibrate
 * with a longer full-game playtest (tools/playtest/fullgame.ts).
 */
export const TRIVIA_ELO_PER_POINT = 4;
export const AVERAGE_TRIVIA_ACCURACY = 0.55;

/** Average accuracy over easy, medium and hard questions. */
export function triviaAccuracy(t: TriviaSkill): number {
  return (t.accuracy.easy + t.accuracy.medium + t.accuracy.hard) / 3;
}

/** Combined chess + trivia rating, for the "best opponent beaten" high score. */
export function matchRating(chessRating: number, accuracy: number): number {
  return Math.round(chessRating + (accuracy - AVERAGE_TRIVIA_ACCURACY) * 100 * TRIVIA_ELO_PER_POINT);
}

export interface BotRating {
  /** Chess Elo, measured against fixed-strength Stockfish (docs/bots.md). */
  chess: number;
  /** Share of questions answered right, 0 to 1. */
  trivia: number;
  /** Combined rating, for the high score. */
  match: number;
}

/** Metadata for the bot picker. */
export const BOTS = BOT_IDS.map((id) => {
  const p = BOT_PROFILES[id];
  const rate = (l: BotLevel): BotRating => {
    const { chess, trivia } = p.levels[l];
    const acc = triviaAccuracy(trivia);
    return { chess: chess.rating, trivia: Math.round(acc * 100) / 100, match: matchRating(chess.rating, acc) };
  };
  return {
    id,
    name: p.name,
    club: p.club,
    clubName: p.clubName,
    blurb: p.blurb,
    /** True for ladder bots: one strength, no level picker. */
    fixedLevel: !!p.fixedLevel,
    ratings: { low: rate("low"), medium: rate("medium"), hard: rate("hard") } as Record<BotLevel, BotRating>,
  };
});
