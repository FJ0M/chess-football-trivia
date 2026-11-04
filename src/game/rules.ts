// The game rules: chess (via chessops) plus the power-up and trivia layer on top.
// Every function takes a GameState and returns a new one; nothing is mutated, so
// the UI can keep snapshots and the bots get plain data.

import { Chess, normalizeMove } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { makeSquare, makeUci, opposite, parseSquare, parseUci, squareFile, squareRank } from "chessops/util";
import { chessgroundDests } from "chessops/compat";
import type { Setup } from "chessops/setup";
import type { NormalMove, Role, Square } from "chessops/types";
import { startFen } from "./chess960";
import { FORM_CAP, POWER_UP_BY_ID, startingCooldowns } from "./powerups";
import type {
  Color, Difficulty, DrawReason, Frozen, GameOptions, GameState, MoveRecord, PlayerState, PowerUpId, PromoRole, Snapshot, Trigger,
} from "./types";

export type Rng = () => number;

const ROLE_CHAR: Record<Role, string> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
const CHAR_ROLE: Record<string, Role> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const ROLE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

// ---------------------------------------------------------------- positions

export function setupOf(fen: string): Setup {
  return parseFen(fen).unwrap();
}

export function positionOf(fen: string): Chess {
  return Chess.fromSetup(setupOf(fen)).unwrap();
}

export function turnOf(state: GameState): Color {
  return state.fen.split(" ")[1] === "w" ? "white" : "black";
}

/** Returns the FEN for an edited setup, or null if the result isn't a legal position. */
function validFen(setup: Setup): string | null {
  const r = Chess.fromSetup(setup);
  return r.isOk ? makeFen(r.value.toSetup()) : null;
}

/** The same position with the other side to move (used by Free Kick and Extra Time). */
export function flipTurn(fen: string): string | null {
  const s = setupOf(fen);
  s.turn = opposite(s.turn);
  s.epSquare = undefined;
  return validFen(s);
}

function repetitionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function pieceAt(fen: string, square: string): { role: string; color: Color } | null {
  const sq = parseSquare(square);
  if (sq === undefined) return null;
  const p = setupOf(fen).board.get(sq);
  return p ? { role: ROLE_CHAR[p.role], color: p.color } : null;
}

// ---------------------------------------------------------------- new game

export interface PlayerInit {
  name: string;
  kind: "human" | "bot";
  botId?: string;
  club: string | null;
}

function newPlayer(p: PlayerInit, timed: boolean): PlayerState {
  return {
    ...p,
    form: 0,
    cooldowns: startingCooldowns(),
    kickoffCount: 0,
    rightStreak: 0,
    wrongStreak: 0,
    doubleNextPower: false,
    goldenBoot: false,
    sentOff: false,
    clockMs: timed ? 10 * 60 * 1000 : null,
  };
}

export function newGame(options: GameOptions, players: Record<Color, PlayerInit>, rng: Rng = Math.random): GameState {
  const fen = startFen(options.chess960 ? options.position : 518);
  return {
    options,
    fen,
    players: { white: newPlayer(players.white, options.timed), black: newPlayer(players.black, options.timed) },
    hotSpots: options.trivia ? pickHotSpots(fen, rng) : [],
    frozen: [],
    parkTheBus: null,
    captured: { white: [], black: [] },
    history: [],
    repetition: { [repetitionKey(fen)]: 1 },
    lastMove: null,
    step: "normal",
    extraTimePending: false,
    powerUsed: false,
    powerUsedId: null,
    counterAttack: null,
    snapshots: [],
    outcome: null,
    pendingDraw: null,
    log: [],
  };
}

// ---------------------------------------------------------------- hot spots

/**
 * Squares a piece other than a pawn can reach on move one, for either side.
 * Pawns are left out: they can reach every square on ranks 3 to 6 between them,
 * so counting them would leave nowhere to put a Hot Spot. The rule is there to
 * stop a knight (or a Chess960 bishop or queen) jumping straight onto one.
 */
