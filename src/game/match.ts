// The match rules engine: one reducer that runs a whole match. Every player action, bot
// action and clock tick goes through step(), which returns the next match and a list of
// effects (sounds, animation events, bot chatter, delayed actions, engine lookups) for
// the UI to carry out. step() never touches the clock, the network or the screen itself:
// the time comes in with each action (Env.now), and the question banks are handed in.
//
// rules.ts holds the chess and trivia rules for a single step (a move, an answer, a
// power-up); this file sequences them into turns, questions, results and the shootout.
// useGame.ts is the React shell around it: timers, downloads, bots and sounds.

import { opposite } from "chessops/util";
import type { SfxName } from "../audio/sfx";
import type { TalkMoment } from "./bots";
import { POWER_UP_BY_ID } from "./powerups";
import {
  addIncrement, applyAnswer, attackedSquares, earnedPiece, endInDraw, finishTurn, flipTurn, legalMoves, playMove, positionOf,
  powerBlocked, resign as resignRule, resolveMove, resolvePromotion, safePromotion, setClock, skipExtraTime, timeout, turnOf,
  usePowerUp, withClocksFrom, type MoveResult,
} from "./rules";
import { TIMER_MS, type Card, type QuestionBank } from "./trivia";
import { CLUE_MS, type WhoAmI, type WhoAmIBank } from "./whoami";
import { DRAW_WORDS } from "./history";
import { material } from "./material";
import type { BotLevel } from "./bots";
import type { Color, GameOptions, GameState, PowerUpId, PromoRole, Question } from "./types";
import type { PlayerInit } from "./rules";

// ---------------------------------------------------------------- state

/** How a match was set up (and how a saved one is set up again). */
export interface SetupChoice {
  options: GameOptions;
  players: Record<Color, PlayerInit>;
  botLevel: BotLevel;
  /** A league season match: which one, so the result is recorded against it (see season.ts). */
  season?: { key: string; kind: "league" | "cup" };
}

export type Phase =
  | { kind: "move" }
  | { kind: "target"; power: PowerUpId; first?: string }
  /** Waiting on the engine for Manager's Tip or Scout Report. */
  | { kind: "thinking"; power: PowerUpId }
  | { kind: "cards"; color: Color; cards: Card[]; bonus: boolean; landed: string | null; label: string }
  | {
      kind: "question"; color: Color; q: Question; card: Card; puskas: boolean; bonus: boolean; landed: string | null;
      startedAt: number; limitMs: number; label: string;
    }
  | { kind: "whoami"; color: Color; set: WhoAmI; square: string; clues: number; clueAt: number; bonus: boolean }
  /** A right "Who am I?": the player picks the earned piece or a lower one (handy when a queen would stalemate). */
  | { kind: "promote"; color: Color; set: WhoAmI; square: string; clues: number; earned: PromoRole }
  | {
      kind: "result"; color: Color; correct: boolean; title: string; lines: string[]; options: string[]; answer: number;
      choice: number | null; explanation?: string; next: GameState; auto: boolean;
      /** When the result appeared: it moves on by itself after RESULT_MS. */
      shownAt: number;
    }
  | { kind: "shootout"; kicks: Array<{ color: Color; scored: boolean }>; q: Question; startedAt: number; choice: number | null; taker: Color }
  | { kind: "over" };

/** Things that just happened, for the animations and the commentator. Each has a unique id. */
export type GameEvent = { id: number; at: number } & (
  | { kind: "move"; color: Color; from: string; to: string; captured: string | null; check: boolean; castle: boolean }
  | { kind: "power"; color: Color; power: PowerUpId; square?: string; square2?: string }
  | { kind: "answer"; color: Color; correct: boolean; puskas: boolean; hatTrick: boolean }
  | { kind: "whoami"; color: Color; correct: boolean }
  | { kind: "hot-spot"; color: Color; square: string }
  | { kind: "ebk"; color: Color }
  | { kind: "checkmate"; winner: Color }
  | { kind: "shootout" }
);
export type NewEvent = GameEvent extends infer E ? E extends GameEvent ? Omit<E, "id" | "at"> : never : never;

