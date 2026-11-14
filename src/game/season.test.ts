import { describe, expect, it } from "vitest";
import { CUP_ROUNDS, DIVISIONS, YOU, applyResult, cupWon, fitScore, matchKey, newSeason, nextMatch, nextSeason, recordCup, recordLeague, table, type Season } from "./season";

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RATINGS = { pawny: 400, eezy: 600, chillwall: 800, "gambit-gary": 1000, "mo-mate": 1200, knightingale: 1400, rookland: 1600 };

/** Plays the whole season, winning or losing every match of yours 2-1 or 1-2. */
function playOut(s: Season, win: boolean, rng = seeded(4)): Season {
  for (let guard = 0; guard < 50; guard++) {
    const m = nextMatch(s);
    if (!m) break;
    s = m.kind === "cup" ? recordCup(s, win ? 2 : 1, win ? 1 : 2, win, rng) : recordLeague(s, win ? 2 : 1, win ? 1 : 2, RATINGS, rng);
  }
  return s;
}

describe("league season", () => {
  it("plays every bot in a small division twice, once with each colour", () => {
    const s = newSeason("league-two", 1, "west-ham", seeded(1));
    expect(s.weeks).toHaveLength(6);
    const mine = s.weeks.map((w) => w.find((f) => f.home === YOU || f.away === YOU)!);
    for (const bot of DIVISIONS[0].bots) {
      const games = mine.filter((f) => f.home === bot || f.away === bot);
      expect(games.map((f) => (f.home === YOU ? "white" : "black")).sort()).toEqual(["black", "white"]);
    }
    // Every team plays every week.
    for (const w of s.weeks) expect(w).toHaveLength(2);
  });

  it("the Premier League has all seven bots, once each", () => {
    const s = newSeason("premier-league", 1, "west-ham", seeded(2));
    expect(s.weeks).toHaveLength(7);
    for (const w of s.weeks) expect(w).toHaveLength(4);
  });

  it("puts Cup ties between league matches, and a lost tie knocks you out", () => {
    let s = newSeason("league-two", 1, "west-ham", seeded(3));
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      const m = nextMatch(s)!;
      order.push(m.kind);
      s = m.kind === "cup" ? recordCup(s, 0, 1, false) : recordLeague(s, 1, 0, RATINGS, seeded(i));
    }
    expect(order).toEqual(["league", "league", "cup"]);
    expect(s.cupOut).toBe(true);
    expect(nextMatch(s)?.kind).toBe("league");
  });

  it("winning everything: champions, promoted and the Cup", () => {
    const s = playOut(newSeason("league-two", 1, "west-ham", seeded(5)), true);
    expect(s.finished).toMatchObject({ position: 1, move: "up", champions: true });
    expect(s.cup).toHaveLength(CUP_ROUNDS.length);
    expect(cupWon(s)).toBe(true);
    const t = table(s);
    expect(t[0]).toMatchObject({ team: YOU, played: 6, won: 6, points: 18, gf: 12, ga: 6 });
    const next = nextSeason(s, seeded(6));
    expect(next).toMatchObject({ number: 2, division: "league-one", week: 0 });
  });

  it("losing everything goes down, but not out of the bottom division", () => {
    const one = playOut(newSeason("league-one", 1, "west-ham", seeded(7)), false);
    expect(one.finished?.move).toBe("down");
    expect(nextSeason(one).division).toBe("league-two");
    const two = playOut(newSeason("league-two", 1, "west-ham", seeded(8)), false);
    expect(two.finished?.move).toBe("stay");
  });

  it("can't go up from the Premier League", () => {
    const s = playOut(newSeason("premier-league", 1, "west-ham", seeded(9)), true);
    expect(s.finished).toMatchObject({ position: 1, move: "stay", champions: true });
    expect(nextSeason(s).division).toBe("premier-league");
  });

  it("the table adds up", () => {
    const s = playOut(newSeason("championship", 1, "west-ham", seeded(10)), true);
    const t = table(s);
    expect(t.reduce((n, r) => n + r.gf, 0)).toBe(t.reduce((n, r) => n + r.ga, 0));
    for (const r of t) expect(r.points).toBe(3 * r.won + r.drawn);
  });

  it("only records a result against the match that was due", () => {
    const s = newSeason("league-two", 1, "", seeded(11));
    const key = matchKey(s, nextMatch(s));
    const after = applyResult(s, key, 2, 0, "won", RATINGS)!;
    expect(after.week).toBe(1);
    // The same game finishing again (a restart) changes nothing.
    expect(applyResult(after, key, 2, 0, "won", RATINGS)).toBeNull();
  });

  it("nudges the scoreline to agree with the result", () => {
    expect(fitScore(1, 3, "won")).toEqual([4, 3]);
    expect(fitScore(3, 1, "won")).toEqual([3, 1]);
    expect(fitScore(2, 2, "lost")).toEqual([2, 3]);
    expect(fitScore(3, 1, "drawn")).toEqual([3, 3]);
  });
});