export function firstMoveReach(fen: string): Set<string> {
  const out = new Set<string>();
  const add = (f: string) => {
    const pos = positionOf(f);
    for (const [from, tos] of pos.allDests()) {
      if (pos.board.get(from)?.role === "pawn") continue;
      for (const to of tos) out.add(makeSquare(to));
    }
  };
  add(fen);
  const flipped = flipTurn(fen);
  if (flipped) add(flipped);
  return out;
}

const HALVES: Record<Color, number[]> = { white: [2, 3], black: [4, 5] };

function emptySquaresInHalf(fen: string, half: Color, exclude: Set<string>): string[] {
  const board = setupOf(fen).board;
  const out: string[] = [];
  for (const rank of HALVES[half]) {
    for (let file = 0; file < 8; file++) {
      const sq = rank * 8 + file;
      const name = makeSquare(sq);
      if (!board.get(sq) && !exclude.has(name)) out.push(name);
    }
  }
  return out;
}

function pickFrom<T>(list: T[], rng: Rng): T | undefined {
  return list.length ? list[Math.floor(rng() * list.length)] : undefined;
}

export function pickHotSpots(fen: string, rng: Rng): string[] {
  const exclude = firstMoveReach(fen);
  const spots: string[] = [];
  for (const half of ["white", "black"] as Color[]) {
    for (let i = 0; i < 2; i++) {
      const s = pickFrom(emptySquaresInHalf(fen, half, new Set([...exclude, ...spots])), rng);
      if (s) spots.push(s);
    }
  }
  return spots;
}

/** Moves a used Hot Spot to a new random empty square in the same half of the board. */
function relocateHotSpot(state: GameState, used: string, rng: Rng): string[] {
  const rank = Number(used[1]) - 1;
  const half: Color = rank <= 3 ? "white" : "black";
  const others = state.hotSpots.filter((s) => s !== used);
  const next = pickFrom(emptySquaresInHalf(state.fen, half, new Set([...others, used])), rng);
  return next ? [...others, next] : others;
}

// ---------------------------------------------------------------- legal moves

function isCastle(fen: string, move: NormalMove): boolean {
  const s = setupOf(fen);
  const mover = s.board.get(move.from);
  const target = s.board.get(move.to);
  return mover?.role === "king" && target?.role === "rook" && target.color === mover.color;
}

function capturedSquare(fen: string, move: NormalMove): Square | null {
  const s = setupOf(fen);
  const mover = s.board.get(move.from);
  const target = s.board.get(move.to);
  if (target && mover && target.color !== mover.color) return move.to;
  if (mover?.role === "pawn" && !target && squareFile(move.from) !== squareFile(move.to)) {
    return move.to + (mover.color === "white" ? -8 : 8);
  }
  return null;
}

function givesCheck(fen: string, move: NormalMove): boolean {
  const pos = positionOf(fen);
  pos.play(move);
  return pos.isCheck();
}

/** Every move chessops allows in this position, as UCI (castling as king-takes-rook). */
function rawMoves(fen: string): NormalMove[] {
  const pos = positionOf(fen);
  const out: NormalMove[] = [];
  for (const [from, tos] of pos.allDests()) {
    const piece = pos.board.get(from)!;
    for (const to of tos) {
      const lastRank = piece.color === "white" ? 7 : 0;
      if (piece.role === "pawn" && squareRank(to) === lastRank) {
        for (const promotion of ["queen", "rook", "bishop", "knight"] as Role[]) out.push({ from, to, promotion });
      } else out.push({ from, to });
    }
  }
  return out;
}

/** The Counter-Attack push for a pawn: two squares forward, path clear, not onto the last rank, king safe. */
export function counterAttackMove(fen: string, square: string): NormalMove | null {
  const from = parseSquare(square);
  if (from === undefined) return null;
  const s = setupOf(fen);
  const pawn = s.board.get(from);
  if (!pawn || pawn.role !== "pawn" || pawn.color !== s.turn) return null;
  const dir = pawn.color === "white" ? 8 : -8;
  const mid = from + dir, to = from + 2 * dir;
  if (to < 0 || to > 63) return null;
  const lastRank = pawn.color === "white" ? 7 : 0;
  if (squareRank(to) === lastRank) return null;
  if (s.board.get(mid) || s.board.get(to)) return null;
  return playSpecialPush(fen, from, to) ? { from, to } : null;
}

