// Shared game types. Everything in GameState is plain data so it can be copied,
// snapshotted (for VAR Review) and handed to the bots.

import type { Handicap } from "./handicap";

export type Color = "white" | "black";
export type Difficulty = "easy" | "medium" | "hard";
export type PromoRole = "n" | "b" | "r" | "q";

export interface Question {
  id: string;
  question: string;
  options: string[];
  answer: number;
  difficulty: Difficulty;
  topic: string;
  club: string | null;
  verified: boolean;
  explanation?: string;
  source?: string;
}

export type PowerUpId =
  | "fergie-time"
  | "tactical-foul"
  | "park-the-bus"
  | "var-review"
  | "counter-attack"
  | "substitution"
  | "golden-boot"
  | "formation-change"
  | "super-sub"
  | "red-card"
  | "extra-time"
  | "assistants-flag"
  | "scout-report"
  | "managers-tip"
  | "masterclass";

export type TriviaHintId = "fifty-fifty" | "ask-the-crowd" | "phone-a-friend";

export interface PlayerState {
  name: string;
  kind: "human" | "bot";
  botId?: string;
  club: string | null;
  form: number;
  /** Form boost (handicap): the fraction of a Form point carried to the next right answer. */
  formCarry?: number;
  /** Own moves left before each power-up can be used again. 0 = ready. */
  cooldowns: Record<PowerUpId, number>;
  /** Moves made since the last question (Kick-off fires on the 4th quiet move). */
  kickoffCount: number;
  rightStreak: number;
  wrongStreak: number;
  /** Red card from four wrong answers in a row: next power-up costs double. */
  doubleNextPower: boolean;
  /** Golden Boot: own moves left in which each capture earns bonus Form. 0 = off. */
  goldenBootMoves: number;
  /** After claiming a Hot Spot, own moves left before Hot Spots count for this player again. 0 = ready. */
  hotSpotRest: number;
  /** Sent off: this player's next turn is skipped and the opponent takes a Free Kick. */
  sentOff: boolean;
  clockMs: number | null;
}

export interface Frozen {
  square: string;
  owner: Color;
  reason: "booked" | "foul";
}

export type TurnStep =
  /** A normal turn. */
  | "normal"
  /** Free Kick: an extra move that can't capture or give check. */
  | "free-kick"
  /** The second move of Extra Time: can't capture or give check. */
  | "extra-time";

export interface MoveRecord {
  color: Color;
  uci: string;
  san: string;
  step: TurnStep;
}

export interface Snapshot {
  fen: string;
  hotSpots: string[];
  frozen: Frozen[];
  parkTheBus: Color | null;
  captured: Record<Color, string[]>;
  history: MoveRecord[];
  repetition: Record<string, number>;
  lastMove: [string, string] | null;
  /** Both players as they were (VAR Review puts these back, apart from the clocks). */
  players: Record<Color, PlayerState>;
}

export type Outcome =
  | { kind: "checkmate"; winner: Color }
  | { kind: "resign"; winner: Color }
  | { kind: "timeout"; winner: Color }
  | { kind: "shootout"; winner: Color; score: Record<Color, number> }
  | { kind: "draw"; reason: DrawReason };

export type DrawReason = "stalemate" | "repetition" | "fifty-moves" | "insufficient" | "agreement";

export interface GameOptions {
  mode: "bot" | "local";
  trivia: boolean;
  timed: boolean;
  /** Minutes on each clock in a timed game (default 10). */
  minutes?: number;
  chess960: boolean;
  position: number;
  /** Pass and Play only: piece odds and a Form boost for the weaker player. */
  handicap?: Handicap | null;
}

export interface GameState {
  options: GameOptions;
  fen: string;
  players: Record<Color, PlayerState>;
  hotSpots: string[];
  frozen: Frozen[];
  /** The side whose back two ranks are protected during the opponent's next turn. */
  parkTheBus: Color | null;
  /** Pieces of each colour that have been captured, as role letters. */
  captured: Record<Color, string[]>;
  history: MoveRecord[];
  repetition: Record<string, number>;
  lastMove: [string, string] | null;
  step: TurnStep;
  /** Extra Time used this turn: the same player moves again after this move. */
  extraTimePending: boolean;
  /** A power-up (or chess hint) has been used this turn. */
  powerUsed: boolean;
  powerUsedId: PowerUpId | null;
  /** Counter-Attack: this pawn may move two squares this turn. */
  counterAttack: string | null;
  /** Snapshots taken before each normal move, for VAR Review. */
  snapshots: Array<{ color: Color; snap: Snapshot }>;
  outcome: Outcome | null;
  /** A draw that will go to a Penalty Shootout (trivia games only). */
  pendingDraw: DrawReason | null;
  log: string[];
}

/** What a move triggered, decided after the move is played. */
export type Trigger =
  | { kind: "none" }
  | { kind: "promotion"; role: PromoRole; square: string; bonus: boolean }
  | { kind: "hot-spot"; square: string }
  | { kind: "capture" }
  | { kind: "kickoff" };
