// High scores: your record against each bot at each level, and Pass and Play wins by name.
// Kept in browser storage, so they live on this device only.

import type { GameState } from "./types";

export interface Record3 { played: number; won: number; drawn: number; lost: number; streak: number; best: number; formEarned: number }
export interface Scores { bots: Record<string, Record3>; local: Record<string, number> }

const KEY = "cft.scores.v1";
const empty = (): Record3 => ({ played: 0, won: 0, drawn: 0, lost: 0, streak: 0, best: 0, formEarned: 0 });

export function loadScores(): Scores {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") return { bots: raw.bots ?? {}, local: raw.local ?? {} };
  } catch { /* ignore */ }
  return { bots: {}, local: {} };
}

function save(s: Scores) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** Records a finished game. `level` is the bot level for vs-bot games. */
export function recordGame(game: GameState, level: string, formEarned: number): Scores {
  const s = loadScores();
  const o = game.outcome;
  if (!o) return s;
  const winner = "winner" in o ? o.winner : null;
  if (game.options.mode === "bot") {
    const human = game.players.white.kind === "human" ? "white" : "black";
    const bot = game.players[human === "white" ? "black" : "white"];
    const key = `${bot.botId}:${level}`;
    const r = { ...empty(), ...s.bots[key] };
    r.played++;
    r.formEarned += formEarned;
    if (!winner) { r.drawn++; r.streak = 0; }
    else if (winner === human) { r.won++; r.streak++; r.best = Math.max(r.best, r.streak); }
    else { r.lost++; r.streak = 0; }
    s.bots[key] = r;
  } else if (winner) {
    const name = game.players[winner].name;
    s.local[name] = (s.local[name] ?? 0) + 1;
  }
  save(s);
  return s;
}

export function resetScores() { save({ bots: {}, local: {} }); }