export interface Overlay {
  attacked?: string[];
  tip?: [string, string];
  scout?: string;
}

/** Everything about a match in progress that the rules decide. */
export interface Match {
  game: GameState;
  phase: Phase;
  /** The line under the board ("Ryan to move", "Free Kick to Ollie"…). */
  note: string;
  overlay: Overlay;
  /** Right answers in a row for each side (unlike rightStreak, this doesn't reset at a hat-trick). */
  runs: Record<Color, number>;
  /** Who has earned Elite Ball Knowledge this match. */
  ebk: Record<Color, boolean>;
}

/** The question banks one side draws from (each human player has their own "seen" list). */
export interface Banks {
  bank: Pick<QuestionBank, "deal" | "draw" | "any">;
  whoami: Pick<WhoAmIBank, "draw" | "check">;
}
export type Data = Record<Color, Banks>;

/** What step() is told about the outside world. */
export interface Env {
  /** The time now, in ms (Date.now() in the app). */
  now: number;
  /** The question banks, or null while they're still downloading (moves then trigger nothing). */
  banks: Data | null;
  /** The chess engine has loaded (needed for Manager's Tip and Scout Report). */
  engineReady: boolean;
}

/** Right answers in a row for the Elite Ball Knowledge badge. */
export const EBK_RUN = 10;
/** The result screen moves on by itself after this long (the chess clock is running). */
export const RESULT_MS = 2500;
/** A person gets longer to read the answer and its explanation ("Play on" moves on sooner). */
export const RESULT_MS_HUMAN = 5000;
/** After a penalty, the shootout waits this long before the next kick. */
export const KICK_PAUSE_MS = 1800;
/** Difficulty names, as goals: Tap-in, Highlight, Screamer, and the Puskás (the top-tier upgrade of a Screamer). */
export const DIFF_LABEL = { easy: "Tap-in", medium: "Highlight", hard: "Screamer" } as const;
export const TOP_TIER = "Puskás";

export function cardLabel(c: Card, puskas = false): string {
  return `${c.topic} · ${puskas ? TOP_TIER : DIFF_LABEL[c.difficulty]}`;
}

/** A match about to kick off, or a saved one picking up where it was (the position after the last finished turn). */
export function startMatch(game: GameState, resumed = false): Match {
  return {
    game: resumed ? { ...game, step: game.step ?? "normal" } : game,
    phase: { kind: "move" },
    note: resumed ? "Welcome back! The match carries on where you left it" : "Kick-off! White to move",
    overlay: {},
    runs: { white: 0, black: 0 },
    ebk: { white: false, black: false },
  };
}

// ---------------------------------------------------------------- save/resume and the season

/**
 * The game to save now, or null. A match is saved after every finished turn (back to "move")
 * and at full time, so a reload picks up at the start of a turn, never halfway through a
 * question. With `midTurn` (the app being hidden) the clocks as they are now are saved too,
 * but still only while it's someone's move.
 */
export function savable(m: Pick<Match, "game" | "phase">, midTurn = false): GameState | null {
  if (midTurn) return m.phase.kind === "move" && !m.game.outcome ? m.game : null;
  return m.phase.kind === "move" || m.game.outcome ? m.game : null;
}

/** A finished match from one side's view, for the league table and the Cup: goals are pieces taken, and a shootout win counts as a win. */
export function seasonResult(game: GameState, side: Color): { goalsFor: number; goalsAgainst: number; result: "won" | "lost" | "drawn" } {
  const goals = material(game.captured).goals;
  const winner = game.outcome && "winner" in game.outcome ? game.outcome.winner : null;
  return { goalsFor: goals[side], goalsAgainst: goals[opposite(side)], result: winner === side ? "won" : winner ? "lost" : "drawn" };
}

// ---------------------------------------------------------------- actions and effects

