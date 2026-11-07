// How the game talks to the bots. The real bots (Stockfish, personalities) live in
// src/bots/ and are loaded if present; until then a small built-in bot stands in
// with the same shape, so vs-bot mode always works.

import { Chess } from "chessops/chess";
import { makeUci, parseUci } from "chessops/util";
import { positionOf } from "./rules";
import type { Difficulty, PromoRole } from "./types";

export type BotId = "ollie" | "ryan" | "freddie";
export type BotLevel = "low" | "medium" | "hard";
export type TalkMoment = "start" | "capture" | "lostPiece" | "oppWrong" | "ownRight" | "ownWrong" | "powerUp" | "hotSpot" | "win" | "loss";

export interface BotMeta { id: BotId; name: string; club: string; blurb: string }

export interface BotLike {
  chooseMove(req: { fen: string; chess960?: boolean; allowedMoves?: string[]; managersTip?: boolean }): Promise<{ uci: string; thinkMs: number }>;
  chooseCard(req: { cards: { topic: string; difficulty: Difficulty; club: string | null }[]; puskasAllowed: boolean; form: number; bonusRound?: boolean }): { index: number; puskas: boolean } | Promise<{ index: number; puskas: boolean }>;
  answer(req: { question: { options: string[]; answer: number; difficulty: Difficulty; club?: string | null }; puskas?: boolean; removed?: number[] }): { choice: number; delayMs: number } | Promise<{ choice: number; delayMs: number }>;
  choosePowerUp(req: { fen: string; color?: "white" | "black"; form: number; available: { id: string; cost: number }[]; inCheck?: boolean; timed?: boolean; clockMs?: number }): { id: string; target?: string; target2?: string } | null | Promise<{ id: string; target?: string; target2?: string } | null>;
  promotionPick(): PromoRole;
  say(moment: TalkMoment): string | null;
}

export interface BotModule {
  createBot(id: BotId, level?: BotLevel): BotLike;
  BOTS: BotMeta[] | Record<string, BotMeta>;
  bestMove(fen: string, chess960?: boolean, depth?: number, searchMoves?: string[]): Promise<string | null>;
}

// ---------------------------------------------------------------- built-in stand-in

const FALLBACK_BOTS: BotMeta[] = [
  { id: "ollie", name: "Ollie", club: "west-ham", blurb: "Trivia whizz, chaotic at chess" },
  { id: "ryan", name: "Ryan", club: "west-ham", blurb: "Middle at both, deadly on West Ham" },
  { id: "freddie", name: "Freddie", club: "brighton", blurb: "Strong at chess, shaky on trivia" },
];

const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

function material(pos: Chess): number {
  let score = 0;
  for (const [, p] of pos.board) score += (p.color === pos.turn ? 1 : -1) * VALUE[p.role];
  return score;
}

/** Two-ply material search: good enough for hints and a stand-in bot. */
function scoreMoves(fen: string, moves: string[]): { uci: string; score: number }[] {
  const root = positionOf(fen);
  return moves.map((uci) => {
    const pos = root.clone();
    const m = parseUci(uci);
    if (!m || !pos.isLegal(m)) return { uci, score: 0 };
    pos.play(m);
    if (pos.isCheckmate()) return { uci, score: 1000 };
    if (pos.isStalemate()) return { uci, score: 0 };
    let worst = Infinity;
    for (const [from, tos] of pos.allDests()) {
      for (const to of tos) {
        const reply = pos.clone();
        const piece = reply.board.get(from)!;
        const promo = piece.role === "pawn" && (to >> 3 === 7 || to >> 3 === 0) ? "queen" : undefined;
        reply.play({ from, to, promotion: promo });
        const s = reply.isCheckmate() ? -1000 : material(reply);
        if (s < worst) worst = s;
      }
    }
    return { uci, score: worst === Infinity ? 0 : worst + (pos.isCheck() ? 0.2 : 0) };
  });
}

function allMoves(fen: string): string[] {
  const pos = positionOf(fen);
  const out: string[] = [];
  for (const [from, tos] of pos.allDests()) for (const to of tos) {
    const piece = pos.board.get(from)!;
    const promo = piece.role === "pawn" && (to >> 3 === 7 || to >> 3 === 0) ? "queen" : undefined;
    out.push(makeUci({ from, to, promotion: promo }));
  }
  return out;
}

