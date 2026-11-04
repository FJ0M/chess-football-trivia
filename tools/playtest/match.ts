// Bot-vs-bot playtest harness. Plays real games with the real bot code and the
// same Stockfish build the app ships, driven from Node.
//
//   npx vite-node tools/playtest/match.ts -- <config.json> <out.json>
//
// config: { "pairs": [["ollie-low","ryan-low"], ...], "games": 10, "seed": 1 }
// Players are "<bot>-<level>" or "sf-<elo>" (Stockfish with UCI_LimitStrength).

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { makeFen } from "chessops/fen";
import { parseUci } from "chessops/util";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { createBotWith, type Bot } from "../../src/bots/bot";
import { UciEngine, type Transport } from "../../src/bots/engine";
import { normaliseUci, positionFromFen } from "../../src/bots/movePicker";
import type { BotId, BotLevel } from "../../src/bots/types";

const require = createRequire(import.meta.url);
const ENGINE_JS = require.resolve("stockfish/src/stockfish-17.1-lite-single-03e3232.js");

export function nodeEngine(): UciEngine {
  const child = spawn(process.execPath, [ENGINE_JS], { stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", (d: Buffer) => console.log(`ENGINE STDERR ${d.toString().slice(0, 300)}`));
  child.on("exit", (code, sig) => {
    if (code !== 0 && sig !== "SIGTERM") console.log(`ENGINE EXIT ${code} ${sig}`);
  });
  let buf = "";
  const cbs: ((l: string) => void)[] = [];
  child.stdout.on("data", (d: Buffer) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) for (const cb of cbs) cb(line);
    }
  });
  const transport: Transport = {
    send: (cmd) => child.stdin.write(cmd + "\n"),
    onLine: (cb) => cbs.push(cb),
    close: () => child.kill(),
  };
  return new UciEngine(transport);
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random Chess960 start position. */
export function chess960Fen(rng: () => number): string {
  const rank: (string | null)[] = Array(8).fill(null);
  const free = () => rank.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const pick = (arr: number[]) => arr[Math.floor(rng() * arr.length)];
  rank[pick([0, 2, 4, 6])] = "b";
  rank[pick([1, 3, 5, 7])] = "b";
  rank[pick(free())] = "q";
  rank[pick(free())] = "n";
  rank[pick(free())] = "n";
  const [a, k, c] = free();
  rank[a] = "r";
  rank[k] = "k";
  rank[c] = "r";
  const black = rank.join("");
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${black.toUpperCase()} w KQkq - 0 1`;
}

const OPENINGS = [
  "e2e4 e7e5 g1f3 b8c6",
  "e2e4 c7c5 g1f3 d7d6",
  "d2d4 d7d5 c2c4 e7e6",
  "d2d4 g8f6 c2c4 g7g6",
  "e2e4 e7e6 d2d4 d7d5",
  "e2e4 c7c6 d2d4 d7d5",
  "c2c4 e7e5 b1c3 g8f6",
  "g1f3 d7d5 g2g3 g8f6",
  "e2e4 e7e5 f1c4 g8f6",
  "d2d4 d7d5 c1f4 g8f6",
  "e2e4 d7d5 e4d5 d8d5",
  "e2e4 e7e5 d2d4 e5d4",
];

interface Player {
  name: string;
  move(fen: string): Promise<string>;
  newGame(): Promise<void>;
  close(): void;
}

async function makePlayer(name: string, seed: number): Promise<Player> {
  const engine = nodeEngine();
  if (name.startsWith("sf-")) {
    const elo = Number(name.slice(3));
    await engine.setOption("UCI_LimitStrength", true);
    await engine.setOption("UCI_Elo", elo);
    return {
      name,
      move: async (fen) => (await engine.go(fen, "movetime 300"))!,
      newGame: () => engine.newGame(),
      close: () => engine.close(),
    };
  }
  const [id, level] = name.split("-") as [BotId, BotLevel];
  let bot: Bot = createBotWith(id, level, engine, mulberry32(seed));
  return {
    name,
    move: async (fen) => (await bot.chooseMove({ fen })).uci,
    newGame: async () => {
      bot = createBotWith(id, level, engine, mulberry32(seed++));
      await engine.newGame();
    },
    close: () => engine.close(),
  };
}

export interface GameResult {
  white: string;
  black: string;
  /** 1 white wins, 0.5 draw, 0 black wins */
  score: number;
  reason: string;
  plies: number;
  chess960: boolean;
  start: string;
  moves: string[];
}

async function playGame(white: Player, black: Player, startFen: string, preMoves: string[], judge: UciEngine): Promise<GameResult> {
  let pos = Chess.fromSetup(parseFen(startFen).unwrap()).unwrap();
  const moves: string[] = [];
  const seen = new Map<string, number>();
  const play = (uci: string) => {
    const norm = normaliseUci(pos, uci);
    if (!norm) throw new Error(`illegal move ${uci} in ${makeFen(pos.toSetup())}`);
    pos.play(parseUci(norm)!);
    moves.push(norm);
  };
  for (const m of preMoves) play(m);
  await white.newGame();
  await black.newGame();
  const base = { white: white.name, black: black.name, chess960: !startFen.startsWith("rnbqkbnr/"), start: startFen };
  for (;;) {
    const fen = makeFen(pos.toSetup());
    const key = fen.split(" ").slice(0, 4).join(" ");
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const done = (score: number, reason: string): GameResult => ({ ...base, score, reason, plies: moves.length, moves });
    if (pos.isCheckmate()) return done(pos.turn === "white" ? 0 : 1, "mate");
    if (pos.isStalemate()) return done(0.5, "stalemate");
    if (pos.isInsufficientMaterial()) return done(0.5, "material");
    if (pos.halfmoves >= 100) return done(0.5, "50-move");
    if (seen.get(key)! >= 3) return done(0.5, "repetition");
    if (moves.length >= 240) {
      // Long games: let a strong Stockfish judge the final position.
      const lines = await judge.analyse(fen, { depth: 14, multiPv: 1 });
      const s = (lines[0]?.scoreCp ?? 0) * (pos.turn === "white" ? 1 : -1);
      return done(s > 300 ? 1 : s < -300 ? 0 : 0.5, "adjudicated");
    }
    const mover = pos.turn === "white" ? white : black;
    play(await mover.move(fen));
  }
}

async function main() {
  const [configPath, outPath] = process.argv.slice(2).filter((a) => a !== "--");
  const cfg = JSON.parse(readFileSync(configPath, "utf8")) as { pairs: [string, string][]; games: number; seed: number };
  const rng = mulberry32(cfg.seed);
  const judge = nodeEngine();
  const results: GameResult[] = [];
  for (const [a, b] of cfg.pairs) {
    const pa = await makePlayer(a, Math.floor(rng() * 1e9));
    const pb = await makePlayer(b, Math.floor(rng() * 1e9));
    for (let g = 0; g < cfg.games; g++) {
      // Pairs of games from the same start with colours swapped; half are Chess960.
      const round = Math.floor(g / 2);
      const is960 = round % 2 === 1;
      const r2 = mulberry32(cfg.seed * 7919 + round * 104729 + a.length * 31 + b.length);
      const start = is960 ? chess960Fen(r2) : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const pre = is960 ? [] : OPENINGS[Math.floor(r2() * OPENINGS.length)].split(" ");
      const [w, bl] = g % 2 === 0 ? [pa, pb] : [pb, pa];
      const res = await playGame(w, bl, start, pre, judge);
      results.push(res);
      writeFileSync(outPath, JSON.stringify(results));
      console.log(`${res.white} vs ${res.black}: ${res.score} (${res.reason}, ${res.plies} plies${res.chess960 ? ", 960" : ""})`);
    }
    pa.close();
    pb.close();
  }
  judge.close();
  // Sanity check that each recorded game replays legally.
  for (const r of results) {
    const p = positionFromFen(r.start);
    for (const m of r.moves) p.play(parseUci(m)!);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