export type Action =
  /** A person's move (checked against the rules). */
  | { type: "move"; uci: string }
  /** A bot's move, already checked by the bot loop. */
  | { type: "bot-move"; color: Color; uci: string }
  /** A person taps a power-up button. */
  | { type: "power"; id: PowerUpId }
  /** A person taps a square while picking a power-up target. */
  | { type: "target"; square: string }
  /** The engine answered for Manager's Tip or Scout Report: its move, null if it had none, or "error". */
  | { type: "lookup-done"; id: PowerUpId; color: Color; targets: string[]; best: string | null | "error" }
  /** A bot uses a power-up (bots plan their own, so there's no engine lookup or overlay). */
  | { type: "bot-power"; color: Color; id: PowerUpId; targets: string[] }
  /** Extra Time's second move is optional. */
  | { type: "skip-extra" }
  | { type: "pick"; index: number; puskas: boolean }
  | { type: "answer"; choice: number | null }
  | { type: "next-clue" }
  /** A "Who am I?" guess: typed text from a player, an option index from a bot, or null when time runs out. */
  | { type: "guess"; input: string | number | null }
  /** The piece a player picked after a right "Who am I?". */
  | { type: "promote"; role: PromoRole }
  /** Move on from the result screen. */
  | { type: "continue" }
  | { type: "kick"; choice: number | null }
  /** The pause after a penalty is over: the next kick, or the end of the shootout. */
  | { type: "kick-settle" }
  | { type: "resign"; color: Color }
  | { type: "agree-draw" }
  /** Time passes: question timers, clues, results and the chess clock. Not sent while paused. */
  | { type: "tick"; dt: number }
  /** The match was paused for this long: question timers carry on where they were. */
  | { type: "unpause"; pausedMs: number }
  | { type: "note"; text: string };

export type Effect =
  | { kind: "sfx"; sound: SfxName; delayMs?: number }
  | { kind: "event"; event: NewEvent; delayMs?: number }
  /** A bot's speech bubble (nothing happens if that side isn't a bot). */
  | { kind: "talk"; color: Color; moment: TalkMoment }
  /** Send this action after a delay. */
  | { kind: "later"; delayMs: number; action: Action }
  /** Ask the engine for its best move, then send "lookup-done". */
  | { kind: "lookup"; id: PowerUpId; color: Color; targets: string[]; fen: string; chess960: boolean; allowed?: string[] };

export interface Step {
  match: Match;
  fx: Effect[];
}

// ---------------------------------------------------------------- the reducer

/** Runs one action. The match passed in is never changed; an action that doesn't apply returns it as it was. */
export function step(match: Match, action: Action, env: Env): Step {
  const t = new Turn(match, env);
  t.run(action);
  return { match: t.m, fx: t.fx };
}

/** Whose chess clock is running in this phase, or null when the clocks are stopped. */
export function clockOwner(g: GameState, p: Phase): Color | null {
  switch (p.kind) {
    case "move": case "target": case "thinking": return turnOf(g);
    case "cards": case "question": case "result": return p.color;
    default: return null; // "Who am I?", shootout, game over
  }
}

/** The side that has to do something now (move, answer, kick), or null. Bots act when it's theirs. */
export function actorOf(m: Match): Color | null {
  const p = m.phase;
  if (m.game.outcome) return null;
  if (p.kind === "move") return turnOf(m.game);
  if (p.kind === "cards" || p.kind === "question" || p.kind === "whoami" || p.kind === "result") return p.color;
  if (p.kind === "shootout" && p.choice === null) return p.taker;
  return null;
}

/** The shootout winner, or null if it isn't decided yet (5 each, then sudden death). */
export function shootoutWinner(kicks: Array<{ color: Color; scored: boolean }>): Color | null {
  const taken = (c: Color) => kicks.filter((k) => k.color === c).length;
  const goals = (c: Color) => kicks.filter((k) => k.color === c && k.scored).length;
  const w = goals("white"), b = goals("black"), tw = taken("white"), tb = taken("black");
  if (tw <= 5 && tb <= 5) {
    if (w > b + (5 - tb)) return "white";
    if (b > w + (5 - tw)) return "black";
    if (tw === 5 && tb === 5) return w > b ? "white" : b > w ? "black" : null;
    return null;
  }
  if (tw === tb && w !== b) return w > b ? "white" : "black";
  return null;
}