/** Plays a pawn push by editing the board (chessops won't allow it). Null if it leaves the king in check. */
function playSpecialPush(fen: string, from: Square, to: Square): string | null {
  const s = setupOf(fen);
  const pawn = s.board.take(from)!;
  s.board.set(to, pawn);
  const mover = s.turn;
  s.turn = opposite(mover);
  s.epSquare = undefined;
  s.halfmoves = 0;
  if (mover === "black") s.fullmoves += 1;
  // The side that just moved must not be left in check.
  const r = Chess.fromSetup(s);
  if (!r.isOk) return null;
  return makeFen(r.value.toSetup());
}

export interface MoveFilter {
  moves: string[];
  /** True when the freeze / Park the Bus rules were lifted because nothing else was legal. */
  lifted: boolean;
}

/** Legal moves for the side to move, after freezes, Park the Bus and Free Kick / Extra Time rules. */
export function legalMoves(state: GameState): MoveFilter {
  if (state.outcome) return { moves: [], lifted: false };
  const fen = state.fen;
  const turn = turnOf(state);
  const raw = rawMoves(fen);
  const frozen = new Set(state.frozen.filter((f) => f.owner === turn).map((f) => f.square));
  const restricted = state.step !== "normal";
  const bus = state.parkTheBus === opposite(turn) ? state.parkTheBus : null;
  const busRanks = bus === "white" ? [0, 1] : bus === "black" ? [6, 7] : [];

  const ok = (m: NormalMove) => {
    if (frozen.has(makeSquare(m.from))) return false;
    if (isCastle(fen, m) && frozen.has(makeSquare(m.to))) return false;
    const cap = capturedSquare(fen, m);
    if (cap !== null && busRanks.includes(squareRank(cap))) return false;
    if (restricted && (cap !== null || givesCheck(fen, m))) return false;
    return true;
  };
  const filtered = raw.filter(ok).map(makeUci);
  if (state.counterAttack && !restricted) {
    const ca = counterAttackMove(fen, state.counterAttack);
    if (ca && !frozen.has(state.counterAttack)) filtered.push(makeUci(ca));
  }
  if (filtered.length || restricted) return { moves: filtered, lifted: false };
  // Safety rule: if the penalties leave no legal move, they're lifted.
  return { moves: raw.map(makeUci), lifted: raw.length > 0 };
}

/** Destination squares per piece for the board UI. Includes the g1/c1 castling targets in normal chess. */
export function destsFor(state: GameState): Map<string, string[]> {
  const { moves } = legalMoves(state);
  const allowed = new Set(moves);
  const out = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    const list = out.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    out.set(from, list);
  };
  for (const u of moves) add(u.slice(0, 2), u.slice(2, 4));
  if (!state.options.chess960) {
    // Let players tap the usual castling squares too.
    const pos = positionOf(state.fen);
    for (const [from, tos] of chessgroundDests(pos)) {
      for (const to of tos) {
        const norm = normalizeMove(pos, parseUci(from + to) as NormalMove) as NormalMove;
        if (allowed.has(makeUci(norm))) add(from, to);
      }
    }
  }
  return out;
}

/** Turns what the player tapped (or a bot sent) into the move in our list, or null. */
export function resolveMove(state: GameState, uci: string): string | null {
  const { moves } = legalMoves(state);
  if (moves.includes(uci)) return uci;
  const parsed = parseUci(uci) as NormalMove | undefined;
  if (!parsed || !("from" in parsed)) return null;
  const pos = positionOf(state.fen);
  const norm = makeUci(normalizeMove(pos, parsed));
  return moves.includes(norm) ? norm : null;
}

export function isPromotion(state: GameState, from: string, to: string): boolean {
  const p = pieceAt(state.fen, from);
  if (!p || p.role !== "p") return false;
  return to[1] === (p.color === "white" ? "8" : "1");
}

// ---------------------------------------------------------------- playing a move

