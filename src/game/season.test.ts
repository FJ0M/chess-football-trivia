import { judgeSeason } from "./badges";
import { describe, expect, it } from "vitest";
import { honourText, loadHonours, recordHonour } from "./season";
import { CUP_ROUNDS, DIVISIONS, YOU, applyResult, cupWon, fitScore, matchKey, newSeason, nextMatch, nextSeason, recordCup, recordLeague, table, type Season } from "./season";

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RATINGS = { pawny: 400, lenny: 500, eezy: 600, chillwall: 800, sal: 900, "gambit-gary": 1000, "mo-mate": 1200, barry: 1300, knightingale: 1400, rookland: 1600 };

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

  it("the Premier League has the top five bots, home and away", () => {
    const s = newSeason("premier-league", 1, "west-ham", seeded(2));
    expect(s.bots).toEqual(["gambit-gary", "mo-mate", "barry", "knightingale", "rookland"]);
    expect(s.weeks).toHaveLength(10);
    for (const w of s.weeks) expect(w).toHaveLength(3);
  });

  it("a Premier League season started before the change keeps its seven bots", () => {
    const s = newSeason("premier-league", 1, "west-ham", seeded(2));
    const old = { ...s, bots: undefined };
    expect(table(old).map((r) => r.team)).toHaveLength(8);
  });

  it("a lower-division season started before 2026-11-22 keeps the bots it began with", () => {
    const s = newSeason("league-one", 1, "west-ham", seeded(2));
    expect(table({ ...s, bots: undefined }).map((r) => r.team).sort()).toEqual(["chillwall", "eezy", "gambit-gary", YOU].sort());
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

describe("honours", () => {
  it("a finished season goes on the honours board once, with its badges", () => {
    localStorage.clear();
    const s = playOut(newSeason("league-two", 1, "west-ham", seeded(5)), true);
    expect(recordHonour(s)).toBe(true);
    expect(recordHonour(s)).toBe(false);
    expect(loadHonours()).toEqual([{ season: 1, division: "league-two", position: 1, move: "up", champions: true, cup: true }]);
    expect(honourText(loadHonours()[0])).toBe("League Two champions · Cup winners");
    expect(judgeSeason(loadHonours()[0])).toEqual(["champions", "cup-winners", "the-double"]);
    expect(judgeSeason({ champions: false, cup: false, move: "up", division: "championship" })).toEqual(["top-flight"]);
  });
});