export function positionCheck(g: GameState): boolean {
  // In check if the side to move has its king attacked.
  try {
    return positionOf(g.fen).isCheck();
  } catch { return false; }
}

export function targetPrompt(t: string): string {
  switch (t) {
    case "enemy-piece": return "tap an enemy piece";
    case "enemy-pawn": return "tap an enemy pawn";
    case "own-pawn": return "tap one of your pawns";
    case "own-second-rank": return "tap an empty square on your 2nd rank";
    case "two-own-pieces": return "tap the first of two pieces to swap";
    default: return "";
  }
}

/** One step's worth of work: the match as it changes, and the effects collected on the way. */
class Turn {
  fx: Effect[] = [];
  constructor(public m: Match, private env: Env) {}

  // ---- small helpers
  private get g() { return this.m.game; }
  private get p() { return this.m.phase; }
  private setGame(game: GameState) { this.m = { ...this.m, game }; }
  private go(phase: Phase) { this.m = { ...this.m, phase }; }
  private note(note: string) { this.m = { ...this.m, note }; }
  private overlay(overlay: Overlay) { this.m = { ...this.m, overlay }; }
  private sfx(sound: SfxName, delayMs?: number) { this.fx.push(delayMs ? { kind: "sfx", sound, delayMs } : { kind: "sfx", sound }); }
  private emit(event: NewEvent, delayMs?: number) { this.fx.push(delayMs ? { kind: "event", event, delayMs } : { kind: "event", event }); }
  private talk(color: Color, moment: TalkMoment) { this.fx.push({ kind: "talk", color, moment }); }
  /** Lets every bot react to something (their own moment, or the opponent's). */
  private react(actor: Color, own: TalkMoment, other?: TalkMoment) {
    this.talk(actor, own);
    if (other) this.talk(opposite(actor), other);
  }
  private isBot(c: Color) { return this.g.players[c].kind === "bot"; }
  private get banks() { return this.env.banks; }

  run(a: Action): void {
    switch (a.type) {
      case "move": this.move(a.uci); break;
      case "bot-move": this.afterMove(playMove(this.g, a.uci), a.color); break;
      case "power": this.choosePower(a.id); break;
      case "target": this.tapTarget(a.square); break;
      case "lookup-done": this.lookupDone(a); break;
      case "bot-power": this.botPower(a.color, a.id, a.targets); break;
      case "skip-extra": this.skipExtra(); break;
      case "pick": this.pickCard(a.index, a.puskas); break;
      case "answer": this.answer(a.choice); break;
      case "next-clue": this.nextClue(); break;
      case "guess": this.guess(a.input); break;
      case "promote": this.promote(a.role); break;
      case "continue": this.continueOn(); break;
      case "kick": this.kick(a.choice); break;
      case "kick-settle": this.kickSettle(); break;
      case "resign": this.resign(a.color); break;
      case "agree-draw": this.agreeDraw(); break;
      case "tick": this.tick(a.dt); break;
      case "unpause": this.unpause(a.pausedMs); break;
      case "note": this.note(a.text); break;
    }
  }

  // ---- ending a turn

  /** A drawn game goes to a Penalty Shootout. Without the questions (still downloading) it just ends as a draw. */
  private startShootout(state: GameState) {
    const reason = state.pendingDraw;
    if (!reason) return;
    if (!this.banks) {
      this.setGame({ ...state, pendingDraw: null, outcome: { kind: "draw", reason } });
      this.sfx("fulltime");
      this.go({ kind: "over" });
      return;
    }
    this.setGame(state);
    this.note(reason === "timeout-insufficient"
      ? "Time's up, but there's nothing left to mate with, so it goes to a Penalty Shootout!"
      : `It's a draw (${DRAW_WORDS[reason] ?? reason}), so it goes to a Penalty Shootout!`);
    this.emit({ kind: "shootout" });
    this.sfx("kickoff");
    this.go({ kind: "shootout", kicks: [], q: this.banks.white.bank.any("medium"), startedAt: this.env.now, choice: null, taker: "white" });
  }

