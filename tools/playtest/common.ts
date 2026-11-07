// Helpers shared by the playtest scripts (match.ts and fullgame.ts).

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { UciEngine, type Transport } from "../../src/bots/engine";
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

/** "<bot>-<level>", or just "<bot>" for a ladder bot (one level). Bot ids can contain hyphens. */
export function parseBotSpec(spec: string): [BotId, BotLevel] {
  const m = /^(.*)-(low|medium|hard)$/.exec(spec);
  return m ? [m[1] as BotId, m[2] as BotLevel] : [spec as BotId, "medium"];
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

