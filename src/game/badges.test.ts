import { describe, expect, it } from "vitest";
import { awardBadges, cups, emptyFeats, judge, loadCabinet, type Cabinet, type Feats, type FinishInfo } from "./badges";
import { emptyStats } from "./history";
import { POWER_UPS } from "./powerups";
import type { GameState, MoveRecord, Outcome } from "./types";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const fresh = (): Cabinet => ({ earned: {}, career: { clubRight: 0, clubs: [], chess960Wins: 0, unbeaten: 0, powerUps: [] } });

function info(outcome: Outcome | null, feats: Partial<Feats> = {}, opts: { history?: MoveRecord[]; clockMs?: number | null; timed?: boolean; chess960?: boolean; asked?: number; right?: number; mode?: "bot" | "local" } = {}): FinishInfo {
  const p = (kind: "human" | "bot") => ({ name: kind, kind, club: "west-ham", form: 0, clockMs: opts.clockMs ?? null });
  const game = {
    options: { mode: opts.mode ?? "bot", timed: !!opts.timed, chess960: !!opts.chess960 },
    players: { white: p("human"), black: p("bot") },
    history: opts.history ?? Array.from({ length: 30 }, (_, i) => ({ color: i % 2 ? "black" : "white", san: "Nf3" })),
    outcome,
  } as unknown as GameState;
  const stats = emptyStats();
  stats.feats = { white: { ...emptyFeats(), ...feats }, black: emptyFeats() };
  stats.trivia.white = { asked: opts.asked ?? 0, right: opts.right ?? 0 };
  return { game, stats, human: "white" };
}
const win: Outcome = { kind: "resign", winner: "white" };
const ids = (i: FinishInfo, c = fresh()) => judge(i, c).awards.map((a) => a.id).sort();

describe("badges", () => {
  it("trivia feats", () => {
    expect(ids(info(win, { bestRun: 10, puskasRight: 1, hatTricks: 3, clueOne: 1 }, { asked: 6, right: 6 }))).toEqual(
      ["clean-sheet", "clue-one", "ebk", "hat-trick-hero", "pure-football", "puskas"]);
    expect(ids(info(win, { bestRun: 9, hatTricks: 2, powerUps: ["red-card"] }, { asked: 4, right: 4 }))).toEqual([]);
  });

  it("chess feats only count in a win", () => {
    const mate: Outcome = { kind: "checkmate", winner: "white" };
    const quick = [{ color: "white", san: "e4" }, { color: "black", san: "f6" }, { color: "white", san: "d4" }, { color: "black", san: "g5" }, { color: "white", san: "Qh5#" }] as MoveRecord[];
    expect(ids(info(mate, { powerUps: ["x"] }, { history: quick }))).toEqual(["early-kickoff"]);
    const pawnMate = [...quick.slice(0, 4), { color: "white", san: "exf7#" }] as MoveRecord[];
    expect(ids(info(mate, { powerUps: ["x"] }, { history: pawnMate }))).toContain("pawn-star");
    expect(ids(info(mate, { powerUps: ["x"] }, { history: [...quick.slice(0, 4), { color: "white", san: "e8=Q#" }] as MoveRecord[] }))).not.toContain("pawn-star");
    expect(ids(info(win, { worstCp: -500, powerUps: ["x"] }, { timed: true, clockMs: 9000 }))).toEqual(["fergie-time", "great-escape"]);
    expect(ids(info({ kind: "shootout", winner: "white", score: { white: 3, black: 2 } }, { powerUps: ["x"] }))).toEqual(["penalty-hero"]);
    expect(ids(info({ kind: "checkmate", winner: "black" }, { worstCp: -900 }, { history: quick, timed: true, clockMs: 100 }))).toEqual([]);
  });

  it("career badges build up over games and tiers only award when they go up", () => {
    const store = memStore();
    for (let i = 0; i < 9; i++) awardBadges(info(win, { powerUps: ["x"], clubRight: 1, clubsRight: [`c${i}`] }), undefined, store);
    expect(loadCabinet(store).career.unbeaten).toBe(9);
    const tenth = awardBadges(info(win, { powerUps: ["x"], clubRight: 1 }), undefined, store).map((a) => a);
    expect(tenth).toContainEqual({ id: "invincibles", again: false });
    expect(tenth).toContainEqual({ id: "club-legend", tier: "bronze", label: "Academy of Football", again: false });
    expect(awardBadges(info(win, { powerUps: ["x"], clubRight: 1 }), undefined, store).find((a) => a.id === "club-legend")).toBeUndefined();
    awardBadges(info({ kind: "timeout", winner: "black" }), undefined, store);
    expect(loadCabinet(store).career.unbeaten).toBe(0);
  });

  it("Full Squad, Chess960 Wanderer, Giant Killer", () => {
    const c = fresh();
    c.career.powerUps = POWER_UPS.slice(1).map((p) => p.id);
    c.career.chess960Wins = 4;
    expect(ids(info(win, { powerUps: [POWER_UPS[0].id] }, { chess960: true }), c)).toEqual(["full-squad", "wanderer"]);
    expect(ids({ ...info(win, { powerUps: ["x"] }), botMatch: 1500, prevBestMatch: 1200 })).toEqual(["giant-killer"]);
    expect(ids({ ...info(win, { powerUps: ["x"] }), botMatch: 1499, prevBestMatch: 1200 })).toEqual([]);
  });

  it("Pass and Play games don't count", () => {
    const store = memStore();
    expect(awardBadges(info(win, { bestRun: 12 }, { mode: "local" }), undefined, store)).toEqual([]);
  });

  it("cups come from the high scores", () => {
    const list = cups({ bots: { "rookland:medium": { played: 2, won: 1, drawn: 0, lost: 1, streak: 0, best: 1, formEarned: 0 }, "ollie:hard": { played: 1, won: 1, drawn: 0, lost: 0, streak: 1, best: 1, formEarned: 0 } }, local: {} });
    expect(list).toHaveLength(16);
    expect(list.find((c) => c.botId === "rookland")).toMatchObject({ name: "League Title", won: 1, tier: "gold" });
    expect(list.find((c) => c.botId === "ollie" && c.level === "hard")).toMatchObject({ won: 1, tier: "gold" });
    expect(list.find((c) => c.botId === "ollie" && c.level === "low")).toMatchObject({ won: 0 });
  });
});
