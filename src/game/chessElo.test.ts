import { describe, expect, it } from "vitest";
import { CHESS_START, TREND_MAX, loadChessRating, saveChessRating, trendChange, updateChessRating } from "./chessElo";
import { combinedRating } from "./triviaElo";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("chess rating", () => {
  it("goes up for a win, down for a loss, and more for an upset", () => {
    const r = { rating: 1200, games: 0, trend: [] };
    const beatStrong = updateChessRating(r, 1600, 1, 1350).rating - 1200;
    const beatWeak = updateChessRating(r, 900, 1, 1350).rating - 1200;
    expect(beatStrong).toBeGreaterThan(beatWeak);
    expect(beatWeak).toBeGreaterThan(0);
    expect(updateChessRating(r, 1200, 0, 1350).rating).toBeLessThan(1200);
    expect(updateChessRating(r, 1200, 0.5, 1350).rating).toBe(1200);
  });

  it("keeps a trend of combined ratings and reports the change", () => {
    let r = { rating: CHESS_START, games: 0, trend: [] as number[] };
    expect(trendChange(r)).toBeNull();
    for (let i = 0; i < TREND_MAX + 3; i++) r = updateChessRating(r, 1400, 1, 1500);
    expect(r.trend).toHaveLength(TREND_MAX);
    expect(r.trend[r.trend.length - 1]).toBe(combinedRating(r.rating, 1500));
    expect(trendChange(r)).toBeGreaterThan(0);
  });

  it("saves and loads, and starts fresh from bad storage", () => {
    const s = mem();
    expect(loadChessRating(s)).toEqual({ rating: CHESS_START, games: 0, trend: [] });
    saveChessRating({ rating: 1333, games: 4, trend: [1300, 1333] }, s);
    expect(loadChessRating(s)).toEqual({ rating: 1333, games: 4, trend: [1300, 1333] });
    s.setItem("cft.chess-elo.v1", "{oops");
    expect(loadChessRating(s).rating).toBe(CHESS_START);
  });
});