export interface MoveResult {
  state: GameState;
  trigger: Trigger;
  san: string;
  captured: string | null;
  check: boolean;
  /** The square the moved piece ended on (the king's square when castling). */
  landed: string;
}

function snapshotOf(state: GameState): Snapshot {
  const { fen, hotSpots, frozen, parkTheBus, captured, history, repetition, lastMove } = state;
  return { fen, hotSpots, frozen, parkTheBus, captured, history, repetition, lastMove };
}

function withPlayer(state: GameState, color: Color, patch: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [color]: { ...state.players[color], ...patch } } };
}

const addForm = (form: number, n: number) => Math.max(0, Math.min(FORM_CAP, form + n));

/** Plays a move (already checked with resolveMove). The turn isn't finished until `finishTurn`. */
export function playMove(state: GameState, uci: string, rng: Rng = Math.random): MoveResult {
  const fen = state.fen;
  const mover = turnOf(state);
  const move = parseUci(uci) as NormalMove;
  const pos = positionOf(fen);
  const capSq = capturedSquare(fen, move);
  const capturedPiece = capSq !== null ? pos.board.get(capSq) : undefined;
  const castle = isCastle(fen, move);

  let nextFen: string;
  let san: string;
  if (pos.isLegal(move)) {
    san = makeSan(pos, move);
    pos.play(move);
    nextFen = makeFen(pos.toSetup());
  } else {
    // Counter-Attack push.
    const pushed = playSpecialPush(fen, move.from, move.to);
    if (!pushed) throw new Error(`Illegal move ${uci}`);
    nextFen = pushed;
    san = makeSquare(move.to) + " (Counter-Attack)";
  }
  const after = positionOf(nextFen);
  const check = after.isCheck();

  // Where the moved piece ended up (castling: the king's castled square).
  let landedSq = move.to;
  if (castle) {
    const kingNow = after.board.kingOf(mover);
    if (kingNow !== undefined) landedSq = kingNow;
  }
  const landed = makeSquare(landedSq);

  const record: MoveRecord = { color: mover, uci, san, step: state.step };
  const key = repetitionKey(nextFen);
  let next: GameState = {
    ...state,
    fen: nextFen,
    history: [...state.history, record],
    repetition: { ...state.repetition, [key]: (state.repetition[key] ?? 0) + 1 },
    lastMove: [makeSquare(move.from), landed],
    counterAttack: null,
    snapshots: state.step === "normal" ? [...state.snapshots, { color: mover, snap: snapshotOf(state) }] : state.snapshots,
  };

  if (capturedPiece) {
    const victim = capturedPiece.color;
    next = { ...next, captured: { ...next.captured, [victim]: [...next.captured[victim], ROLE_CHAR[capturedPiece.role]] } };
  }

  // Freezes on the mover's pieces have now served their turn; drop any whose piece has gone.
  const board = after.board;
  next.frozen = next.frozen.filter((f) => {
    if (f.owner === mover) return false;
    const p = board.get(parseSquare(f.square)!);
    return !!p && p.color === f.owner;
  });
  // Park the Bus protected the other side during this (the mover's) turn.
  if (next.parkTheBus === opposite(mover)) next.parkTheBus = null;

  const me = next.players[mover];
  const patch: Partial<PlayerState> = {};
  let log = next.log;
  if (capturedPiece && me.goldenBoot) {
    patch.form = addForm(me.form, 3);
    patch.goldenBoot = false;
    log = [...log, `Golden Boot: ${me.name} +3 Form for the capture`];
  }
  if (state.step === "normal") {
    const used = state.powerUsedId;
    const cd = { ...me.cooldowns };
    for (const id of Object.keys(cd) as PowerUpId[]) if (id !== used && cd[id] > 0) cd[id] -= 1;
    patch.cooldowns = cd;
    patch.kickoffCount = me.kickoffCount + 1;
  }
  next = withPlayer({ ...next, log }, mover, patch);

  // What does this move trigger?
  let trigger: Trigger = { kind: "none" };
  const ended = after.isCheckmate() || after.isStalemate();
  if (state.options.trivia) {
    const onSpot = next.hotSpots.includes(landed);
    if (move.promotion) {
      trigger = { kind: "promotion", role: ROLE_CHAR[move.promotion] as PromoRole, square: makeSquare(move.to), bonus: onSpot };
    } else if (state.step === "normal" && !ended) {
      if (onSpot) trigger = { kind: "hot-spot", square: landed };
      else if (capturedPiece) trigger = { kind: "capture" };
      else if (next.players[mover].kickoffCount >= 3) trigger = { kind: "kickoff" };
    }
    if (onSpot && (trigger.kind === "hot-spot" || trigger.kind === "promotion")) {
      next = { ...next, hotSpots: relocateHotSpot(next, landed, rng) };
    }
    if (trigger.kind !== "none" && trigger.kind !== "promotion") next = withPlayer(next, mover, { kickoffCount: 0 });
  }

  return { state: next, trigger, san, captured: capturedPiece ? ROLE_CHAR[capturedPiece.role] : null, check, landed };
}