  private endTurn(state: GameState) {
    const { state: next, notes } = finishTurn(state);
    this.setGame(next);
    this.overlay({});
    if (notes.length) this.note(notes.join(". "));
    if (next.outcome) {
      this.sfx("fulltime");
      if (next.outcome.kind === "checkmate") this.emit({ kind: "checkmate", winner: next.outcome.winner });
      const w = "winner" in next.outcome ? next.outcome.winner : null;
      if (w) { this.react(w, "win"); this.react(opposite(w), "loss"); }
      this.go({ kind: "over" });
      return;
    }
    if (next.pendingDraw) { this.startShootout(next); return; }
    if (!notes.length) this.note(`${next.players[turnOf(next)].name} to move`);
    if (positionCheck(next)) this.sfx("check");
    this.go({ kind: "move" });
  }

  // ---- moves

  private move(uci: string) {
    if (this.p.kind !== "move" || this.g.outcome) return;
    const m = resolveMove(this.g, uci);
    if (!m) return;
    this.afterMove(playMove(this.g, m), turnOf(this.g));
  }

  private afterMove(res: MoveResult, mover: Color) {
    // +3 seconds on the mover's clock for every move (timed games).
    const r = { ...res, state: addIncrement(res.state, mover) };
    this.setGame(r.state);
    this.overlay({});
    this.sfx(r.captured ? "capture" : "move");
    const lm = r.state.lastMove;
    if (lm) this.emit({ kind: "move", color: mover, from: lm[0], to: lm[1], captured: r.captured, check: r.check, castle: r.san.startsWith("O-O") });
    if (r.captured) this.react(mover, "capture", "lostPiece");
    const name = r.state.players[mover].name;
    const t = r.trigger;
    const banks = this.banks;
    if (t.kind === "none" || !banks) { this.endTurn(r.state); return; }
    if (t.kind === "promotion") {
      this.sfx("kickoff");
      this.note(`${name} reaches the end: "Who am I?" decides the new piece`);
      const club = r.state.players[mover].club;
      const set = banks[mover].whoami.draw(club);
      this.go({ kind: "whoami", color: mover, set, square: t.square, clues: 1, clueAt: this.env.now, bonus: !!club && set.club === club });
      return;
    }
    const bonus = t.kind === "hot-spot";
    if (bonus) { this.sfx("cheer"); this.talk(mover, "hotSpot"); this.emit({ kind: "hot-spot", color: mover, square: r.landed }); }
    else this.sfx("kickoff");
    const label = bonus ? "Hot Spot: pick a question" : t.kind === "capture" ? "Capture: pick a question" : "Set piece: pick a question";
    this.note(`${name}: ${label}`);
    this.go({ kind: "cards", color: mover, cards: banks[mover].bank.deal(r.state.players[mover].club), bonus, landed: r.landed, label });
  }

  // ---- power-ups

  /** Spends the Form and applies the effect, on the match as it is now. */
  private commitPower(me: Color, id: PowerUpId, targets: string[]): GameState {
    const res = usePowerUp(this.g, id, targets);
    this.setGame(res.state);
    this.sfx("powerup");
    this.note(res.note ?? "");
    this.talk(me, "powerUp");
    this.emit({ kind: "power", color: me, power: id, square: targets[0], square2: targets[1] });
    return res.state;
  }

  /** Engine power-ups ask the engine first, so a failed lookup costs nothing. Returns an error, or null. */
  private applyPower(id: PowerUpId, targets: string[]): string | null {
    const g = this.g;
    const me = turnOf(g);
    const check = usePowerUp(g, id, targets);
    if (check.error) { this.sfx("locked"); this.note(check.error); return check.error; }
    if (!POWER_UP_BY_ID[id].engine) {
      this.commitPower(me, id, targets);
      if (id === "assistants-flag") this.overlay({ attacked: attackedSquares(g.fen, opposite(me)) });
      return null;
    }
    if (!this.env.engineReady) { this.sfx("locked"); this.note("The engine is still warming up. Try again in a moment"); return "engine"; }
    const fen = id === "scout-report" ? flipTurn(g.fen) : g.fen;
    if (!fen) { this.sfx("locked"); this.note("The scouts can't read the game right now"); return "engine"; }
    this.go({ kind: "thinking", power: id });
    this.note(`${POWER_UP_BY_ID[id].name}: thinking…`);
    // Manager's Tip only looks at moves the game allows right now (a frozen piece or Park the Bus can rule out the engine's favourite).
    const allowed = id === "managers-tip" ? legalMoves(g).moves : undefined;
    this.fx.push({ kind: "lookup", id, color: me, targets, fen, chess960: g.options.chess960, ...(allowed ? { allowed } : {}) });
    return null;
  }

