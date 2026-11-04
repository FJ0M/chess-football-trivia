// Public entry point for the bots. The game imports only from here.

import { createBotWith, type Bot } from "./bot";
import { getSharedEngine, type Analyser } from "./engine";
import { normaliseUci, positionFromFen } from "./movePicker";
import type { BotId, BotLevel } from "./types";

export type { Bot } from "./bot";
export type * from "./types";
export { BOTS, BOT_IDS, BOT_LEVELS, BOT_PROFILES } from "./profiles";
export { TALK } from "./talk";

/** Creates a bot. Stockfish starts in a Web Worker the first time any bot or hint needs it. */
export function createBot(id: BotId, level: BotLevel = "medium", engine?: Analyser): Bot {
  return createBotWith(id, level, engine ?? getSharedEngine());
}

/**
 * Stockfish's best move for the side to move (UCI, chessops convention), for
 * Manager's Tip and Scout Report. Returns null if there is no legal move.
 */
export async function bestMove(fen: string, _chess960 = false, depth = 14): Promise<string | null> {
  const lines = await getSharedEngine().analyse(fen, { depth, multiPv: 1, maxMs: 4000 });
  const uci = lines[0]?.uci;
  return uci ? normaliseUci(positionFromFen(fen), uci) : null;
}
