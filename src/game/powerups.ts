// Power-up, chess hint and trivia hint definitions. Numbers come from
// docs/game-design.md and are first guesses to tune in playtesting.

import type { PowerUpId, TriviaHintId } from "./types";

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
}

export const POWER_UPS: PowerUpDef[] = [
  { id: "fergie-time", name: "Fergie Time", kind: "football", cost: 2, cooldown: 8, effect: "Adds a tenth of your starting time to your clock", target: "none", timedOnly: true },
  { id: "tactical-foul", name: "Tactical Foul", kind: "football", cost: 3, cooldown: 6, effect: "Freeze one enemy piece for their next turn", rule: "Not the king, or a piece giving check", target: "enemy-piece" },
  { id: "park-the-bus", name: "Park the Bus", kind: "football", cost: 3, cooldown: 6, effect: "Pieces on your back two ranks can't be captured next turn", rule: "Not while in check", target: "none" },
  { id: "var-review", name: "VAR Review", kind: "chess", cost: 3, cooldown: 10, effect: "Undo your last move and the opponent's reply", target: "none" },
  { id: "counter-attack", name: "Counter-Attack", kind: "chess", cost: 4, cooldown: 8, effect: "One pawn moves two squares from anywhere", rule: "Path must be clear; can't promote", target: "own-pawn" },
  { id: "substitution", name: "Substitution", kind: "chess", cost: 4, cooldown: 12, effect: "Bring a captured pawn back on your 2nd rank", target: "own-second-rank" },
  { id: "golden-boot", name: "Golden Boot", kind: "football", cost: 5, cooldown: 8, effect: "Your next capture earns +3 Form", target: "none" },
  { id: "formation-change", name: "Formation Change", kind: "chess", cost: 5, cooldown: 10, effect: "Swap two of your pieces (not the king)", rule: "Can't give check or leave you in check", target: "two-own-pieces" },
  { id: "super-sub", name: "Super-Sub", kind: "football", cost: 6, cooldown: 15, effect: "Upgrade a pawn to a knight", target: "own-pawn" },
  { id: "red-card", name: "Red Card", kind: "football", cost: 7, cooldown: 20, effect: "Send off one enemy pawn", rule: "Not a pawn on its 6th or 7th rank", target: "enemy-pawn" },
  { id: "extra-time", name: "Extra Time", kind: "chess", cost: 8, cooldown: 20, effect: "Make two moves this turn", rule: "Second move can't capture or give check", target: "none" },
  { id: "assistants-flag", name: "Assistant's Flag", kind: "hint", cost: 1, cooldown: 0, effect: "Shows every square the opponent attacks", target: "none" },
  { id: "scout-report", name: "Scout Report", kind: "hint", cost: 2, cooldown: 0, effect: "Shows the piece the opponent will most likely move next", target: "none", engine: true },
  { id: "masterclass", name: "Masterclass", kind: "chess", cost: 10, cooldown: 20, effect: "The engine plays the best move for you", rule: "Plays the best move your freezes and penalties allow", target: "none", engine: true },
  { id: "managers-tip", name: "Manager's Tip", kind: "hint", cost: 2, cooldown: 8, effect: "Shows the best move", target: "none", engine: true },
];

export const POWER_UP_BY_ID = Object.fromEntries(POWER_UPS.map((p) => [p.id, p])) as Record<PowerUpId, PowerUpDef>;

/** Cooldowns at the start of a game: every power-up starts locked for its cooldown. */
export function startingCooldowns(): Record<PowerUpId, number> {
  return Object.fromEntries(POWER_UPS.map((p) => [p.id, p.cooldown])) as Record<PowerUpId, number>;
}

export interface TriviaHintDef {
  id: TriviaHintId;
  name: string;
  cost: number;
  effect: string;
}

export const TRIVIA_HINTS: TriviaHintDef[] = [
  { id: "fifty-fifty", name: "50:50", cost: 1, effect: "Removes two wrong answers" },
  { id: "ask-the-crowd", name: "Ask the Crowd", cost: 1, effect: "A crowd vote that leans towards the right answer" },
  { id: "phone-a-friend", name: "Phone Ollie", cost: 2, effect: "Ollie suggests an answer" },
];

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
