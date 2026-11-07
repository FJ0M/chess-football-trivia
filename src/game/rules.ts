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
import {
  DEFAULT_MINUTES, DOUBLE_COST_MIN, FORM_CAP, GOLDEN_BOOT_FORM, GOLDEN_BOOT_MOVES, POWER_UP_BY_ID, fergieMs, fmtSeconds, startingCooldowns,
} from "./powerups";
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

function newPlayer(p: PlayerInit, timed: boolean, minutes: number): PlayerState {
  return {
    ...p,
    form: 0,
    cooldowns: startingCooldowns(),
    kickoffCount: 0,
    rightStreak: 0,
    wrongStreak: 0,
    doubleNextPower: false,
    goldenBootMoves: 0,
    hotSpotRest: 0,
    sentOff: false,
    clockMs: timed ? minutes * 60 * 1000 : null,
  };
}

export function newGame(options: GameOptions, players: Record<Color, PlayerInit>, rng: Rng = Math.random): GameState {
  const fen = startFen(options.chess960 ? options.position : 518);
  return {
    options,
    fen,
    players: { white: newPlayer(players.white, options.timed, options.minutes ?? DEFAULT_MINUTES), black: newPlayer(players.black, options.timed, options.minutes ?? DEFAULT_MINUTES) },
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

/** Hot Spots per half of the board (2 in all). They stay put until someone lands on one. */
export const HOT_SPOTS_PER_HALF = 1;
/** After you claim a Hot Spot, it's this many of your moves before Hot Spots count for you again. */
export const HOT_SPOT_REST = 4;

export function pickHotSpots(fen: string, rng: Rng): string[] {
  const exclude = firstMoveReach(fen);
  const spots: string[] = [];
  for (const half of ["white", "black"] as Color[]) {
    for (let i = 0; i < HOT_SPOTS_PER_HALF; i++) {
      const s = pickFrom(emptySquaresInHalf(fen, half, new Set([...exclude, ...spots])), rng);
      if (s) spots.push(s);
    }
  }
  return spots;
}

/** Every square any piece of either side (pawns included) could move to right now. */
function reachNow(fen: string): Set<string> {
  const out = new Set<string>();
  for (const f of [fen, flipTurn(fen)]) {
    if (!f) continue;
    for (const [, tos] of positionOf(f).allDests()) for (const to of tos) out.add(makeSquare(to));
  }
  return out;
}

/**
 * Moves a used Hot Spot to a new random empty square in the same half of the board,
 * preferring one no piece can reach on the next move, so a Hot Spot takes a little
 * planning to claim instead of being in reach almost every turn.
 */
function relocateHotSpot(state: GameState, used: string, rng: Rng): string[] {
  const rank = Number(used[1]) - 1;
  const half: Color = rank <= 3 ? "white" : "black";
  const others = state.hotSpots.filter((s) => s !== used);
  const taken = new Set([...others, used]);
  const empty = emptySquaresInHalf(state.fen, half, taken);
  const reach = reachNow(state.fen);
  const quiet = empty.filter((s) => !reach.has(s));
  const next = pickFrom(quiet.length ? quiet : empty, rng);
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

/** Why a pawn can't Counter-Attack, or null if it can. */
export function counterAttackBlocked(fen: string, square: string): string | null {
  const from = parseSquare(square);
  if (from === undefined) return "Pick one of your pawns";
  const s = setupOf(fen);
  const pawn = s.board.get(from);
  if (!pawn || pawn.role !== "pawn" || pawn.color !== s.turn) return "Pick one of your pawns";
  const dir = pawn.color === "white" ? 8 : -8;
  const mid = from + dir, to = from + 2 * dir;
  if (to < 0 || to > 63) return "That pawn can't go two squares";
  // Relative rank, 1 to 8: the dash can't reach the 7th (one step from promoting) or the 8th.
  const rel = pawn.color === "white" ? squareRank(to) + 1 : 8 - squareRank(to);
  if (rel >= 7) return "Can't dash onto the 7th rank";
  if (s.board.get(mid) || s.board.get(to)) return "The path must be clear";
  // En passant can't be offered off the 2nd rank, so the dash can't skip past a square an enemy pawn covers.
  const enemyPawnHits = (sq: Square) => [-1, 1].some((df) => {
    const f = squareFile(sq) + df;
    if (f < 0 || f > 7) return false;
    const p = s.board.get(sq + dir + df);
    return !!p && p.role === "pawn" && p.color !== pawn.color;
  });
  if (enemyPawnHits(mid)) return "Can't skip past an enemy pawn";
  if (!playSpecialPush(fen, from, to)) return "That would leave your king in check";
  return null;
}

/** The Counter-Attack push for a pawn: two squares forward, path clear, not onto the 7th or 8th rank, king safe. */
export function counterAttackMove(fen: string, square: string): NormalMove | null {
  if (counterAttackBlocked(fen, square)) return null;
  const from = parseSquare(square)!;
  const dir = setupOf(fen).turn === "white" ? 8 : -8;
  return { from, to: from + 2 * dir };
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
  // Extra Time: the first move can't capture either (it may give check, which cancels the second move).
  const noCapture = restricted || state.extraTimePending;
  const bus = state.parkTheBus === opposite(turn) ? state.parkTheBus : null;
  const busRanks = bus === "white" ? [0, 1] : bus === "black" ? [6, 7] : [];

  const ok = (m: NormalMove) => {
    if (frozen.has(makeSquare(m.from))) return false;
    if (isCastle(fen, m) && frozen.has(makeSquare(m.to))) return false;
    const cap = capturedSquare(fen, m);
    if (cap !== null && busRanks.includes(squareRank(cap))) return false;
    if (noCapture && cap !== null) return false;
    if (restricted && givesCheck(fen, m)) return false;
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
  const { fen, hotSpots, frozen, parkTheBus, captured, history, repetition, lastMove, players } = state;
  return { fen, hotSpots, frozen, parkTheBus, captured, history, repetition, lastMove, players };
}

function withPlayer(state: GameState, color: Color, patch: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [color]: { ...state.players[color], ...patch } } };
}

const addForm = (form: number, n: number) => Math.max(0, Math.min(FORM_CAP, form + n));

/** A question on every 4th quiet move (no capture, no Hot Spot). */
export const KICKOFF_EVERY = 4;

const PIECE_POINTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material on the board for each side, in pawns (P1 N3 B3 R5 Q9). */
export function material(fen: string): Record<Color, number> {
  const out: Record<Color, number> = { white: 0, black: 0 };
  for (const ch of fen.split(" ")[0]) {
    const v = PIECE_POINTS[ch.toLowerCase()];
    if (v !== undefined) out[ch === ch.toUpperCase() ? "white" : "black"] += v;
  }
  return out;
}

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
  if (capturedPiece && me.goldenBootMoves > 0) {
    patch.form = addForm(me.form, GOLDEN_BOOT_FORM);
    log = [...log, `Golden Boot: ${me.name} +${GOLDEN_BOOT_FORM} Form for the capture`];
  }
  if (state.step === "normal") {
    if (me.goldenBootMoves > 0) patch.goldenBootMoves = me.goldenBootMoves - 1;
    if (me.hotSpotRest > 0) patch.hotSpotRest = me.hotSpotRest - 1;
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
    // A Hot Spot only counts if you haven't claimed one in your last few moves (checked before this move's count-down).
    const onSpot = next.hotSpots.includes(landed) && me.hotSpotRest === 0;
    if (move.promotion) {
      trigger = { kind: "promotion", role: ROLE_CHAR[move.promotion] as PromoRole, square: makeSquare(move.to), bonus: onSpot };
    } else if (state.step === "normal" && !ended) {
      if (onSpot) trigger = { kind: "hot-spot", square: landed };
      else if (capturedPiece) trigger = { kind: "capture" };
      else if (next.players[mover].kickoffCount >= KICKOFF_EVERY) trigger = { kind: "kickoff" };
    }
    // Hot Spots stay put until used; a used one jumps to a new square in the same half.
    if (onSpot && (trigger.kind === "hot-spot" || trigger.kind === "promotion")) {
      next = { ...next, hotSpots: relocateHotSpot(next, landed, rng) };
      next = withPlayer(next, mover, { hotSpotRest: HOT_SPOT_REST });
    }
    // Any question (a "Who am I?" too) restarts the Kick-off count.
    if (trigger.kind !== "none") next = withPlayer(next, mover, { kickoffCount: 0 });
  }

  return { state: next, trigger, san, captured: capturedPiece ? ROLE_CHAR[capturedPiece.role] : null, check, landed };
}

/**
 * Promotion is a "Who am I?": five clues, one typed guess. The earlier the right guess,
 * the better the piece. Index = clues shown minus one: queen on clue 1 or 2, rook 3, bishop 4, knight 5.
 */
export const WHO_AM_I_PIECES: PromoRole[] = ["q", "q", "r", "b", "n"];
export const WHO_AM_I_PENALTY = 2;

/** Sets the promoted piece once the "Who am I?" is over. Wrong: a knight, and the opponent gets +2 Form. */
export function resolvePromotion(state: GameState, square: string, cluesShown: number, correct: boolean): { state: GameState; role: PromoRole; line: string } {
  const role: PromoRole = correct ? WHO_AM_I_PIECES[Math.min(4, Math.max(0, cluesShown - 1))] : "n";
  const s = setupOf(state.fen);
  const sq = parseSquare(square)!;
  const p = s.board.get(sq);
  let next = state;
  if (p) {
    s.board.set(sq, { role: CHAR_ROLE[role], color: p.color, promoted: true });
    const fen = validFen(s);
    if (fen) next = { ...next, fen };
  }
  const mover = p?.color ?? opposite(turnOf(state));
  let line = `Promoted to a ${ROLE_NAME[role]}`;
  if (!correct) {
    const enemy = opposite(mover);
    next = withPlayer(next, enemy, { form: addForm(next.players[enemy].form, WHO_AM_I_PENALTY) });
    line = `Wrong, so it's a knight, and ${next.players[enemy].name} gets +${WHO_AM_I_PENALTY} Form`;
  }
  return { state: next, role, line };
}

/** For bots: the piece they aim for maps to an old-style difficulty for their answer odds. */
export const PROMOTION_AIM: Record<PromoRole, { clues: number; difficulty: Difficulty; puskas: boolean }> = {
  q: { clues: 2, difficulty: "hard", puskas: true },
  r: { clues: 3, difficulty: "hard", puskas: false },
  b: { clues: 4, difficulty: "medium", puskas: false },
  n: { clues: 5, difficulty: "easy", puskas: false },
};

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

/** Does the "next power-up costs double" penalty apply to this power-up? Cheap ones (under 3 Form) neither pay it nor clear it. */
export function doubles(id: PowerUpId): boolean {
  return POWER_UP_BY_ID[id].cost >= DOUBLE_COST_MIN;
}

export function powerCost(state: GameState, color: Color, id: PowerUpId): number {
  const base = POWER_UP_BY_ID[id].cost;
  return state.players[color].doubleNextPower && doubles(id) ? base * 2 : base;
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
  if ((id === "park-the-bus" || id === "scout-report" || id === "formation-change") && pos.isCheck()) return "Not while in check";
  if (id === "masterclass" && legalMoves(state).moves.length === 0) return "No move to play";
  if (id === "var-review") {
    const i = varTarget(state);
    if (i === null) return "Nothing to review yet";
    // The cost comes out of the Form you had before the move being reviewed.
    if (state.snapshots[i].snap.players[color].form < cost) return `Needs ${cost} Form from before that move`;
  }
  if (id === "extra-time" && !legalMoves({ ...state, extraTimePending: true }).moves.some((m) => capturedSquare(state.fen, parseUci(m) as NormalMove) === null)) {
    return "No quiet move to start with";
  }
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
      next = withPlayer(next, color, { clockMs: (me.clockMs ?? 0) + fergieMs(state.options.minutes) });
      note = `${me.name} used Fergie Time: +${fmtSeconds(fergieMs(state.options.minutes))}`;
      break;
    case "tactical-foul": {
      if (!piece || piece.color !== enemy) return fail("Pick an enemy piece");
      if (piece.role === "king") return fail("Not the king");
      if (piece.role === "queen") return fail("Not the queen");
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
      const { players: before, ...snap } = state.snapshots[i].snap;
      // Everything goes back to before the move, Form and cooldowns included. Only the clocks keep running.
      const restore = (c: Color): PlayerState => ({ ...before[c], clockMs: state.players[c].clockMs });
      next = { ...next, ...snap, players: { white: restore("white"), black: restore("black") }, snapshots: state.snapshots.slice(0, i) };
      note = `VAR Review: ${me.name}'s last move and the reply are overturned`;
      break;
    }
    case "counter-attack": {
      if (!piece || piece.color !== color || piece.role !== "pawn") return fail("Pick one of your pawns");
      const why = counterAttackBlocked(state.fen, targets[0]);
      if (why) return fail(why);
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
      next = withPlayer(next, color, { goldenBootMoves: GOLDEN_BOOT_MOVES });
      note = `${me.name} laced up the Golden Boot: every capture in the next ${GOLDEN_BOOT_MOVES} moves is worth +${GOLDEN_BOOT_FORM} Form`;
      break;
    case "formation-change": {
      const sq2 = targets[1] !== undefined ? parseSquare(targets[1]) : undefined;
      const p2 = sq2 !== undefined ? s.board.get(sq2) : undefined;
      if (!piece || !p2 || sq === sq2 || piece.color !== color || p2.color !== color) return fail("Pick two of your pieces");
      if (piece.role === "king" || p2.role === "king") return fail("Not the king");
      if (piece.role === p2.role) return fail("Pick two different pieces");
      if (state.frozen.some((f) => f.owner === color && (f.square === targets[0] || f.square === targets[1]))) return fail("Not a frozen piece");
      // A pawn can land on its 2nd to 5th rank only: never the back rank, and never close enough to promote.
      const pawnRankOk = (to: Square) => {
        const rel = color === "white" ? squareRank(to) + 1 : 8 - squareRank(to);
        return rel >= 2 && rel <= 5;
      };
      if ((piece.role === "pawn" && !pawnRankOk(sq2!)) || (p2.role === "pawn" && !pawnRankOk(sq!))) {
        return fail("A pawn can only go on its 2nd to 5th rank");
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
    case "masterclass":
      break;
  }

  const cost = powerCost(state, color, id);
  next = withPlayer(next, color, {
    form: Math.max(0, next.players[color].form - cost),
    cooldowns: { ...next.players[color].cooldowns, [id]: def.cooldown },
    // Paying a doubled price clears the red card; the cheap power-ups don't count.
    doubleNextPower: doubles(id) ? false : next.players[color].doubleNextPower,
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
  puskas: boolean;
  bonus: boolean;
  correct: boolean;
  ms: number;
  /** The square the answerer's piece just landed on (for a booking). */
  landed: string | null;
}

/** Form for a right answer (doubled in a Club Bonus Round). */
export const REWARD: Record<Difficulty | "puskas", number> = { easy: 1, medium: 2, hard: 3, puskas: 5 };
/** Answer a Screamer or Puskás inside this time for +1. */
export const QUICK_MS = 5000;
export const HAT_TRICK_BONUS = 2;

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
    const base = REWARD[a.puskas ? "puskas" : a.difficulty] * (a.bonus ? 2 : 1);
    gained = base;
    lines.push(`+${base} Form${a.bonus ? " (Club Bonus Round, doubled)" : ""}`);
    if (a.ms < QUICK_MS && (a.puskas || a.difficulty === "hard")) { gained += 1; lines.push("+1 quick answer"); }
    let streak = me.rightStreak + 1;
    if (streak >= 3) { gained += HAT_TRICK_BONUS; streak = 0; lines.push(`Hat-trick! +${HAT_TRICK_BONUS} Form`); }
    // Catch-up: whoever is behind on material gets a little extra.
    const mat = material(state.fen);
    if (mat[a.color] < mat[enemy]) { gained += 1; lines.push("+1 catch-up (you're behind on material)"); }
    next = withPlayer(next, a.color, { form: addForm(me.form, gained), rightStreak: streak, wrongStreak: 0 });
  } else {
    let wrong = me.wrongStreak + 1;
    let doubleNext = me.doubleNextPower;
    if (a.puskas) {
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

export { CHAR_ROLE, ROLE_CHAR };

/** Spends Form on a trivia hint. */
export function spendForm(state: GameState, color: Color, n: number): GameState {
  return withPlayer(state, color, { form: Math.max(0, state.players[color].form - n) });
}

export function timeout(state: GameState, loser: Color): GameState {
  return { ...state, outcome: { kind: "timeout", winner: opposite(loser) } };
}

export function setClock(state: GameState, color: Color, ms: number): GameState {
  return withPlayer(state, color, { clockMs: ms });
}

/** Seconds added to your clock after each move you make (timed games). */
export const INCREMENT_MS = 3000;

/** Adds the per-move increment to a player's clock (timed games only). */
export function addIncrement(state: GameState, color: Color): GameState {
  const ms = state.players[color].clockMs;
  return ms === null ? state : withPlayer(state, color, { clockMs: ms + INCREMENT_MS });
}

/** `next` with the clocks from `live`: a state saved earlier (e.g. before a result screen) mustn't wind the clocks back. */
export function withClocksFrom(next: GameState, live: GameState): GameState {
  if (!next.options.timed) return next;
  return {
    ...next,
    players: {
      white: { ...next.players.white, clockMs: live.players.white.clockMs },
      black: { ...next.players.black, clockMs: live.players.black.clockMs },
    },
  };
}

/** Extra Time's second move is optional: passing hands the turn back as if it had not been played. */
/** Returns the position to hand to finishTurn, with the turn back with the opponent. */
export function skipExtraTime(state: GameState): GameState | null {
  if (state.step !== "extra-time" || state.outcome) return null;
  const fen = flipTurn(state.fen);
  if (!fen) return null;
  return { ...state, fen, extraTimePending: false };
}
