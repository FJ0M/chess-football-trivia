import { combinedRating, triviaEloFromAccuracy } from "../game/triviaElo";
import type { BotId, BotProfile, ChessStrength, LadderBotId, TriviaSkill } from "./types";

// The Elo ladder: one bot at each of 400 to 1600 chess Elo, one strength each.
// (The original three, Ollie, Ryan and Freddie, were retired on 2026-11-09.)
//
// Chess ratings are what the playtest measured (tools/playtest, docs/bots.md)
// against Stockfish 17.1 with UCI_Elo, pinned at 1320. Treat them as +/-100.

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
    chess: chess(400, 2, 6, 240, 0.62),
    trivia: trivia(0.75, 0.5, 0.3, 0.15, 0.8, [2500, 7000], { easy: 5, medium: 4, hard: 1 }, 0.05),
    favouritePowerUps: ["golden-boot", "counter-attack", "tactical-foul"],
    promotionAim: "b",
    thinkMs: [300, 1000],
  },
  eezy: {
    id: "eezy",
    name: "Eezy Peasy",
    club: "crystal-palace",
    clubName: "Crystal Palace",
    blurb: "All flair, no tracking back. Nutmegs your bishop, then leaves his queen hanging.",
    style: "chaotic",
    chess: chess(600, 3, 5, 200, 0.38),
    trivia: trivia(0.92, 0.8, 0.62, 0.45, 0.9, [2000, 6000], { easy: 1, medium: 3, hard: 6 }, 0.3),
    favouritePowerUps: ["counter-attack", "golden-boot", "managers-tip", "var-review"],
    promotionAim: "q",
    thinkMs: [400, 1200],
  },
  chillwall: {
    id: "chillwall",
    name: "Billy Chillwall",
    club: "chelsea",
    clubName: "Chelsea",
    blurb: "Wing-back who never crosses halfway. Parks the bus and waits for you to over-commit.",
    style: "positional",
    chess: chess(800, 4, 4, 150, 0.31),
    trivia: trivia(0.82, 0.6, 0.4, 0.25, 0.85, [3000, 7500], { easy: 3, medium: 6, hard: 1 }, 0.05),
    favouritePowerUps: ["park-the-bus", "tactical-foul", "red-card", "var-review"],
    promotionAim: "r",
    thinkMs: [700, 2000],
  },
  "gambit-gary": {
    id: "gambit-gary",
    name: "Gambit Gary",
    club: "leicester",
    clubName: "Leicester City",
    blurb: "Pundit who has seen every game since 1992. Offers you a pawn, then quizzes you to death.",
    style: "balanced",
    chess: chess(1000, 5, 3, 115, 0.16),
    trivia: trivia(0.95, 0.86, 0.72, 0.55, 0.92, [2000, 5500], { easy: 1, medium: 4, hard: 5 }, 0.3),
    favouritePowerUps: ["managers-tip", "golden-boot", "red-card", "var-review"],
    promotionAim: "q",
    thinkMs: [600, 1800],
  },
  "mo-mate": {
    id: "mo-mate",
    name: "Mo Mate",
    club: "liverpool",
    clubName: "Liverpool",
    blurb: "The Pharaoh of the back rank. Cuts in off the right and finishes with a smile.",
    style: "balanced",
    chess: chess(1200, 6, 3, 95, 0.12),
    trivia: trivia(0.86, 0.68, 0.5, 0.35, 0.9, [3000, 7000], { easy: 2, medium: 6, hard: 2 }, 0.15),
    favouritePowerUps: ["tactical-foul", "golden-boot", "super-sub", "var-review"],
    promotionAim: "r",
    thinkMs: [700, 2000],
  },
  knightingale: {
    id: "knightingale",
    name: "Florence Knightingale",
    club: "everton",
    clubName: "Everton",
    blurb: "Deep-lying playmaker. Nurses a small edge for forty moves, then takes your pulse.",
    style: "positional",
    chess: chess(1400, 7, 3, 75, 0.08),
    trivia: trivia(0.88, 0.72, 0.55, 0.4, 0.88, [3000, 7000], { easy: 2, medium: 6, hard: 2 }, 0.1),
    favouritePowerUps: ["super-sub", "extra-time", "park-the-bus", "tactical-foul"],
    saveFor: { ids: ["super-sub", "extra-time"], reserve: 7 },
    promotionAim: "r",
    thinkMs: [900, 2400],
  },
  rookland: {
    id: "rookland",
    name: "Ragnar Rookland",
    club: "man-city",
    clubName: "Manchester City",
    blurb: "Norwegian goal machine. Doesn't know who won the 2004 League Cup, doesn't need to.",
    style: "balanced",
    chess: chess(1600, 8, 3, 60, 0.065),
    trivia: trivia(0.68, 0.45, 0.28, 0.15, 0.7, [3500, 8000], { easy: 6, medium: 3, hard: 1 }, 0.05),
    favouritePowerUps: ["extra-time", "super-sub", "red-card", "tactical-foul"],
    saveFor: { ids: ["extra-time", "super-sub"], reserve: 8 },
    promotionAim: "n",
    thinkMs: [500, 1500],
  },
};

export const BOT_PROFILES: Record<BotId, BotProfile> = LADDER;

export const LADDER_IDS: LadderBotId[] = ["pawny", "eezy", "chillwall", "gambit-gary", "mo-mate", "knightingale", "rookland"];
/** Weakest to strongest. */
export const BOT_IDS: BotId[] = [...LADDER_IDS];

/** Average accuracy over easy, medium and hard questions. */
export function triviaAccuracy(t: TriviaSkill): number {
  return (t.accuracy.easy + t.accuracy.medium + t.accuracy.hard) / 3;
}

/** Trivia Elo from the bot's accuracy at each difficulty (src/game/triviaElo.ts). */
export function triviaElo(t: TriviaSkill): number {
  return triviaEloFromAccuracy(t.accuracy);
}

/** Combined chess + trivia rating, for the "best opponent beaten" high score. */
export function matchRating(chessRating: number, trivia: number): number {
  return combinedRating(chessRating, trivia);
}

export interface BotRating {
  /** Chess Elo, measured against fixed-strength Stockfish (docs/bots.md). */
  chess: number;
  /** Share of questions answered right, 0 to 1. */
  trivia: number;
  /** Trivia Elo, on the same scale as chess Elo. */
  triviaElo: number;
  /** Combined rating, for the high score. */
  match: number;
}

/** Metadata for the bot picker. */
export const BOTS = BOT_IDS.map((id) => {
  const p = BOT_PROFILES[id];
  const acc = triviaAccuracy(p.trivia);
  const elo = triviaElo(p.trivia);
  const rating: BotRating = { chess: p.chess.rating, trivia: Math.round(acc * 100) / 100, triviaElo: elo, match: matchRating(p.chess.rating, elo) };
  return {
    id,
    name: p.name,
    club: p.club,
    clubName: p.clubName,
    blurb: p.blurb,
    rating,
  };
});
