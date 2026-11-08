import { describe, expect, it } from "vitest";
import { QUESTION_RATING, TRIVIA_BASE, combinedRating, expectedRight, loadTriviaRating, saveTriviaRating, triviaEloFromAccuracy, triviaTitle, updateTriviaRating } from "./triviaElo";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("trivia Elo", () => {
  it("uses the chess Elo curve: equal ratings mean a coin flip", () => {
    expect(expectedRight(1600, QUESTION_RATING.hard)).toBeCloseTo(0.5);
    expect(expectedRight(2000, QUESTION_RATING.hard)).toBeCloseTo(10 / 11);
  });

  it("puts an average quizzer (55%) at the base and goes up with accuracy", () => {
    const at = (a: number) => triviaEloFromAccuracy({ easy: a + 0.2, medium: a, hard: a - 0.2 });
    expect(Math.abs(at(0.55) - TRIVIA_BASE)).toBeLessThan(25);
    expect(at(0.75)).toBeGreaterThan(at(0.55) + 150);
    expect(at(0.35)).toBeLessThan(at(0.55) - 150);
  });

  it("combined rating is the chess rating for an average quizzer, and chess still dominates", () => {
    expect(combinedRating(1200, TRIVIA_BASE)).toBe(1200);
    expect(combinedRating(1200, TRIVIA_BASE + 200)).toBeGreaterThan(1200);
    // 400 trivia Elo is worth less than 400 chess Elo.
    expect(combinedRating(1600, TRIVIA_BASE)).toBeGreaterThan(combinedRating(1200, TRIVIA_BASE + 400));
  });

  it("moves your rating after each answer, more for a surprise", () => {
    const start = { rating: 1350, answers: 0 };
    const hardRight = updateTriviaRating(start, [{ tier: "hard", right: true }]);
    const easyRight = updateTriviaRating(start, [{ tier: "easy", right: true }]);
    const easyWrong = updateTriviaRating(start, [{ tier: "easy", right: false }]);
    expect(hardRight.rating).toBeGreaterThan(easyRight.rating);
    expect(easyRight.rating).toBeGreaterThan(1350);
    expect(easyWrong.rating).toBeLessThan(1350 - 20);
    expect(hardRight.answers).toBe(1);
  });

  it("settles near the truth for a steady 70% Highlight player", () => {
    let r = { rating: 1350, answers: 0 };
    for (let i = 0; i < 300; i++) r = updateTriviaRating(r, [{ tier: "medium", right: i % 10 < 7 }]);
    // 70% against 1300 questions is about 1447.
    expect(Math.abs(r.rating - 1447)).toBeLessThan(40);
  });

  it("saves and loads, and starts at the base", () => {
    const s = memory();
    expect(loadTriviaRating(s)).toEqual({ rating: 1350, answers: 0 });
    saveTriviaRating({ rating: 1500, answers: 12 }, s);
    expect(loadTriviaRating(s)).toEqual({ rating: 1500, answers: 12 });
  });

  it("names the top tier Elite Ball Knowledge", () => {
    expect(triviaTitle(1850)).toBe("Elite Ball Knowledge");
    expect(triviaTitle(1300)).toBe("Matchday regular");
  });
});