/** A wrong promotion answer: the new piece becomes a knight. */
export function demotePromotion(state: GameState, square: string): GameState {
  const s = setupOf(state.fen);
  const sq = parseSquare(square)!;
  const p = s.board.get(sq);
  if (!p) return state;
  s.board.set(sq, { role: "knight", color: p.color, promoted: true });
  const fen = validFen(s);
  return fen ? { ...state, fen } : state;
}

export interface TurnInfo {
  state: GameState;
  /** Messages for the commentary line, e.g. "Free Kick to Ryan". */
  notes: string[];
}

/**
 * Called once a move (and any question it triggered) is done: checks for the end
 * of the game, then works out who moves next (Extra Time, Free Kick).
 */
export function finishTurn(state: GameState): TurnInfo {
  const notes: string[] = [];
  const pos = positionOf(state.fen);
  const mover = opposite(pos.turn);
  let next = state;

  // Game over?
  if (pos.isCheckmate()) return { state: { ...state, outcome: { kind: "checkmate", winner: mover } }, notes };
  let draw: DrawReason | null = null;
  if (pos.isStalemate()) draw = "stalemate";
  else if (pos.isInsufficientMaterial()) draw = "insufficient";
  else if (pos.halfmoves >= 100) draw = "fifty-moves";
  else if ((state.repetition[repetitionKey(state.fen)] ?? 0) >= 3) draw = "repetition";
  if (draw) return { state: endInDraw(state, draw), notes };

  // Extra Time: the same player moves again.
  if (state.extraTimePending) {
    next = { ...next, extraTimePending: false };
    if (pos.isCheck()) {
      notes.push("Extra Time is cancelled because your first move gave check");
    } else {
      const flipped = flipTurn(state.fen);
      if (flipped) {
        const candidate: GameState = { ...next, fen: flipped, step: "extra-time" };
        if (legalMoves(candidate).moves.length) {
          notes.push(`Extra Time: ${state.players[mover].name} moves again (no captures or checks)`);
          return { state: candidate, notes };
        }
      }
      notes.push("Extra Time is cancelled: no quiet second move available");
    }
  }

  next = { ...next, step: "normal", powerUsed: false, powerUsedId: null, counterAttack: null };
  const toMove = pos.turn;
  if (next.players[toMove].sentOff) {
    next = withPlayer(next, toMove, { sentOff: false });
    if (pos.isCheck()) {
      notes.push(`${next.players[toMove].name}'s sending off is cancelled: they're in check`);
    } else {
      const flipped = flipTurn(next.fen);
      const candidate: GameState | null = flipped ? { ...next, fen: flipped, step: "free-kick", powerUsed: true } : null;
      if (candidate && legalMoves(candidate).moves.length) {
        notes.push(`${next.players[toMove].name} is sent off for a turn. Free Kick to ${next.players[mover].name}: no captures or checks`);
        return { state: candidate, notes };
      }
      notes.push("No quiet Free Kick available, so play goes on");
    }
  }
  return { state: next, notes };
}

export function endInDraw(state: GameState, reason: DrawReason): GameState {
  if (state.options.trivia) return { ...state, pendingDraw: reason };
  return { ...state, outcome: { kind: "draw", reason } };
}

