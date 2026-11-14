import { describe, expect, it } from "vitest";
import questions from "../../data/questions.json";
import whoami from "../../data/whoami.json";
import { QuestionBank, browserSeenStore, seenKey, shuffleOptions } from "./trivia";
import { WhoAmIBank, type WhoAmI } from "./whoami";
import { shootoutWinner } from "./match";
import { CLUBS } from "./clubs";
import type { Question } from "./types";

const qs = (questions as { questions: Question[] }).questions;

describe("question bank", () => {
  it("deals one card of each difficulty, mostly general with at most one club card", () => {
    const bank = new QuestionBank(qs);
    let general = 0;
    for (let i = 0; i < 300; i++) {
      const cards = bank.deal("west-ham");
      expect(cards.map((c) => c.difficulty)).toEqual(["easy", "medium", "hard"]);
      for (const c of cards) expect(bank.draw(c).difficulty).toBe(c.difficulty);
      // Hot Spots deal this way too, so they draw on the whole bank rather than one club's 30.
      expect(cards.filter((c) => c.club).length).toBeLessThanOrEqual(1);
      general += cards.filter((c) => !c.club).length;
    }
    expect(general).toBeGreaterThan(750);
  });
  it("doesn't repeat a general question until every one at that difficulty has been asked", () => {
    const bank = new QuestionBank(qs);
    for (const d of ["easy", "medium", "hard"] as const) {
      const total = qs.filter((q) => !q.club && q.verified && q.difficulty === d).length;
      const asked = new Set<string>();
      for (let i = 0; i < total; i++) asked.add(bank.draw(bank.deal(null).find((c) => c.difficulty === d)!).id);
      expect(asked.size).toBe(total);
    }
  });
  it("shuffles the options each time, keeping the right answer right", () => {
    const q = qs.find((x) => !x.club && x.verified)!;
    const slots = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = shuffleOptions(q);
      expect([...s.options].sort()).toEqual([...q.options].sort());
      expect(s.options[s.answer]).toBe(q.options[q.answer]);
      slots.add(s.answer);
    }
    expect(slots.size).toBe(4);
    // The bank's own copy is never reordered.
    expect(qs.find((x) => x.id === q.id)).toBe(q);
  });
  it("draws questions with the right answer spread across A to D", () => {
    const bank = new QuestionBank(qs);
    const count = [0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) {
      const q = bank.draw(bank.deal(null)[i % 3]);
      const orig = qs.find((x) => x.id === q.id)!;
      expect(q.options[q.answer]).toBe(orig.options[orig.answer]);
      count[q.answer]++;
    }
    for (const n of count) expect(n).toBeGreaterThan(400);
  });
  it("every club has enough questions for its own cards", () => {
    const bank = new QuestionBank(qs);
    for (const c of CLUBS) for (const d of ["easy", "medium", "hard"] as const) expect(bank.hasClub(c.id, d)).toBe(true);
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
  it("mixes in your club's sets when it has some", () => {
    const bank = new WhoAmIBank(sets, new Set());
    expect(Array.from({ length: 40 }, () => bank.draw("brighton").club)).toContain("brighton");
    expect(Array.from({ length: 20 }, () => bank.draw("york").club).every((c) => c === null)).toBe(true);
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

describe("Who am I? typed answers", () => {
  it("ignores capitals and accents, takes the surname alone, and allows a typo or two", async () => {
    const { isRightGuess } = await import("./whoami");
    const set = (name: string, aliases: string[] = []) => ({ id: "x", clues: [], options: [name, "A B", "C D", "E F"], answer: 0, name, aliases, club: null, verified: true });
    const aguero = set("Sergio Agüero", ["Kun"]);
    for (const t of ["sergio aguero", "AGUERO", "Agüero", "aguerro", "kun", " Sergio  Agüero "]) expect(isRightGuess(aguero, t)).toBe(true);
    expect(isRightGuess(aguero, "Sergio")).toBe(false);
    expect(isRightGuess(aguero, "")).toBe(false);
    const ode = set("Martin Ødegaard");
    expect(isRightGuess(ode, "odegaard")).toBe(true);
    expect(isRightGuess(ode, "oedegard")).toBe(true);
    const vvd = set("Virgil van Dijk");
    for (const t of ["van dijk", "vandijk", "Van Dyk", "virgil van dijk"]) expect(isRightGuess(vvd, t)).toBe(true);
    const kante = set("N'Golo Kanté");
    expect(isRightGuess(kante, "kante")).toBe(true);
    expect(isRightGuess(kante, "ngolo kante")).toBe(true);
    // A typo away, but it's another footballer's name: wrong.
    expect(isRightGuess(kante, "Kane", ["Harry Kane"])).toBe(false);
    expect(isRightGuess(set("Joe Cole", []), "Andy Cole", ["Andy Cole"])).toBe(false);
    expect(isRightGuess(set("Mohamed Salah"), "Sadio Mane")).toBe(false);
  });
  it("every set in the bank accepts its own name and surname", () => {
    const bank = new WhoAmIBank((whoami as { sets: WhoAmI[] }).sets, { has: () => false, add: () => {}, delete: () => {} });
    for (const s of (whoami as { sets: WhoAmI[] }).sets) {
      const name = s.name ?? s.options[s.answer];
      expect(bank.check(s, name)).toBe(true);
      expect(bank.check(s, name.split(" ").slice(1).join(" ") || name)).toBe(true);
      for (const other of s.options.filter((_, i) => i !== s.answer)) expect(bank.check(s, other)).toBe(false);
    }
  });
});
