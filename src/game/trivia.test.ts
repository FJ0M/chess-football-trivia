import { describe, expect, it } from "vitest";
import questions from "../../data/questions.json";
import whoami from "../../data/whoami.json";
import { QuestionBank, askTheCrowd, fiftyFifty } from "./trivia";
import { WhoAmIBank, type WhoAmI } from "./whoami";
import { shootoutWinner } from "./useGame";
import { CLUBS } from "./clubs";
import type { Question } from "./types";

const qs = (questions as { questions: Question[] }).questions;

describe("question bank", () => {
  it("deals one card of each difficulty, and bonus rounds are all on your club", () => {
    const bank = new QuestionBank(qs);
    for (let i = 0; i < 30; i++) {
      const cards = bank.deal("west-ham", false);
      expect(cards.map((c) => c.difficulty)).toEqual(["easy", "medium", "hard"]);
      for (const c of cards) expect(bank.draw(c).difficulty).toBe(c.difficulty);
    }
    const bonus = bank.deal("york", true);
    expect(bonus.every((c) => c.club === "york")).toBe(true);
    expect(bank.draw(bonus[2]).club).toBe("york");
  });
  it("doesn't repeat a general question until every one at that difficulty has been asked", () => {
    const bank = new QuestionBank(qs);
    for (const d of ["easy", "medium", "hard"] as const) {
      const total = qs.filter((q) => !q.club && q.verified && q.difficulty === d).length;
      const asked = new Set<string>();
      for (let i = 0; i < total; i++) asked.add(bank.draw(bank.deal(null, false).find((c) => c.difficulty === d)!).id);
      expect(asked.size).toBe(total);
    }
  });
  it("every club has enough questions for its own cards", () => {
    const bank = new QuestionBank(qs);
    for (const c of CLUBS) for (const d of ["easy", "medium", "hard"] as const) expect(bank.hasClub(c.id, d)).toBe(true);
  });
  it("hints", () => {
    const q = qs[0];
    const hidden = fiftyFifty(q);
    expect(hidden).toHaveLength(2);
    expect(hidden).not.toContain(q.answer);
    expect(askTheCrowd(q).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("Who am I", () => {
  const sets = (whoami as { sets: WhoAmI[] }).sets;
  it("has five clues and four options per set", () => {
    for (const s of sets) {
      expect(s.clues).toHaveLength(5);
      expect(new Set(s.options).size).toBe(4);
      expect(s.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it("gives a club set on a Hot Spot when the club has one", () => {
    const bank = new WhoAmIBank(sets, new Set());
    expect(bank.draw("brighton", true).club).toBe("brighton");
    expect(bank.draw("york", true).club).toBeNull();
  });
});

describe("Penalty Shootout", () => {
  const k = (s: string) => [...s].map((c, i) => ({ color: (i % 2 ? "black" : "white") as "white" | "black", scored: c === "1" }));
  it("ends early once one side can't catch up, else goes to sudden death", () => {
    expect(shootoutWinner(k("101010"))).toBe("white");
    expect(shootoutWinner(k("1111"))).toBeNull();
    expect(shootoutWinner(k("1111111111"))).toBeNull();
    expect(shootoutWinner(k("111111111110"))).toBe("white");
  });
});