export function resign(state: GameState, loser: Color): GameState {
  return { ...state, outcome: { kind: "resign", winner: opposite(loser) } };
}

// ---------------------------------------------------------------- power-ups

export function powerCost(state: GameState, color: Color, id: PowerUpId): number {
  const base = POWER_UP_BY_ID[id].cost;
  return state.players[color].doubleNextPower ? base * 2 : base;
}

/** Why a power-up can't be used right now, or null if it can (targets aside). */
export function powerBlocked(state: GameState, id: PowerUpId): string | null {
  const def = POWER_UP_BY_ID[id];
  const color = turnOf(state);
  const me = state.players[color];
  if (state.outcome) return "The game is over";
  if (state.step !== "normal") return "Not during a Free Kick or Extra Time";
  if (state.powerUsed) return "One power-up per turn";
  if (def.timedOnly && !state.options.timed) return "Timed games only";
  if (me.cooldowns[id] > 0) return `Ready in ${me.cooldowns[id]} ${me.cooldowns[id] === 1 ? "move" : "moves"}`;
  const cost = powerCost(state, color, id);
  if (me.form < cost) return `Needs ${cost} Form`;
  const pos = positionOf(state.fen);
  if (id === "park-the-bus" && pos.isCheck()) return "Not while in check";
  if (id === "var-review" && varTarget(state) === null) return "Nothing to review yet";
  if (id === "substitution" && !state.captured[color].includes("p")) return "No captured pawns to bring back";
  return null;
}

function varTarget(state: GameState): number | null {
  const me = turnOf(state);
  const last = state.history[state.history.length - 1];
  if (!last || last.color === me) return null;
  for (let i = state.snapshots.length - 1; i >= 0; i--) if (state.snapshots[i].color === me) return i;
  return null;
}

export interface PowerResult {
  state: GameState;
  error?: string;
  note?: string;
}

/** Squares a power-up can target, for highlighting. */
export function powerTargets(state: GameState, id: PowerUpId, first?: string): string[] {
  const color = turnOf(state);
  const s = setupOf(state.fen);
  const out: string[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const name = makeSquare(sq);
    const targets = first ? [first, name] : [name];
    if (first && name === first) continue;
    const p = s.board.get(sq);
    const def = POWER_UP_BY_ID[id];
    if (def.target === "two-own-pieces" && !first) {
      if (p && p.color === color && p.role !== "king") out.push(name);
      continue;
    }
    if (!p && def.target !== "own-second-rank" && def.target !== "two-own-pieces") continue;
    if (!usePowerUp(state, id, targets).error) out.push(name);
  }
  return out;
}

