// Your chess rating: a performance Elo that moves after each game against a bot, like the
// trivia Elo does with your answers. Together they make your combined rating, and the last
// few combined ratings give a trend (audit, 2026-11-22: "the number never moves").

import { combinedRating } from "./triviaElo";

export const CHESS_START = 1200;
/** How many combined ratings the trend keeps. */
export const TREND_MAX = 10;

export interface ChessRating {
  rating: number;
  games: number;
  /** Your combined rating after each of your last few bot games, oldest first. */
  trend: number[];
}

/** K-factor: moves fast for the first games, then settles. */
export const chessK = (games: number) => (games < 10 ? 40 : games < 30 ? 24 : 16);

export const expectedScore = (rating: number, opponent: number) => 1 / (1 + 10 ** ((opponent - rating) / 400));

/** One game against a bot rated `opponent`: score 1 for a win, 0.5 for a draw, 0 for a loss. */
export function updateChessRating(r: ChessRating, opponent: number, score: 0 | 0.5 | 1, trivia: number): ChessRating {
  const rating = Math.round(r.rating + chessK(r.games) * (score - expectedScore(r.rating, opponent)));
  return { rating, games: r.games + 1, trend: [...r.trend, combinedRating(rating, trivia)].slice(-TREND_MAX) };
}

/** Change in combined rating over the trend ("+34"), or null with fewer than two games. */
export function trendChange(r: ChessRating): number | null {
  return r.trend.length < 2 ? null : r.trend[r.trend.length - 1] - r.trend[0];
}

const KEY = "cft.chess-elo.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function safeStorage(): Store | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function loadChessRating(storage: Store | undefined = safeStorage()): ChessRating {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null");
    if (raw && typeof raw.rating === "number" && typeof raw.games === "number") {
      const trend = Array.isArray(raw.trend) ? raw.trend.filter((n: unknown) => typeof n === "number").slice(-TREND_MAX) : [];
      return { rating: raw.rating, games: raw.games, trend };
    }
  } catch { /* ignore */ }
  return { rating: CHESS_START, games: 0, trend: [] };
}

export function saveChessRating(r: ChessRating, storage: Store | undefined = safeStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(r)); } catch { /* private browsing or storage full */ }
}

export function resetChessRating(storage: Store | undefined = safeStorage()): void {
  saveChessRating({ rating: CHESS_START, games: 0, trend: [] }, storage);
}