const SKILL: Record<BotId, { noise: number; accuracy: number; pick: Difficulty; aim: PromoRole }> = {
  ollie: { noise: 3, accuracy: 0.85, pick: "hard", aim: "q" },
  ryan: { noise: 1.2, accuracy: 0.7, pick: "medium", aim: "r" },
  freddie: { noise: 0.2, accuracy: 0.45, pick: "easy", aim: "n" },
};

const LINES: Record<BotId, Partial<Record<TalkMoment, string>>> = {
  ollie: { start: "Chess is just the bit between the questions.", oppWrong: "Genuinely, how did you not know that?", ownWrong: "That was a trick question, I'm appealing.", capture: "Is the horse allowed to do that? Too late now.", hotSpot: "Your club round? I probably know them better than you.", win: "Brains over board, every time." },
  ryan: { start: "Come on you Irons. Let's have it.", oppWrong: "Even Freddie knew that one.", ownWrong: "Wasn't a West Ham question, was it.", capture: "Bowen, Prague, 2023. Same energy.", hotSpot: "Bubbles are flying!", win: "Forever blowing bubbles, mate." },
  freddie: { start: "You can have the quiz. I'll have the board.", oppWrong: "Finally, someone worse at this than me.", ownWrong: "Football's a distraction. Mate in four, anyway.", capture: "Thanks for that. Didn't even need a hint.", hotSpot: "Oh no. Not the club round.", win: "Should have spent less time on the questions." },
};

function fallbackBot(id: BotId): BotLike {
  const skill = SKILL[id];
  let movesSinceTalk = 2;
  return {
    async chooseMove({ fen, allowedMoves }) {
      const moves = allowedMoves?.length ? allowedMoves : allMoves(fen);
      const scored = scoreMoves(fen, moves).map((s) => ({ ...s, score: s.score + Math.random() * skill.noise }));
      scored.sort((a, b) => b.score - a.score);
      movesSinceTalk++;
      return { uci: scored[0].uci, thinkMs: 500 + Math.random() * 900 };
    },
    chooseCard({ cards, puskasAllowed }) {
      const index = Math.max(0, cards.findIndex((c) => c.difficulty === skill.pick));
      return { index, puskas: puskasAllowed && id === "ollie" && Math.random() < 0.4 };
    },
    answer({ question, puskas }) {
      const right = Math.random() < skill.accuracy - (puskas ? 0.1 : 0);
      const wrong = question.options.map((_, i) => i).filter((i) => i !== question.answer);
      return { choice: right ? question.answer : wrong[Math.floor(Math.random() * wrong.length)], delayMs: 2000 + Math.random() * 5000 };
    },
    choosePowerUp({ available }) {
      const quiet = available.find((p) => p.id === "golden-boot" || p.id === "park-the-bus");
      return quiet && Math.random() < 0.3 ? { id: quiet.id } : null;
    },
    promotionPick: () => skill.aim,
    say(moment) {
      if (movesSinceTalk < 2 && moment !== "win" && moment !== "start") return null;
      const line = LINES[id][moment] ?? null;
      if (line) movesSinceTalk = 0;
      return line;
    },
  };
}

export const fallbackModule: BotModule = {
  createBot: (id) => fallbackBot(id),
  BOTS: FALLBACK_BOTS,
  async bestMove(fen, _chess960, _depth, searchMoves) {
    const moves = searchMoves?.length ? allMoves(fen).filter((m) => searchMoves.includes(m)) : allMoves(fen);
    if (!moves.length) return null;
    const scored = scoreMoves(fen, moves).sort((a, b) => b.score - a.score);
    return scored[0].uci;
  },
};

// The real bots, once src/bots/ exists. import.meta.glob returns {} if it doesn't.
const realBots = import.meta.glob("../bots/index.ts");

let loaded: Promise<BotModule> | null = null;
export function loadBots(): Promise<BotModule> {
  if (!loaded) {
    const load = realBots["../bots/index.ts"];
    loaded = load ? (load() as Promise<BotModule>).catch(() => fallbackModule) : Promise.resolve(fallbackModule);
  }
  return loaded;
}

export function botList(mod: BotModule): BotMeta[] {
  return Array.isArray(mod.BOTS) ? mod.BOTS : Object.values(mod.BOTS);
}
