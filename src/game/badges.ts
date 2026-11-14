// Badges and trophies for the trophy cabinet. Only games against a bot count.
// Badges are for doing something special (in one game, or over your career); trophies are
// cups for beating each bot, read from the high scores so wins from before badges existed count.
// Kept in browser storage, so they live on this device only.

import type { Color, GameState } from "./types";
import type { MatchStats, Tally } from "./history";
import { POWER_UPS } from "./powerups";
import { BOT_NAMES, LADDER_BOT_IDS } from "./bots";
import type { Scores } from "./scores";

export type BadgeGroup = "trivia" | "chess" | "career";
export type Tier = "bronze" | "silver" | "gold";
export const TIERS: Tier[] = ["bronze", "silver", "gold"];

export interface BadgeDef {
  id: string;
  name: string;
  group: BadgeGroup;
  /** How you win it, shown once you have. */
  how: string;
  /** A short mark for the pin: a number, letters or a chess piece. */
  glyph: string;
  /** Bronze, silver and gold targets for a badge you build up over many games. */
  tiers?: [number, number, number];
}

export const BADGES: BadgeDef[] = [
  { id: "ebk", name: "Elite Ball Knowledge", group: "trivia", glyph: "10", how: "10 right answers in a row in one game" },
  { id: "puskas", name: "Puskás Award", group: "trivia", glyph: "P", how: "Get a Puskás card right" },
  { id: "clean-sheet", name: "Clean Sheet", group: "trivia", glyph: "0", how: "A whole game without a wrong answer (at least 5 asked)" },
  { id: "hat-trick-hero", name: "Hat-trick Hero", group: "trivia", glyph: "3×3", how: "Three hat-tricks in one game" },
  { id: "clue-one", name: "Clue One", group: "trivia", glyph: "?1", how: "Get a \"Who am I?\" right on the first clue" },
  { id: "club-legend", name: "Club Legend", group: "trivia", glyph: "♥", how: "Right answers about your own club", tiers: [10, 25, 50] },
  { id: "groundhopper", name: "Groundhopper", group: "trivia", glyph: "92", how: "Right answers about different clubs", tiers: [20, 46, 92] },
  { id: "great-escape", name: "Great Escape", group: "chess", glyph: "♖", how: "Win after being a rook or more down" },
  { id: "fergie-time", name: "Fergie Time Winner", group: "chess", glyph: "0:09", how: "Win with under 10 seconds on your clock" },
  { id: "early-kickoff", name: "Early Kick-Off", group: "chess", glyph: "20", how: "Checkmate inside 20 of your moves" },
  { id: "pawn-star", name: "Pawn Star", group: "chess", glyph: "♙", how: "Checkmate with a pawn" },
  { id: "penalty-hero", name: "Penalty Hero", group: "chess", glyph: "PEN", how: "Win a Penalty Shootout" },
  { id: "wanderer", name: "Chess960 Wanderer", group: "chess", glyph: "960", how: "Win 5 games of Chess960" },
  { id: "pure-football", name: "Pure Football", group: "career", glyph: "⚽", how: "Beat a bot without using a power-up" },
  { id: "full-squad", name: "Full Squad", group: "career", glyph: "XI", how: "Use every power-up at least once, over all your games" },
  { id: "invincibles", name: "Invincibles", group: "career", glyph: "W10", how: "10 wins in a row without a defeat (draws don't break it)" },
  { id: "giant-killer", name: "Giant Killer", group: "career", glyph: "↑300", how: "Beat a bot rated 300 or more above your best win before it" },
];
export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<string, BadgeDef>;

/** A club's own name for Club Legend. */
const CLUB_LEGEND: Record<string, string> = {
  "west-ham": "Academy of Football",
  brighton: "Seagulls Legend",
};
export const clubLegendName = (club: string | null | undefined) => (club && CLUB_LEGEND[club]) || "Club Legend";

