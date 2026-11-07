import { describe, expect, it } from "vitest";
import questions from "../../data/questions.json";
import whoami from "../../data/whoami.json";
import { QuestionBank, askTheCrowd, browserSeenStore, fiftyFifty, seenKey } from "./trivia";
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

describe("seen lists", () => {
  function fakeStorage(init: Record<string, string> = {}): Storage {
    const m = new Map(Object.entries(init));
    return {
      get length() { return m.size; },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => { m.delete(k); },
      setItem: (k, v) => { m.set(k, v); },
    };
  }
  it("keeps a separate list for each player, matching names loosely", () => {
    const storage = fakeStorage();
    const ryan = browserSeenStore("Ryan-test", storage);
    const ollie = browserSeenStore("Ollie-test", storage);
    ryan.add("tit-0001");
    expect(ryan.has("tit-0001")).toBe(true);
    expect(ollie.has("tit-0001")).toBe(false);
    expect(browserSeenStore("  ryan-TEST ", storage)).toBe(ryan);
    expect(JSON.parse(storage.getItem(seenKey("Ryan-test"))!)).toEqual(["tit-0001"]);
  });
  it("hands the old shared list to the first player, once", () => {
    const storage = fakeStorage({ "cft.seen.v1": JSON.stringify(["gol-0001"]) });
    expect(browserSeenStore("Freddie-test", storage).has("gol-0001")).toBe(true);
    expect(storage.getItem("cft.seen.v1")).toBeNull();
    expect(browserSeenStore("Guest-test", storage).has("gol-0001")).toBe(false);
  });
});

describe("question sources", () => {
  it("every question links to the page it was checked against", () => {
    for (const q of qs) expect(q.source, q.id).toMatch(/^https:\/\//);
  });
});

describe("Who am I? club sets", () => {
  it("about half of a club fan's sets are about their club, even without a Hot Spot", async () => {
    const { WhoAmIBank } = await import("./whoami");
    const sets = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `g${i}`, clues: ["1", "2", "3", "4", "5"], options: ["a", "b", "c", "d"], answer: 0, club: null, verified: true })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, clues: ["1", "2", "3", "4", "5"], options: ["a", "b", "c", "d"], answer: 0, club: "west-ham", verified: true })),
    ];
    const seen = new Set<string>();
    const store = { has: (id: string) => seen.has(id), add: (id: string) => void seen.add(id), delete: (id: string) => void seen.delete(id) };
    const bank = new WhoAmIBank(sets, store as never);
    let club = 0;
    for (let i = 0; i < 400; i++) if (bank.draw("west-ham").club === "west-ham") club++;
    // Half the draws ask for a club set; the other half draw from everything, club sets included.
    expect(club).toBeGreaterThan(240);
  });
});
