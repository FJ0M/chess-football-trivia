import type { BotId, BotLevel, BotProfile, ChessStrength, TriviaSkill } from "./types";

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

export const BOT_PROFILES: Record<BotId, BotProfile> = {
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
        trivia: trivia(0.8, 0.62, 0.45, 0.3, 0.88, [4500, 10000], { easy: 3, medium: 6, hard: 1 }, 0.1),
      },
      medium: {
        chess: chess(1300, 6, 3, 80, 0.1),
        trivia: trivia(0.88, 0.72, 0.55, 0.4, 0.92, [4000, 9000], { easy: 2, medium: 7, hard: 1 }, 0.15),
      },
      hard: {
        chess: chess(1600, 8, 3, 60, 0.06),
        trivia: trivia(0.93, 0.8, 0.66, 0.5, 0.96, [3500, 8000], { easy: 1, medium: 7, hard: 2 }, 0.2),
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
        trivia: trivia(0.55, 0.33, 0.18, 0.1, 0.55, [7000, 13000], { easy: 8, medium: 2, hard: 0 }, 0),
      },
      medium: {
        chess: chess(1800, 8, 3, 35, 0.03),
        trivia: trivia(0.65, 0.42, 0.25, 0.15, 0.65, [7000, 13000], { easy: 7, medium: 2, hard: 1 }, 0.05),
      },
      hard: {
        chess: chess(2150, 10, 2, 20, 0.012),
        trivia: trivia(0.72, 0.5, 0.32, 0.2, 0.72, [6000, 12000], { easy: 6, medium: 3, hard: 1 }, 0.05),
      },
    },
    favouritePowerUps: ["extra-time", "super-sub", "park-the-bus", "formation-change"],
    saveFor: { ids: ["extra-time", "super-sub"], reserve: 8 },
  },
};

export const BOT_IDS: BotId[] = ["ollie", "ryan", "freddie"];
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
    ratings: { low: rate("low"), medium: rate("medium"), hard: rate("hard") } as Record<BotLevel, BotRating>,
  };
});