export function usePowerUp(state: GameState, id: PowerUpId, targets: string[] = []): PowerResult {
  const blocked = powerBlocked(state, id);
  if (blocked) return { state, error: blocked };
  const def = POWER_UP_BY_ID[id];
  const color = turnOf(state);
  const enemy = opposite(color);
  const me = state.players[color];
  const pos = positionOf(state.fen);
  const s = setupOf(state.fen);
  const sq = targets[0] !== undefined ? parseSquare(targets[0]) : undefined;
  const piece = sq !== undefined ? s.board.get(sq) : undefined;
  const fail = (error: string): PowerResult => ({ state, error });

  let next: GameState = state;
  let note = `${me.name} used ${def.name}`;

  switch (id) {
    case "fergie-time":
      next = withPlayer(next, color, { clockMs: (me.clockMs ?? 0) + 30_000 });
      break;
    case "tactical-foul": {
      if (!piece || piece.color !== enemy) return fail("Pick an enemy piece");
      if (piece.role === "king") return fail("Not the king");
      if (pos.ctx().checkers.has(sq!)) return fail("Not a piece that is giving check");
      const f: Frozen = { square: targets[0], owner: enemy, reason: "foul" };
      next = { ...next, frozen: [...next.frozen, f] };
      note = `${me.name} committed a Tactical Foul: the ${ROLE_NAME[ROLE_CHAR[piece.role]]} on ${targets[0]} is frozen`;
      break;
    }
    case "park-the-bus":
      next = { ...next, parkTheBus: color };
      note = `${me.name} parked the bus: their back two ranks can't be captured next turn`;
      break;
    case "var-review": {
      const i = varTarget(state)!;
      const snap = state.snapshots[i].snap;
      next = { ...next, ...snap, snapshots: state.snapshots.slice(0, i) };
      note = `VAR Review: ${me.name}'s last move and the reply are overturned`;
      break;
    }
    case "counter-attack": {
      if (!piece || piece.color !== color || piece.role !== "pawn") return fail("Pick one of your pawns");
      if (!counterAttackMove(state.fen, targets[0])) return fail("That pawn can't go two squares");
      next = { ...next, counterAttack: targets[0] };
      note = `${me.name} launched a Counter-Attack: the ${targets[0]} pawn can move two squares`;
      break;
    }
    case "substitution": {
      if (sq === undefined) return fail("Pick an empty square on your 2nd rank");
      const rank = color === "white" ? 1 : 6;
      if (squareRank(sq) !== rank || piece) return fail("Pick an empty square on your 2nd rank");
      s.board.set(sq, { role: "pawn", color });
      const fen = validFen(s);
      if (!fen) return fail("That would put the king in check");
      const caps = [...state.captured[color]];
      caps.splice(caps.indexOf("p"), 1);
      next = { ...next, fen, captured: { ...next.captured, [color]: caps } };
      note = `Substitution: ${me.name} brings a pawn back on ${targets[0]}`;
      break;
    }
    case "golden-boot":
      next = withPlayer(next, color, { goldenBoot: true });
      note = `${me.name} laced up the Golden Boot: next capture is worth +3 Form`;
      break;
    case "formation-change": {
      const sq2 = targets[1] !== undefined ? parseSquare(targets[1]) : undefined;
      const p2 = sq2 !== undefined ? s.board.get(sq2) : undefined;
      if (!piece || !p2 || sq === sq2 || piece.color !== color || p2.color !== color) return fail("Pick two of your pieces");
      if (piece.role === "king" || p2.role === "king") return fail("Not the king");
      if (piece.role === p2.role) return fail("Pick two different pieces");
      const backRanks = [0, 7];
      if ((piece.role === "pawn" && backRanks.includes(squareRank(sq2!))) || (p2.role === "pawn" && backRanks.includes(squareRank(sq!)))) {
        return fail("A pawn can't go on the first or last rank");
      }
      s.board.set(sq!, p2);
      s.board.set(sq2!, piece);
      s.castlingRights = s.castlingRights.without(sq!).without(sq2!);
      s.epSquare = undefined;
      const r = Chess.fromSetup(s);
      if (!r.isOk) return fail("Can't give check");
      if (r.value.isCheck()) return fail("That would leave you in check");
      next = { ...next, fen: makeFen(r.value.toSetup()) };
      note = `Formation Change: ${me.name} swaps ${targets[0]} and ${targets[1]}`;
      break;
    }
    case "super-sub": {
      if (!piece || piece.color !== color || piece.role !== "pawn") return fail("Pick one of your pawns");
      s.board.set(sq!, { role: "knight", color });
      const fen = validFen(s);
      if (!fen) return fail("Can't give check");
      next = { ...next, fen };
      note = `Super-Sub: ${me.name}'s pawn on ${targets[0]} becomes a knight`;
      break;
    }
    case "red-card": {
      if (!piece || piece.color !== enemy || piece.role !== "pawn") return fail("Pick an enemy pawn");
      const relRank = enemy === "white" ? squareRank(sq!) + 1 : 8 - squareRank(sq!);
      if (relRank >= 6) return fail("Not a pawn on its 6th or 7th rank");
      s.board.take(sq!);
      s.epSquare = undefined;
      const fen = validFen(s);
      if (!fen) return fail("Not allowed here");
      next = { ...next, fen, captured: { ...next.captured, [enemy]: [...next.captured[enemy], "p"] } };
      note = `Red Card! ${me.name} sends off the pawn on ${targets[0]}`;
      break;
    }
    case "extra-time":
      next = { ...next, extraTimePending: true };
      note = `${me.name} is playing Extra Time: two moves this turn`;
      break;
    case "assistants-flag":
    case "scout-report":
    case "managers-tip":
      break;
  }

  const cost = powerCost(state, color, id);
  next = withPlayer(next, color, {
    form: next.players[color].form - cost,
    cooldowns: { ...next.players[color].cooldowns, [id]: def.cooldown },
    doubleNextPower: false,
  });
  next = { ...next, powerUsed: true, powerUsedId: id, log: [...next.log, note] };
  return { state: next, note };
}