  private lookupDone(a: Extract<Action, { type: "lookup-done" }>) {
    if (a.best === "error") { this.go({ kind: "move" }); this.note("The engine didn't answer, so no Form spent"); return; }
    const legal = a.best ? (a.id === "scout-report" ? a.best : resolveMove(this.g, a.best)) : null;
    const name = POWER_UP_BY_ID[a.id].name;
    if (!legal) { this.go({ kind: "move" }); this.note(`${name}: the gaffer's stumped, so no Form spent`); return; }
    this.commitPower(a.color, a.id, a.targets);
    this.go({ kind: "move" });
    if (a.id === "managers-tip") {
      this.overlay({ tip: [legal.slice(0, 2), legal.slice(2, 4)] });
      this.note(`Manager's Tip: ${legal.slice(0, 2)} to ${legal.slice(2, 4)}`);
    } else {
      this.overlay({ scout: legal.slice(0, 2) });
      this.note(`Scout Report: watch the piece on ${legal.slice(0, 2)}`);
    }
  }

  private botPower(color: Color, id: PowerUpId, targets: string[]) {
    const res = usePowerUp(this.g, id, targets);
    if (res.error) return;
    this.setGame(res.state);
    this.sfx("powerup");
    this.note(res.note ?? "");
    this.talk(color, "powerUp");
    this.emit({ kind: "power", color, power: id, square: targets[0], square2: targets[1] });
  }

  private skipExtra() {
    if (this.p.kind !== "move") return;
    const next = skipExtraTime(this.g);
    if (!next) return;
    this.sfx("select");
    this.endTurn(next);
  }

  private choosePower(id: PowerUpId) {
    // Once a power-up is confirmed it can't be cancelled or swapped.
    if (this.p.kind !== "move") return;
    const blocked = powerBlocked(this.g, id);
    const def = POWER_UP_BY_ID[id];
    if (blocked) { this.sfx("locked"); this.note(`${def.name}: ${blocked}`); return; }
    if (def.target === "none") { this.applyPower(id, []); return; }
    this.sfx("select");
    this.note(`${def.name}: ${targetPrompt(def.target)}`);
    this.go({ kind: "target", power: id });
  }

  private tapTarget(sq: string) {
    const p = this.p;
    if (p.kind !== "target") return;
    const def = POWER_UP_BY_ID[p.power];
    if (def.target === "two-own-pieces" && !p.first) {
      this.sfx("select");
      this.note(`${def.name}: now tap the piece to swap with`);
      this.go({ ...p, first: sq });
      return;
    }
    const err = this.applyPower(p.power, p.first ? [p.first, sq] : [sq]);
    if (!err) this.go({ kind: "move" });
    else if (p.first) this.go({ ...p, first: undefined });
  }

  // ---- questions

  private pickCard(index: number, puskas: boolean) {
    const p = this.p;
    if (p.kind !== "cards" || !this.banks) return;
    const card = p.cards[index];
    const isPuskas = puskas && card.difficulty === "hard";
    this.sfx("select");
    this.go({
      kind: "question", color: p.color, q: this.banks[p.color].bank.draw(card), card, puskas: isPuskas, bonus: p.bonus, landed: p.landed,
      startedAt: this.env.now, limitMs: isPuskas ? TIMER_MS.puskas : TIMER_MS.normal, label: cardLabel(card, isPuskas),
    });
  }

  /** Counts towards Elite Ball Knowledge (10 right in a row). */
  private countAnswer(c: Color, correct: boolean) {
    const run = correct ? this.m.runs[c] + 1 : 0;
    this.m = { ...this.m, runs: { ...this.m.runs, [c]: run } };
    if (run === EBK_RUN) {
      this.m = { ...this.m, ebk: { ...this.m.ebk, [c]: true } };
      this.emit({ kind: "ebk", color: c }, 700);
      this.sfx("cheer", 700);
    }
  }

