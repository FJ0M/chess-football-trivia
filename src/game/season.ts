// League season (Freddie, 2026-11-14): climb four divisions against the ladder bots,
// with a league table, promotion and relegation, and a cup run alongside.
//
// Each division is a small league: you plus a few bots. You play every bot in it twice,
// once as White and once as Black (the Premier League, with all seven bots, once each).
// The bots' own fixtures are simulated from their combined ratings. Win 3 points, draw 1,
// and goals are the match scoreline (one per piece taken). The top two go up, the
// bottom one goes down. Three Cup ties come between league matches, against bots drawn
// from the whole ladder; a Cup tie needs a winner, so a drawn Cup tie is lost.
// Kept in browser storage, so a season lives on this device only.

import type { Color } from "./types";

export type DivisionId = "league-two" | "league-one" | "championship" | "premier-league";

export interface Division {
  id: DivisionId;
  name: string;
  bots: string[];
  /** Play each bot twice (White then Black), or once. */
  double: boolean;
}

/** Bottom to top. Overlaps are fine: each season is played in one division. */
export const DIVISIONS: Division[] = [
  { id: "league-two", name: "League Two", bots: ["pawny", "eezy", "chillwall"], double: true },
  { id: "league-one", name: "League One", bots: ["eezy", "chillwall", "gambit-gary"], double: true },
  { id: "championship", name: "Championship", bots: ["gambit-gary", "mo-mate", "knightingale"], double: true },
  { id: "premier-league", name: "Premier League", bots: ["pawny", "eezy", "chillwall", "gambit-gary", "mo-mate", "knightingale", "rookland"], double: false },
];

export const YOU = "you";
/** Top this many go up (not from the top division). */
export const PROMOTED = 2;
/** Bottom this many go down (not from the bottom division). */
export const RELEGATED = 1;
export const WIN_POINTS = 3;
export const CUP_ROUNDS = ["Quarter-final", "Semi-final", "Final"] as const;

export interface Fixture {
  home: string;
  away: string;
  /** Goals, once played. */
  score?: [number, number];
}

export interface CupTie {
  round: number;
  opponent: string;
  /** You play this colour. */
  color: Color;
  result?: "won" | "lost";
  score?: [number, number];
}

export interface Season {
  /** Counts up from 1 across seasons. */
  number: number;
  /** Your club (for the questions and the table), or "" for none. */
  club: string;
  division: DivisionId;
  /** Matchweeks; each holds every fixture of that week, yours included. */
  weeks: Fixture[][];
  /** Index of the next matchweek to play. */
  week: number;
  /** Cup ties are played before these matchweeks (0-based). */
  cupBefore: number[];
  cup: CupTie[];
  /** Out of the Cup (lost a tie). */
  cupOut: boolean;
  /** Set when the last matchweek is played. */
  finished?: { position: number; move: "up" | "down" | "stay"; champions: boolean };
}

export type Rng = () => number;

export function divisionOf(id: DivisionId): Division {
  return DIVISIONS.find((d) => d.id === id) ?? DIVISIONS[0];
}

/** Round-robin by the circle method; teams.length must be even (a "bye" is added if not). */
function roundRobin(teams: string[]): Array<Array<[string, string]>> {
  const t = teams.length % 2 ? [...teams, "bye"] : [...teams];
  const n = t.length;
  const rounds: Array<Array<[string, string]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a !== "bye" && b !== "bye") pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop()!);
  }
  return rounds;
}

export function newSeason(division: DivisionId, number: number, club = "", rng: Rng = Math.random): Season {
  const d = divisionOf(division);
  const first = roundRobin([YOU, ...d.bots]);
  const rounds = d.double ? [...first, ...first.map((r) => r.map(([h, a]) => [a, h] as [string, string]))] : first;
  const weeks = rounds.map((r) => r.map(([home, away]) => ({ home, away })));
  // Cup ties before about a quarter, half and three-quarters of the way through.
  const n = weeks.length;
  const cupBefore = [Math.max(1, Math.round(n / 4)), Math.round(n / 2), Math.min(n - 1, Math.round((3 * n) / 4))];
  return { number, club, division, weeks, week: 0, cupBefore, cup: [drawCupTie(0, rng)], cupOut: false };
}

/** Cup opponents get stronger each round: drawn from the bottom, middle and top of the ladder. */
const CUP_POOLS: string[][] = [
  ["pawny", "eezy", "chillwall", "gambit-gary"],
  ["chillwall", "gambit-gary", "mo-mate", "knightingale"],
  ["mo-mate", "knightingale", "rookland"],
];

function drawCupTie(round: number, rng: Rng): CupTie {
  const pool = CUP_POOLS[round];
  return { round, opponent: pool[Math.floor(rng() * pool.length)], color: rng() < 0.5 ? "white" : "black" };
}

/** What you play next: a Cup tie, a league match, or nothing (season over). */
export type NextMatch =
  | { kind: "cup"; tie: CupTie }
  | { kind: "league"; fixture: Fixture; opponent: string; color: Color }
  | null;

export function nextMatch(s: Season): NextMatch {
  if (s.finished) return null;
  const tie = s.cup[s.cup.length - 1];
  if (!s.cupOut && tie && !tie.result && s.cupBefore[tie.round] <= s.week) return { kind: "cup", tie };
  const fixture = s.weeks[s.week]?.find((f) => f.home === YOU || f.away === YOU);
  if (!fixture) return null;
  return { kind: "league", fixture, opponent: fixture.home === YOU ? fixture.away : fixture.home, color: fixture.home === YOU ? "white" : "black" };
}