/** Squares the given side attacks (Assistant's Flag). */
export function attackedSquares(fen: string, by: Color): string[] {
  const pos = positionOf(fen);
  const out: string[] = [];
  const occupied = pos.board.occupied;
  for (let sq = 0; sq < 64; sq++) {
    if (pos.kingAttackers(sq, by, occupied).nonEmpty()) out.push(makeSquare(sq));
  }
  return out;
}

// ---------------------------------------------------------------- answers

export interface AnswerCtx {
  color: Color;
  difficulty: Difficulty;
  worldie: boolean;
  bonus: boolean;
  correct: boolean;
  ms: number;
  /** The square the answerer's piece just landed on (for a booking). */
  landed: string | null;
}

export const REWARD: Record<Difficulty | "worldie", number> = { easy: 1, medium: 2, hard: 4, worldie: 6 };

export interface AnswerOutcome {
  state: GameState;
  lines: string[];
  formGained: number;
}

/** Applies Form, streaks and penalties for a normal (non-promotion) question. */
export function applyAnswer(state: GameState, a: AnswerCtx): AnswerOutcome {
  const me = state.players[a.color];
  const enemy = opposite(a.color);
  const lines: string[] = [];
  let next = state;
  let gained = 0;
  if (a.correct) {
    const base = REWARD[a.worldie ? "worldie" : a.difficulty] * (a.bonus ? 2 : 1);
    gained = base;
    lines.push(`+${base} Form${a.bonus ? " (Club Bonus Round, doubled)" : ""}`);
    if (a.ms < 5000) { gained += 1; lines.push("+1 quick answer"); }
    let streak = me.rightStreak + 1;
    if (streak >= 3) { gained += 3; streak = 0; lines.push("Hat-trick! +3 Form"); }
    next = withPlayer(next, a.color, { form: addForm(me.form, gained), rightStreak: streak, wrongStreak: 0 });
  } else {
    let wrong = me.wrongStreak + 1;
    let doubleNext = me.doubleNextPower;
    if (a.worldie) {
      next = withPlayer(next, a.color, { sentOff: true });
      lines.push("Sent off! You lose your next turn and the opponent gets a Free Kick");
    } else if (a.difficulty === "hard") {
      if (a.landed) next = { ...next, frozen: [...next.frozen, { square: a.landed, owner: a.color, reason: "booked" }] };
      lines.push("Booked: the piece you just moved is frozen for your next turn");
    } else if (a.difficulty === "medium") {
      next = withPlayer(next, enemy, { form: addForm(next.players[enemy].form, 2) });
      lines.push(`Scored on the break: ${next.players[enemy].name} +2 Form`);
    } else {
      lines.push("No harm done, you just miss out");
    }
    if (wrong === 2) lines.push("Two wrong in a row: that's a yellow card");
    if (wrong >= 4) { doubleNext = true; wrong = 0; lines.push("Four wrong in a row: red card! Your next power-up costs double"); }
    next = withPlayer(next, a.color, { wrongStreak: wrong, rightStreak: 0, doubleNextPower: doubleNext });
  }
  return { state: next, lines, formGained: gained };
}

/** Which question a promotion needs. */
export const PROMOTION_QUESTION: Record<PromoRole, { difficulty: Difficulty; worldie: boolean; label: string }> = {
  n: { difficulty: "easy", worldie: false, label: "Sunday League" },
  b: { difficulty: "medium", worldie: false, label: "Championship" },
  r: { difficulty: "hard", worldie: false, label: "Premier League" },
  q: { difficulty: "hard", worldie: true, label: "Worldie" },
};

export { CHAR_ROLE, ROLE_CHAR };