  private answer(choice: number | null) {
    const p = this.p;
    if (p.kind !== "question") return;
    const ms = this.env.now - p.startedAt;
    const correct = choice === p.q.answer && ms <= p.limitMs + 250;
    const hatTrick = correct && this.g.players[p.color].rightStreak === 2;
    const out = applyAnswer(this.g, {
      color: p.color, difficulty: p.card.difficulty, puskas: p.puskas, bonus: p.bonus, correct, ms, landed: p.landed,
    });
    this.setGame(out.state);
    this.emit({ kind: "answer", color: p.color, correct, puskas: p.puskas, hatTrick });
    this.countAnswer(p.color, correct);
    if (correct) { this.sfx("correct"); this.sfx("form", 300); this.talk(p.color, "ownRight"); }
    else { this.sfx("wrong"); this.sfx("groan", 350); this.react(p.color, "ownWrong", "oppWrong"); }
    const who = out.state.players[p.color].name;
    this.go({
      kind: "result", color: p.color, correct, title: correct ? `${who} got it right!` : choice === null ? "Time's up!" : `${who} got it wrong`,
      lines: out.lines, options: p.q.options, answer: p.q.answer, choice, explanation: p.q.explanation, next: out.state, auto: this.isBot(p.color),
      shownAt: this.env.now,
    });
  }

  private nextClue() {
    const p = this.p;
    if (p.kind !== "whoami") return;
    if (p.clues >= 5) { this.guess(null); return; }
    this.sfx("tick");
    this.go({ ...p, clues: p.clues + 1, clueAt: this.env.now });
  }

  /** Ends a "Who am I?": sets the piece and shows the result. */
  private finishWhoAmI(p: { color: Color; set: WhoAmI; square: string; clues: number }, correct: boolean, typed: string | null, timedOut: boolean, pick?: PromoRole) {
    const name = p.set.name ?? p.set.options[p.set.answer];
    const res = resolvePromotion(this.g, p.square, p.clues, correct, pick);
    this.setGame(res.state);
    this.emit({ kind: "whoami", color: p.color, correct });
    this.countAnswer(p.color, correct);
    if (correct) { this.sfx("correct"); this.sfx("cheer", 350); this.talk(p.color, "ownRight"); }
    else { this.sfx("wrong"); this.react(p.color, "ownWrong", "oppWrong"); }
    const who = res.state.players[p.color].name;
    const rest = p.set.clues.slice(p.clues);
    this.go({
      kind: "result", color: p.color, correct,
      title: correct ? `${who} got it on clue ${p.clues}!` : timedOut ? "Time's up!" : `${who} got it wrong`,
      lines: [
        ...(typed && !correct ? [`"${typed}" isn't right: it was ${name}`] : []),
        res.line,
      ],
      options: [name], answer: 0, choice: correct ? 0 : null,
      explanation: rest.length ? `The clues ${correct ? "you didn't need" : "still to come"}: ${rest.join(" ")}` : undefined,
      next: res.state, auto: this.isBot(p.color), shownAt: this.env.now,
    });
  }

  private guess(input: string | number | null) {
    const p = this.p;
    if (p.kind !== "whoami" || !this.banks) return;
    const typed = typeof input === "string" ? input.trim() : null;
    const correct = typeof input === "number" ? input === p.set.answer : typed ? this.banks[p.color].whoami.check(p.set, typed) : false;
    const timedOut = input === null || (typed !== null && !typed);
    const earned = earnedPiece(p.clues);
    if (correct && earned !== "n") {
      // Bots take the best piece that doesn't stalemate; people choose.
      if (this.isBot(p.color)) { this.finishWhoAmI(p, true, typed, false, safePromotion(this.g, p.square, earned)); return; }
      this.go({ kind: "promote", color: p.color, set: p.set, square: p.square, clues: p.clues, earned });
      return;
    }
    this.finishWhoAmI(p, correct, typed, timedOut);
  }

