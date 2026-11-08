// Power-up, chess hint and trivia hint definitions. Prices were rebalanced after
// playtest round 3 (see docs/game-design.md); tune further in playtesting.

import type { PowerUpId } from "./types";

export type TargetKind =
  | "none"
  /** An enemy piece that isn't the king. */
  | "enemy-piece"
  | "enemy-pawn"
  | "own-pawn"
  /** An empty square on your own 2nd rank. */
  | "own-second-rank"
  /** Two of your own pieces, not the king. */
  | "two-own-pieces";

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  kind: "football" | "chess" | "hint";
  cost: number;
  cooldown: number;
  effect: string;
  rule?: string;
  target: TargetKind;
  /** Only shown in timed games. */
  timedOnly?: boolean;
  /** Needs the chess engine. */
  engine?: boolean;
  /** Rough board value, 1 to 5 stars (about 1 star per half-pawn to pawn of advantage). */
  stars: 1 | 2 | 3 | 4 | 5;
}

/** Golden Boot: how many of your moves it lasts, and the Form each capture in them earns. */
export const GOLDEN_BOOT_MOVES = 3;
export const GOLDEN_BOOT_FORM = 2;
/** The "next power-up costs double" penalty only applies to (and is only cleared by) power-ups costing at least this. */
export const DOUBLE_COST_MIN = 3;

export const POWER_UPS: PowerUpDef[] = [
  { id: "fergie-time", name: "Fergie Time", kind: "football", cost: 2, cooldown: 8, stars: 2, effect: "Adds a tenth of your starting time to your clock", target: "none", timedOnly: true },
  { id: "tactical-foul", name: "Tactical Foul", kind: "football", cost: 5, cooldown: 10, stars: 2, effect: "Freeze one enemy piece for their next turn", rule: "Not the king, the queen, or a piece giving check", target: "enemy-piece" },
  { id: "park-the-bus", name: "Park the Bus", kind: "football", cost: 2, cooldown: 6, stars: 1, effect: "Pieces on your back two ranks can't be captured next turn", rule: "Not while in check", target: "none" },
  { id: "var-review", name: "VAR Review", kind: "chess", cost: 6, cooldown: 15, stars: 5, effect: "Undo your last move and the opponent's reply", rule: "Form, cooldowns, streaks and freezes go back too, and the cost comes out of the Form you had before that move", target: "none" },
  { id: "counter-attack", name: "Counter-Attack", kind: "chess", cost: 3, cooldown: 8, stars: 1, effect: "One pawn moves two squares from anywhere", rule: "Path must be clear; can't reach the 7th rank or skip past an enemy pawn", target: "own-pawn" },
  { id: "substitution", name: "Substitution", kind: "chess", cost: 4, cooldown: 12, stars: 3, effect: "Bring a captured pawn back on your 2nd rank", target: "own-second-rank" },
  { id: "golden-boot", name: "Golden Boot", kind: "football", cost: 2, cooldown: 8, stars: 1, effect: `Each capture in your next ${GOLDEN_BOOT_MOVES} moves earns +${GOLDEN_BOOT_FORM} Form`, rule: "This move counts as the first", target: "none" },
  { id: "formation-change", name: "Formation Change", kind: "chess", cost: 6, cooldown: 12, stars: 2, effect: "Swap two of your pieces (not the king)", rule: "Not while in check, not a frozen piece, no pawn past its 5th rank, and can't give check", target: "two-own-pieces" },
  { id: "super-sub", name: "Super-Sub", kind: "football", cost: 7, cooldown: 15, stars: 4, effect: "Upgrade a pawn to a knight", target: "own-pawn" },
  { id: "red-card", name: "Red Card", kind: "football", cost: 5, cooldown: 15, stars: 3, effect: "Send off one enemy pawn", rule: "Not a pawn on its 6th or 7th rank", target: "enemy-pawn" },
  { id: "extra-time", name: "Extra Time", kind: "chess", cost: 10, cooldown: 25, stars: 4, effect: "Make two moves this turn", rule: "Neither move can capture, and the second can't give check", target: "none" },
  { id: "assistants-flag", name: "Assistant's Flag", kind: "hint", cost: 1, cooldown: 3, stars: 1, effect: "Shows every square the opponent attacks", target: "none" },
  { id: "scout-report", name: "Scout Report", kind: "hint", cost: 2, cooldown: 4, stars: 1, effect: "Shows the piece the opponent will most likely move next", target: "none", engine: true },
  { id: "masterclass", name: "Masterclass", kind: "chess", cost: 6, cooldown: 12, stars: 3, effect: "The engine plays the best move for you", rule: "Plays the best move your freezes and penalties allow", target: "none", engine: true },
  { id: "managers-tip", name: "Manager's Tip", kind: "hint", cost: 4, cooldown: 10, stars: 2, effect: "Shows the best move", target: "none", engine: true },
];

export const POWER_UP_BY_ID = Object.fromEntries(POWER_UPS.map((p) => [p.id, p])) as Record<PowerUpId, PowerUpDef>;

/** Cooldowns at the start of a game: every power-up starts locked for its cooldown. */
export function startingCooldowns(): Record<PowerUpId, number> {
  return Object.fromEntries(POWER_UPS.map((p) => [p.id, p.cooldown])) as Record<PowerUpId, number>;
}

export const FORM_CAP = 12;

/** Clock lengths offered on the setup screen, in minutes each. */
export const TIME_CONTROLS = [3, 5, 10, 15, 30] as const;
export const DEFAULT_MINUTES = 10;

/** Fergie Time adds a tenth of the starting clock, rounded to 5 seconds: 3 min gets 20s, 10 min gets 1:00, 30 min gets 3:00. */
export function fergieMs(minutes: number = DEFAULT_MINUTES): number {
  return Math.max(5000, Math.round((minutes * 60_000 * 0.1) / 5000) * 5000);
}

export function fmtSeconds(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} seconds` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