/** What one side did in a game that the badges need. */
export interface Feats {
  /** Most right answers in a row (questions and "Who am I?"). */
  bestRun: number;
  hatTricks: number;
  puskasRight: number;
  /** "Who am I?" right on the first clue. */
  clueOne: number;
  /** Right answers about this player's own club. */
  clubRight: number;
  /** Clubs this player got a question right about. */
  clubsRight: string[];
  /** Power-ups used (not trivia hints). */
  powerUps: string[];
  /** Furthest behind on material, in centipawns from this side's view (negative = behind). */
  worstCp: number;
}
export const emptyFeats = (): Feats => ({ bestRun: 0, hatTricks: 0, puskasRight: 0, clueOne: 0, clubRight: 0, clubsRight: [], powerUps: [], worstCp: 0 });

export interface Earned { first: string; last: string; count: number; tier?: Tier; label?: string }
export interface Career { clubRight: number; clubs: string[]; chess960Wins: number; unbeaten: number; powerUps: string[] }
export interface Cabinet { earned: Record<string, Earned>; career: Career }

const KEY = "cft.badges.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function safeStorage(): Store | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
const emptyCareer = (): Career => ({ clubRight: 0, clubs: [], chess960Wins: 0, unbeaten: 0, powerUps: [] });

export function loadCabinet(storage: Store | undefined = safeStorage()): Cabinet {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") return { earned: raw.earned ?? {}, career: { ...emptyCareer(), ...raw.career } };
  } catch { /* ignore */ }
  return { earned: {}, career: emptyCareer() };
}
function saveCabinet(c: Cabinet, storage: Store | undefined) {
  try { storage?.setItem(KEY, JSON.stringify(c)); } catch { /* private browsing or storage full */ }
}
export function resetCabinet(storage: Store | undefined = safeStorage()) { saveCabinet({ earned: {}, career: emptyCareer() }, storage); }

/** The tier a count reaches, or null below bronze. */
export function tierFor(def: BadgeDef, n: number): Tier | null {
  if (!def.tiers) return null;
  let t: Tier | null = null;
  def.tiers.forEach((need, i) => { if (n >= need) t = TIERS[i]; });
  return t;
}

export interface FinishInfo {
  game: GameState;
  stats: MatchStats;
  /** The colour the human played. */
  human: Color;
  /** The beaten bot's combined rating, and your best win's before this game. */
  botMatch?: number;
  prevBestMatch?: number;
}

/** A badge won (or moved up a tier) in this game. */
export interface NewBadge { id: string; tier?: Tier; label?: string; again: boolean }

/** The badges a finished game earns, given the career so far. Pure, for tests. */
export function judge(info: FinishInfo, before: Cabinet): { awards: NewBadge[]; career: Career } {
  const { game, stats, human } = info;
  const o = game.outcome;
  const f: Feats = { ...emptyFeats(), ...stats.feats?.[human] };
  const quiz: Tally = stats.trivia[human];
  const won = !!o && "winner" in o && o.winner === human;
  const lost = !!o && "winner" in o && o.winner !== human;
  const mine = game.history.filter((m) => m.color === human);
  const last = mine[mine.length - 1];
  const club = game.players[human].club;

  const career: Career = {
    clubRight: before.career.clubRight + f.clubRight,
    clubs: [...new Set([...before.career.clubs, ...f.clubsRight])],
    chess960Wins: before.career.chess960Wins + (won && game.options.chess960 ? 1 : 0),
    unbeaten: lost ? 0 : before.career.unbeaten + (won ? 1 : 0),
    powerUps: [...new Set([...before.career.powerUps, ...f.powerUps])],
  };

  const hit = new Set<string>();
  if (f.bestRun >= 10) hit.add("ebk");
  if (f.puskasRight > 0) hit.add("puskas");
  if (quiz.asked >= 5 && quiz.right === quiz.asked) hit.add("clean-sheet");
  if (f.hatTricks >= 3) hit.add("hat-trick-hero");
  if (f.clueOne > 0) hit.add("clue-one");
  if (won && f.worstCp <= -500) hit.add("great-escape");
  if (won && game.options.timed && game.players[human].clockMs !== null && game.players[human].clockMs < 10_000) hit.add("fergie-time");
  if (won && o?.kind === "checkmate" && mine.length <= 20) hit.add("early-kickoff");
  if (won && o?.kind === "checkmate" && last && /^[a-h]/.test(last.san) && !last.san.includes("=")) hit.add("pawn-star");
  if (won && o?.kind === "shootout") hit.add("penalty-hero");
  if (career.chess960Wins >= 5 && !before.earned.wanderer) hit.add("wanderer");
  if (won && f.powerUps.length === 0) hit.add("pure-football");
  if (!before.earned["full-squad"] && POWER_UPS.every((p) => career.powerUps.includes(p.id))) hit.add("full-squad");
  if (career.unbeaten >= 10 && career.unbeaten % 10 === 0 && career.unbeaten > before.career.unbeaten) hit.add("invincibles");
  if (won && info.botMatch !== undefined && info.prevBestMatch !== undefined && info.botMatch >= info.prevBestMatch + 300) hit.add("giant-killer");

  const awards: NewBadge[] = [...hit].map((id) => ({ id, again: !!before.earned[id] }));
  // Tiered badges: a new award only when the tier goes up.
  const tiered: Array<[string, number, string | undefined]> = [["club-legend", career.clubRight, clubLegendName(club)], ["groundhopper", career.clubs.length, undefined]];
  for (const [id, n, label] of tiered) {
    const t = tierFor(BADGE_BY_ID[id], n);
    const had = before.earned[id]?.tier;
    if (t && (!had || TIERS.indexOf(t) > TIERS.indexOf(had))) awards.push({ id, tier: t, again: false, ...(label ? { label } : {}) });
  }
  return { awards, career };
}