  private promote(role: PromoRole) {
    const p = this.p;
    if (p.kind !== "promote") return;
    this.finishWhoAmI(p, true, null, false, role);
  }

  private continueOn() {
    const p = this.p;
    if (p.kind !== "result") return;
    // The clocks kept running while the result showed, so keep their current time.
    this.endTurn(withClocksFrom(p.next, this.g));
  }

  // ---- shootout

  private kick(choice: number | null) {
    const p = this.p;
    if (p.kind !== "shootout" || p.choice !== null || !this.banks) return;
    const scored = choice === p.q.answer && this.env.now - p.startedAt <= TIMER_MS.normal + 250;
    this.sfx(scored ? "cheer" : "groan");
    const kicks = [...p.kicks, { color: p.taker, scored }];
    this.go({ ...p, choice: choice ?? -1, kicks });
    this.fx.push({ kind: "later", delayMs: KICK_PAUSE_MS, action: { type: "kick-settle" } });
  }

  private kickSettle() {
    const p = this.p;
    if (p.kind !== "shootout" || p.choice === null || !this.banks) return;
    const kicks = p.kicks;
    const winner = shootoutWinner(kicks);
    if (winner) {
      const score = { white: kicks.filter((k) => k.color === "white" && k.scored).length, black: kicks.filter((k) => k.color === "black" && k.scored).length };
      this.setGame({ ...this.g, pendingDraw: null, outcome: { kind: "shootout", winner, score } });
      this.sfx("fulltime");
      this.talk(winner, "win");
      this.talk(opposite(winner), "loss");
      this.go({ kind: "over" });
    } else {
      const taker = opposite(p.taker);
      this.go({ kind: "shootout", kicks, q: this.banks[taker].bank.any("medium"), startedAt: this.env.now, choice: null, taker });
    }
  }

  // ---- resign / draw

  private resign(c: Color) {
    this.setGame(resignRule(this.g, c));
    this.sfx("fulltime");
    this.talk(opposite(c), "win");
    this.go({ kind: "over" });
  }

  private agreeDraw() {
    const g = endInDraw(this.g, "agreement");
    if (g.pendingDraw) { this.startShootout(g); return; }
    this.setGame(g);
    this.sfx("fulltime");
    this.go({ kind: "over" });
  }

  // ---- time

  private tick(dt: number) {
    const now = this.env.now;
    const p = this.p;
    // A person who runs out of time on a question, a clue or a penalty (bots act on their own).
    if (p.kind === "question" && !this.isBot(p.color) && p.limitMs - (now - p.startedAt) <= 0) this.answer(null);
    else if (p.kind === "whoami" && !this.isBot(p.color) && now - p.clueAt >= CLUE_MS) this.nextClue();
    else if (p.kind === "result" && now - p.shownAt >= (p.auto ? RESULT_MS : RESULT_MS_HUMAN)) this.continueOn();
    else if (p.kind === "shootout" && p.choice === null && !this.isBot(p.taker) && now - p.startedAt > TIMER_MS.normal) this.kick(null);

    // Chess clock: always runs for whoever has to act, through questions, results and engine
    // thinking too. It stops only for a "Who am I?", the Penalty Shootout and the pause menu.
    const g = this.g;
    if (!g.options.timed || g.outcome) return;
    const c = clockOwner(g, this.p);
    if (!c) return;
    const left = (g.players[c].clockMs ?? 0) - dt;
    if (left <= 0) {
      const out = timeout(setClock(g, c, 0), c);
      if (out.pendingDraw) { this.startShootout(out); return; }
      this.setGame(out);
      this.sfx("fulltime");
      this.go({ kind: "over" });
    } else this.setGame(setClock(g, c, left));
  }

  private unpause(d: number) {
    const p = this.p;
    if (p.kind === "question" || p.kind === "shootout") this.go({ ...p, startedAt: p.startedAt + d });
    else if (p.kind === "whoami") this.go({ ...p, clueAt: p.clueAt + d });
    else if (p.kind === "result") this.go({ ...p, shownAt: p.shownAt + d });
  }
}
