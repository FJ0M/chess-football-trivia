// Trivia Elo: a rating for football knowledge on the same scale as chess Elo,
// and the combined rating used for the "best opponent beaten" high score.
//
// Each question has a rating by difficulty, and a quizzer rated R gets a
// question rated Q right with chance 1 / (1 + 10^((Q - R) / 400)), the same
// curve as chess Elo. So a quizzer rated the same as Screamers gets half of
// them right. Bots get their trivia Elo from their accuracy at each difficulty;
// you get yours from your answers, updated like a chess rating after each game.

/** Question ratings by difficulty. A 55% quizzer comes out at about TRIVIA_BASE. */
export const QUESTION_RATING = { easy: 1000, medium: 1300, hard: 1600, puskas: 1800 } as const;
export type QuestionTier = keyof typeof QUESTION_RATING;

/** Trivia Elo of an average quizzer (about 55% across Tap-ins, Highlights and Screamers). */
export const TRIVIA_BASE = 1350;
/** Where a new player starts. */
export const TRIVIA_START = 1350;

/**
 * How many chess Elo points one trivia Elo point is worth in a real game, from the
 * full-game playtest (tools/playtest/fullgame.ts, docs/bots.md): same chess, different
 * trivia. Chess still decides most games, so trivia counts for less than half.
 */
export const TRIVIA_WEIGHT = 0.35;

export function expectedRight(rating: number, question: number): number {
  return 1 / (1 + 10 ** ((question - rating) / 400));
}

/** The trivia Elo that best fits these accuracies (equal numbers of each difficulty). */
export function triviaEloFromAccuracy(acc: { easy: number; medium: number; hard: number }): number {
  const tiers: Array<["easy" | "medium" | "hard", number]> = [["easy", acc.easy], ["medium", acc.medium], ["hard", acc.hard]];
  // Maximum likelihood: total expected right answers = total actual right answers. Monotonic, so bisect.
  const gap = (r: number) => tiers.reduce((s, [t, a]) => s + expectedRight(r, QUESTION_RATING[t]) - a, 0);
  let lo = 0;
  let hi = 3000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) > 0) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Combined chess + trivia rating, for the high score. An average quizzer's combined rating is their chess rating. */
export function combinedRating(chess: number, trivia: number): number {
  return Math.round(chess + TRIVIA_WEIGHT * (trivia - TRIVIA_BASE));
}

export interface Answer { tier: QuestionTier; right: boolean }

export interface TriviaRating {
  rating: number;
  /** Questions answered so far, which sets how fast the rating moves. */
  answers: number;
}

/** K-factor: moves fast while the rating is new, then settles. */
export const kFactor = (answers: number) => (answers < 30 ? 40 : answers < 100 ? 24 : 16);

/** Updates a trivia rating with one game's answers, one question at a time. */
export function updateTriviaRating(r: TriviaRating, answers: Answer[]): TriviaRating {
  let { rating, answers: n } = r;
  for (const a of answers) {
    const e = expectedRight(rating, QUESTION_RATING[a.tier]);
    rating += kFactor(n) * ((a.right ? 1 : 0) - e);
    n++;
  }
  return { rating: Math.round(rating), answers: n };
}

const KEY = "cft.trivia-elo.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function safeStorage(): Store | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

/** Your trivia rating on this device (games against bots only, so Pass and Play doesn't mix two people). */
export function loadTriviaRating(storage: Store | undefined = safeStorage()): TriviaRating {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null");
    if (raw && typeof raw.rating === "number" && typeof raw.answers === "number") return { rating: raw.rating, answers: raw.answers };
  } catch { /* ignore */ }
  return { rating: TRIVIA_START, answers: 0 };
}

export function saveTriviaRating(r: TriviaRating, storage: Store | undefined = safeStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(r)); } catch { /* private browsing or storage full */ }
}

export function resetTriviaRating(storage: Store | undefined = safeStorage()): void {
  saveTriviaRating({ rating: TRIVIA_START, answers: 0 }, storage);
}

/** Trivia rating labels, building up to Elite Ball Knowledge at the top. */
export function triviaTitle(rating: number): string {
  if (rating >= 1800) return "Elite Ball Knowledge";
  if (rating >= 1600) return "Pundit";
  if (rating >= 1400) return "Season-ticket holder";
  if (rating >= 1200) return "Matchday regular";
  if (rating >= 1000) return "Casual fan";
  return "Plastic";
}
