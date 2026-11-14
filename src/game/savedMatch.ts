// The match in progress, saved after every finished turn so it survives the phone
// reloading the page (an iPhone does that after a call or a while in another app).
// Only one match is kept: starting a new one replaces it, and it's removed at full time.

import type { MatchStats } from "./history";
import type { GameState } from "./types";
import type { SetupChoice } from "./match";

const KEY = "cft.match.v1";

export interface SavedMatch {
  v: 1;
  setup: SetupChoice;
  game: GameState;
  stats: MatchStats;
  savedAt: string;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function safeStorage(): Store | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function saveMatch(setup: SetupChoice, game: GameState, stats: MatchStats, storage: Store | undefined = safeStorage()): void {
  if (game.outcome) { clearMatch(storage); return; }
  // VAR Review only ever goes back one turn, so older snapshots aren't worth the space.
  const slim: GameState = { ...game, snapshots: game.snapshots.slice(-2) };
  const saved: SavedMatch = { v: 1, setup, game: slim, stats, savedAt: new Date().toISOString() };
  try { storage?.setItem(KEY, JSON.stringify(saved)); } catch { /* storage full or private browsing: carry on unsaved */ }
}

export function loadMatch(storage: Store | undefined = safeStorage()): SavedMatch | null {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null");
    if (!raw || raw.v !== 1 || !raw.game?.fen || !raw.setup?.players || raw.game.outcome) return null;
    return raw as SavedMatch;
  } catch { return null; }
}

export function clearMatch(storage: Store | undefined = safeStorage()): void {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
}

/** "vs Pawny Dribbles · move 12" for the Resume button. */
export function matchLabel(m: SavedMatch): string {
  const g = m.game;
  const other = g.players.white.kind === "bot" ? g.players.white : g.players.black.kind === "bot" ? g.players.black : null;
  const vs = other ? `vs ${other.name}` : `${g.players.white.name} vs ${g.players.black.name}`;
  return `${vs} · move ${Math.ceil((g.history.length + 1) / 2)}`;
}