/** Records a finished game against a bot and returns the badges it won. */
export function awardBadges(info: FinishInfo, at = new Date(), storage: Store | undefined = safeStorage()): NewBadge[] {
  if (info.game.options.mode !== "bot" || !info.game.outcome) return [];
  const before = loadCabinet(storage);
  const { awards, career } = judge(info, before);
  const when = at.toISOString();
  const earned = { ...before.earned };
  for (const a of awards) {
    const e = earned[a.id];
    earned[a.id] = { first: e?.first ?? when, last: when, count: (e?.count ?? 0) + 1, ...(a.tier ? { tier: a.tier } : e?.tier ? { tier: e.tier } : {}), ...(a.label ?? e?.label ? { label: a.label ?? e?.label } : {}) };
  }
  saveCabinet({ earned, career }, storage);
  return awards;
}

// Trophies: one cup for each bot. The ladder bots play at one strength, so one cup each;
// the retired originals (Ollie, Ryan, Freddie) keep any bronze, silver or gold cups already won.
export const LADDER_CUPS: Record<string, string> = {
  pawny: "Sunday League Shield",
  eezy: "County Cup",
  chillwall: "League Two Trophy",
  "gambit-gary": "League One Trophy",
  "mo-mate": "Championship Trophy",
  knightingale: "The Cup",
  rookland: "League Title",
};
export const ORIGINALS = ["ollie", "ryan", "freddie"] as const;
export const LEVEL_TIER: Record<string, Tier> = { low: "bronze", medium: "silver", hard: "gold" };

export interface Cup { botId: string; name: string; who: string; tier: Tier; level?: string; won: number }

/** Every cup in the cabinet, won or not, from the high scores. */
export function cups(scores: Scores): Cup[] {
  const winsFor = (id: string, level?: string) => Object.entries(scores.bots)
    .filter(([k]) => k.split(":")[0] === id && (!level || k.split(":")[1] === level))
    .reduce((n, [, r]) => n + (r.won ?? 0), 0);
  const ladder = LADDER_BOT_IDS.map((id, i): Cup => ({ botId: id, name: LADDER_CUPS[id] ?? `${BOT_NAMES[id]} Cup`, who: BOT_NAMES[id] ?? id, tier: i < 2 ? "bronze" : i < 5 ? "silver" : "gold", won: winsFor(id) }));
  const originals = ORIGINALS.flatMap((id) => (["low", "medium", "hard"] as const).map((level): Cup => ({
    botId: id, name: `${BOT_NAMES[id]}'s Cup`, who: BOT_NAMES[id] ?? id, tier: LEVEL_TIER[level], level, won: winsFor(id, level),
  })));
  // The originals were retired on 2026-11-09: their cups stay in the cabinet only if they were won.
  return [...ladder, ...originals.filter((c) => c.won > 0)];
}