/** Chance the first team beats the second, from combined ratings (Elo). Draws take a slice out of the middle. */
function simulate(home: number, away: number, rng: Rng): [number, number] {
  const p = 1 / (1 + 10 ** ((away - home) / 400));
  const draw = 0.22 * (1 - Math.abs(p - 0.5) * 2);
  const r = rng();
  const goals = () => 1 + Math.floor(rng() * 3);
  if (r < p - draw / 2) { const w = goals(); return [w, Math.floor(rng() * w)]; }
  if (r < p + draw / 2) { const g = Math.floor(rng() * 3); return [g, g]; }
  const w = goals();
  return [Math.floor(rng() * w), w];
}

/**
 * Records your league match (your goals first, then theirs) and simulates the other fixtures that week.
 * `ratings` maps bot id to combined rating.
 */
export function recordLeague(s: Season, you: number, them: number, ratings: Record<string, number>, rng: Rng = Math.random): Season {
  const week = s.weeks[s.week];
  if (!week) return s;
  const played = week.map((f): Fixture => {
    if (f.home === YOU) return { ...f, score: [you, them] };
    if (f.away === YOU) return { ...f, score: [them, you] };
    return { ...f, score: simulate(ratings[f.home] ?? 1000, ratings[f.away] ?? 1000, rng) };
  });
  const weeks = s.weeks.map((w, i) => (i === s.week ? played : w));
  let next: Season = { ...s, weeks, week: s.week + 1 };
  if (next.week >= weeks.length) next = finish(next);
  return next;
}

/** Records a Cup tie. A draw is a loss: Cup ties need a winner. */
export function recordCup(s: Season, you: number, them: number, won: boolean, rng: Rng = Math.random): Season {
  const cup = [...s.cup];
  const i = cup.length - 1;
  if (i < 0 || cup[i].result) return s;
  cup[i] = { ...cup[i], result: won ? "won" : "lost", score: [you, them] };
  if (won && i + 1 < CUP_ROUNDS.length) cup.push(drawCupTie(i + 1, rng));
  return { ...s, cup, cupOut: !won };
}

export function cupWon(s: Season): boolean {
  return s.cup.length === CUP_ROUNDS.length && s.cup[CUP_ROUNDS.length - 1].result === "won";
}

export interface Row { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }

export function table(s: Season): Row[] {
  const d = divisionOf(s.division);
  const rows = new Map<string, Row>([YOU, ...d.bots].map((t) => [t, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]));
  for (const f of s.weeks.flat()) {
    if (!f.score) continue;
    const [h, a] = f.score;
    const home = rows.get(f.home), away = rows.get(f.away);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.gf += h; home.ga += a; away.gf += a; away.ga += h;
    if (h > a) { home.won++; away.lost++; home.points += WIN_POINTS; }
    else if (h < a) { away.won++; home.lost++; away.points += WIN_POINTS; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  // Points, then goal difference, then goals scored; you go above a bot level on all three.
  return [...rows.values()].sort((x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || (x.team === YOU ? -1 : y.team === YOU ? 1 : 0));
}

function finish(s: Season): Season {
  const rows = table(s);
  const position = rows.findIndex((r) => r.team === YOU) + 1;
  const idx = DIVISIONS.findIndex((d) => d.id === s.division);
  const up = position <= PROMOTED && idx < DIVISIONS.length - 1;
  const down = position > rows.length - RELEGATED && idx > 0;
  return { ...s, finished: { position, move: up ? "up" : down ? "down" : "stay", champions: position === 1 } };
}

/** The next season, in the division your finish earned. */
export function nextSeason(s: Season, rng: Rng = Math.random): Season {
  const idx = DIVISIONS.findIndex((d) => d.id === s.division);
  const move = s.finished?.move ?? "stay";
  const div = DIVISIONS[Math.max(0, Math.min(DIVISIONS.length - 1, idx + (move === "up" ? 1 : move === "down" ? -1 : 0)))];
  return newSeason(div.id, s.number + 1, s.club, rng);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------- storage

const KEY = "cft.season.v1";

export function loadSeason(): Season | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object" && Array.isArray(raw.weeks) && DIVISIONS.some((d) => d.id === raw.division)) return raw as Season;
  } catch { /* ignore */ }
  return null;
}

export function saveSeason(s: Season | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** Names the match you're about to play, so a result is only recorded against that match. */
export function matchKey(s: Season, m: NextMatch): string {
  if (!m) return "";
  return m.kind === "cup" ? `${s.number}:cup:${m.tie.round}` : `${s.number}:league:${s.week}`;
}

/**
 * Records a finished season match, if `key` is still the match due (a restarted or old game is ignored).
 * `won` is from your side; a Cup tie that isn't won is lost.
 */
export function applyResult(s: Season, key: string, you: number, them: number, result: "won" | "drawn" | "lost", ratings: Record<string, number>, rng: Rng = Math.random): Season | null {
  const m = nextMatch(s);
  if (!m || matchKey(s, m) !== key) return null;
  const [a, b] = fitScore(you, them, result);
  return m.kind === "cup" ? recordCup(s, a, b, result === "won", rng) : recordLeague(s, a, b, ratings, rng);
}

/**
 * The result decides the points; the goals (pieces taken) are nudged so the scoreline agrees with it:
 * the winner of a game gets the winning goal if they weren't already ahead, and a draw is level.
 */
export function fitScore(you: number, them: number, result: "won" | "drawn" | "lost"): [number, number] {
  if (result === "won") return [Math.max(you, them + 1), them];
  if (result === "lost") return [you, Math.max(them, you + 1)];
  const level = Math.max(you, them);
  return [level, level];
}
