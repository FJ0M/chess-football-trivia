// Game history: a list of finished games, newest first, kept in browser storage on this device.
// List only (no replays). Each game keeps the date, who played, the result, Form earned and the trivia score.

import type { Color, GameState, Outcome } from "./types";
import type { Answer } from "./triviaElo";
import { emptyFeats, type Feats } from "./badges";

export interface Tally { right: number; asked: number }
/** What happened during a game that the final GameState doesn't remember. */
export interface MatchStats {
  formEarned: Record<Color, number>;
  trivia: Record<Color, Tally>;
  /** Each question card answered (not "Who am I?" or shootout kicks), for the trivia Elo. */
  answers: Record<Color, Answer[]>;
  /** What each side did that the badges need (see badges.ts). */
  feats?: Record<Color, Feats>;
}

export interface HistoryEntry {
  /** When the game ended, as an ISO date. */
  at: string;
  mode: "bot" | "local";
  names: Record<Color, string>;
  /** vs bot: which colour the human played, and the bot's level. */
  you?: Color;
  botId?: string;
  botLevel?: string;
  winner: Color | null;
  /** How it ended: checkmate, resign, timeout, shootout, or the draw reason. */
  how: string;
  /** Penalty Shootout score, if there was one. */
  shootout?: Record<Color, number>;
  moves: number;
  trivia: boolean;
  chess960: boolean;
  formEarned: Record<Color, number>;
  quiz: Record<Color, Tally>;
}

const KEY = "cft.history.v1";
/** Oldest games drop off after this many. */
export const HISTORY_MAX = 100;

export const emptyStats = (): MatchStats => ({
  formEarned: { white: 0, black: 0 },
  trivia: { white: { right: 0, asked: 0 }, black: { right: 0, asked: 0 } },
  answers: { white: [], black: [] },
  feats: { white: emptyFeats(), black: emptyFeats() },
});

type Store = Pick<Storage, "getItem" | "setItem">;
function safeStorage(): Store | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function loadHistory(storage: Store | undefined = safeStorage()): HistoryEntry[] {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object" && typeof e.at === "string" && e.names) : [];
  } catch { return []; }
}

function save(list: HistoryEntry[], storage: Store | undefined) {
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* private browsing or storage full */ }
}

function how(o: Outcome): string {
  return o.kind === "draw" ? o.reason : o.kind;
}

/** Builds the history entry for a finished game. Returns null if the game hasn't ended. */
export function entryFor(game: GameState, stats: MatchStats, botLevel: string, at = new Date()): HistoryEntry | null {
  const o = game.outcome;
  if (!o) return null;
  const { white, black } = game.players;
  const bot = game.options.mode === "bot";
  const you: Color | undefined = bot ? (white.kind === "human" ? "white" : "black") : undefined;
  const botPlayer = you ? game.players[you === "white" ? "black" : "white"] : undefined;
  return {
    at: at.toISOString(),
    mode: game.options.mode,
    names: { white: white.name, black: black.name },
    ...(bot ? { you, botId: botPlayer?.botId, botLevel } : {}),
    winner: "winner" in o ? o.winner : null,
    how: how(o),
    ...(o.kind === "shootout" ? { shootout: o.score } : {}),
    moves: Math.ceil(game.history.length / 2),
    trivia: game.options.trivia,
    chess960: game.options.chess960,
    formEarned: { ...stats.formEarned },
    quiz: { white: { ...stats.trivia.white }, black: { ...stats.trivia.black } },
  };
}

/** Adds a finished game to the front of the history. */
export function recordHistory(entry: HistoryEntry, storage: Store | undefined = safeStorage()): HistoryEntry[] {
  const list = [entry, ...loadHistory(storage)].slice(0, HISTORY_MAX);
  save(list, storage);
  return list;
}

export function clearHistory(storage: Store | undefined = safeStorage()) { save([], storage); }

/** Plain words for each kind of draw. */
export const DRAW_WORDS: Record<string, string> = {
  stalemate: "stalemate", repetition: "repetition", "fifty-moves": "the 50-move rule", insufficient: "not enough pieces", agreement: "agreement", "timeout-insufficient": "time ran out, but the other side couldn't mate",
};
const WIN_WORDS: Record<string, string> = { checkmate: "checkmate", resign: "resignation", timeout: "time", shootout: "penalties" };

/** "Won by checkmate", "Lost on penalties 3-4", "Drawn by stalemate", or for Pass and Play "Freddie won by checkmate". */
export function resultText(e: HistoryEntry): string {
  if (!e.winner) return `Drawn by ${DRAW_WORDS[e.how] ?? e.how}`;
  const by = e.how === "shootout" ? `on penalties${e.shootout ? ` ${e.shootout[e.winner]}-${e.shootout[e.winner === "white" ? "black" : "white"]}` : ""}`
    : e.how === "timeout" ? "on time" : `by ${WIN_WORDS[e.how] ?? e.how}`;
  if (e.you) return `${e.winner === e.you ? "Won" : "Lost"} ${by}`;
  return `${e.names[e.winner]} won ${by}`;
}

/** "won" / "lost" / "drawn" from the human's side (vs bot), or "decided" / "drawn" for Pass and Play. */
export function resultKind(e: HistoryEntry): "won" | "lost" | "drawn" | "decided" {
  if (!e.winner) return "drawn";
  if (!e.you) return "decided";
  return e.winner === e.you ? "won" : "lost";
}
