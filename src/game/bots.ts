// How the game talks to the bots. The bots (Stockfish, personalities) live in
// src/bots/ and are downloaded as a separate chunk the first time they're needed.

import type { BotPowerOptions } from "./botPowers";
import type { Difficulty, PromoRole } from "./types";

export type BotId =
  | "pawny" | "eezy" | "chillwall" | "gambit-gary" | "mo-mate" | "knightingale" | "rookland";
export type BotLevel = "low" | "medium" | "hard";
export type TalkMoment = "start" | "capture" | "lostPiece" | "oppWrong" | "ownRight" | "ownWrong" | "powerUp" | "hotSpot" | "win" | "loss";

/** The Elo ladder bots: one strength each, so no level is shown for them. */
export const LADDER_BOT_IDS: readonly string[] = ["pawny", "eezy", "chillwall", "gambit-gary", "mo-mate", "knightingale", "rookland"];

/** Display names, for screens that don't load the bots (high scores, history). Ollie, Ryan and Freddie were retired on 2026-11-09 but stay here for old history. */
export const BOT_NAMES: Record<string, string> = {
  ollie: "Ollie", ryan: "Ryan", freddie: "Freddie",
  pawny: "Pawny Dribbles", eezy: "Eezy Peasy", chillwall: "Billy Chillwall", "gambit-gary": "Gambit Gary",
  "mo-mate": "Mo Mate", knightingale: "Florence Knightingale", rookland: "Ragnar Rookland",
};

export interface BotRatingMeta { chess: number; trivia: number; triviaElo: number; match: number }
export interface BotMeta {
  id: BotId; name: string; club: string; blurb: string;
  /** One strength only (the Elo ladder): no level picker. */
  fixedLevel?: boolean;
  ratings?: Record<BotLevel, BotRatingMeta>;
}

export interface BotLike {
  chooseMove(req: { fen: string; chess960?: boolean; allowedMoves?: string[]; managersTip?: boolean; hotSpots?: string[]; goldenBoot?: boolean }): Promise<{ uci: string; thinkMs: number }>;
  chooseCard(req: { cards: { topic: string; difficulty: Difficulty; club: string | null }[]; puskasAllowed: boolean; form: number; bonusRound?: boolean }): { index: number; puskas: boolean } | Promise<{ index: number; puskas: boolean }>;
  answer(req: { question: { options: string[]; answer: number; difficulty: Difficulty; club?: string | null }; puskas?: boolean }): { choice: number; delayMs: number } | Promise<{ choice: number; delayMs: number }>;
  choosePowerUp(req: { fen: string; color?: "white" | "black"; form: number; available: { id: string; cost: number }[]; inCheck?: boolean; timed?: boolean; clockMs?: number; options?: BotPowerOptions }): { id: string; target?: string; target2?: string } | null | Promise<{ id: string; target?: string; target2?: string } | null>;
  promotionPick(): PromoRole;
  say(moment: TalkMoment): string | null;
}

export interface BotModule {
  createBot(id: BotId, level?: BotLevel): BotLike;
  BOTS: BotMeta[] | Record<string, BotMeta>;
  bestMove(fen: string, chess960?: boolean, depth?: number, searchMoves?: string[]): Promise<string | null>;
  /** A quick engine score from White's side, in centipawns (for the commentator). */
  evaluate?(fen: string, chess960?: boolean): Promise<number | null>;
}

// ---------------------------------------------------------------- loading

/**
 * Imports a lazy chunk, retrying once after a short wait. If it still fails, the most likely
 * cause is a page left open (or cached) from before a deploy, whose chunk files no longer exist,
 * so the page reloads once to pick up the new version. Playtest 2026-11-09: a silent failure here
 * used to swap in three stand-in bots and skip every question.
 */
export async function importWithRetry<T>(load: () => Promise<T>, opts: { retryMs?: number; reload?: () => void } = {}): Promise<T> {
  try {
    return await load();
  } catch (first) {
    await new Promise((r) => setTimeout(r, opts.retryMs ?? 800));
    try {
      return await load();
    } catch {
      console.error("Couldn't download part of the game", first);
      (opts.reload ?? reloadOnce)();
      throw first;
    }
  }
}

const RELOAD_KEY = "ttic-chunk-reload";

/** Reloads the page, but not twice within a minute (so a real outage doesn't loop). */
export function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

let loaded: Promise<BotModule> | null = null;
/** The bots. A failed download isn't remembered, so the next call tries again. */
export function loadBots(load: () => Promise<unknown> = () => import("../bots/index")): Promise<BotModule> {
  if (!loaded) {
    loaded = importWithRetry(load).then((m) => m as BotModule);
    loaded.catch(() => { loaded = null; });
  }
  return loaded;
}

/** For tests: forget the loaded bots. */
export function resetBotsForTest(): void {
  loaded = null;
}

export function botList(mod: BotModule): BotMeta[] {
  return Array.isArray(mod.BOTS) ? mod.BOTS : Object.values(mod.BOTS);
}
