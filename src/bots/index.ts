// Public entry point for the bots. The game imports only from here.

import { createBotWith, type Bot } from "./bot";
import { getSharedEngine, type Analyser } from "./engine";
import { parseSquare } from "chessops/util";
import { normaliseUci, positionFromFen } from "./movePicker";
import type { BotId, BotLevel } from "./types";

export type { Bot } from "./bot";
export type * from "./types";
export { BOTS, BOT_IDS, BOT_LEVELS, BOT_PROFILES, LADDER_IDS, matchRating, triviaAccuracy, triviaElo, type BotRating } from "./profiles";
export { TALK } from "./talk";

/** Creates a bot. Stockfish starts in a Web Worker the first time any bot or hint needs it. */
export function createBot(id: BotId, level: BotLevel = "medium", engine?: Analyser): Bot {
  return createBotWith(id, level, engine ?? getSharedEngine());
}

/**
 * Stockfish's best move for the side to move (UCI, chessops convention), for
 * Manager's Tip and Scout Report. Returns null if there is no legal move.
 */
export async function bestMove(fen: string, chess960 = false, depth = 14, searchMoves?: string[]): Promise<string | null> {
  const pos = positionFromFen(fen);
  const search = searchMoves?.map((u) => engineUci(fen, u, chess960));
  const lines = await getSharedEngine().analyse(fen, { depth, multiPv: 1, maxMs: 4000, searchMoves: search?.length ? search : undefined });
  const uci = lines[0]?.uci;
  return uci ? normaliseUci(pos, uci) : null;
}

/**
 * A quick, shallow engine score for the commentator, from White's side in centipawns.
 * Mates come back as +/-(MATE_CP - plies). Null if the engine can't say.
 */
export async function evaluate(fen: string, _chess960 = false): Promise<number | null> {
  try {
    const lines = await getSharedEngine().analyse(fen, { depth: 10, multiPv: 1, maxMs: 700 });
    const cp = lines[0]?.scoreCp;
    if (cp === undefined) return null;
    return fen.split(" ")[1] === "b" ? -cp : cp;
  } catch {
    return null;
  }
}

/** chessops writes castling as king-takes-rook (e1h1); standard-chess Stockfish wants e1g1. */
function engineUci(fen: string, uci: string, chess960: boolean): string {
  if (chess960 || uci.length < 4) return uci;
  const pos = positionFromFen(fen);
  const from = pos.board.get(parseSquare(uci.slice(0, 2))!);
  const to = pos.board.get(parseSquare(uci.slice(2, 4))!);
  if (from?.role !== "king" || to?.role !== "rook" || to.color !== from.color) return uci;
  return uci.slice(0, 2) + (uci[2] > uci[0] ? "g" : "c") + uci[3];
}
