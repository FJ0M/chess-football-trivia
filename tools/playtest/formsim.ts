// Form economy simulation: how much Form a player earns per own move, using the
// real rules (src/game/rules.ts) for triggers, Hot Spots and rewards. The chess is
// a cheap stand-in (random moves, captures taken about as often as in club games),
// because what matters here is how often questions come up and what they pay.
//
//   npx vite-node tools/playtest/formsim.ts [games=2000]
//
// Each player always picks the same card type (Tap-in, Screamer or Puskás) and
// gets it right with a fixed chance. Power-ups aren't bought, and the Form cap is
// ignored, so the number is the raw earning rate.

import { applyAnswer, finishTurn, legalMoves, newGame, playMove, turnOf } from "../../src/game/rules";
import type { Color, Difficulty, GameState } from "../../src/game/types";

type Pick = "easy" | "hard" | "puskas";

interface Player { acc: number; pick: Pick; chase: boolean }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isCapture = (g: GameState, uci: string) => {
  const to = uci.slice(2, 4);
  const board = g.fen.split(" ")[0];
  // Cheap check: is there a piece on the target square? (Misses en passant; fine for this.)
  const rows = board.split("/");
  const r = 8 - Number(to[1]);
  let file = 0;
  for (const ch of rows[r]) {
    if (/\d/.test(ch)) file += Number(ch);
    else { if (file === to.charCodeAt(0) - 97) return true; file++; }
  }
  return false;
};

function playGame(players: Record<Color, Player>, rng: () => number, maxPlies = 80) {
  let g = newGame({ mode: "local", trivia: true, timed: false, chess960: false, position: 518 },
    { white: { name: "W", kind: "human", club: null }, black: { name: "B", kind: "human", club: null } }, rng);
  const earned = { white: 0, black: 0 }, moves = { white: 0, black: 0 }, questions = { white: 0, black: 0 }, hot = { white: 0, black: 0 };
  for (let ply = 0; ply < maxPlies && !g.outcome && !g.pendingDraw; ply++) {
    const color = turnOf(g);
    const me = players[color];
    const { moves: legal } = legalMoves(g);
    if (!legal.length) break;
    const spots = legal.filter((m) => g.hotSpots.includes(m.slice(2, 4)));
    const caps = legal.filter((m) => isCapture(g, m));
    let uci: string;
    if (me.chase && spots.length) uci = spots[Math.floor(rng() * spots.length)];
    else if (caps.length && rng() < 0.35) uci = caps[Math.floor(rng() * caps.length)];
    else {
      const quiet = legal.filter((m) => !caps.includes(m) && !g.hotSpots.includes(m.slice(2, 4)));
      const pool = quiet.length ? quiet : legal;
      uci = pool[Math.floor(rng() * pool.length)];
    }
    const r = playMove(g, uci, rng);
    g = r.state;
    moves[color]++;
    const t = r.trigger;
    if (t.kind === "hot-spot" || t.kind === "capture" || t.kind === "set-piece") {
      questions[color]++;
      if (t.kind === "hot-spot") hot[color]++;
      const difficulty: Difficulty = me.pick === "easy" ? "easy" : "hard";
      const puskas = me.pick === "puskas";
      const before = g.players[color].form;
      const out = applyAnswer({ ...g, players: { ...g.players, [color]: { ...g.players[color], form: 0 } } }, {
        color, difficulty, puskas, worldie: puskas, bonus: t.kind === "hot-spot", correct: rng() < me.acc, ms: 3000 + rng() * 6000, landed: r.landed,
      } as Parameters<typeof applyAnswer>[1]);
      earned[color] += out.formGained;
      // Keep the real Form at 0 so the cap never hides earnings; streaks and penalties still apply.
      g = { ...out.state, players: { ...out.state.players, [color]: { ...out.state.players[color], form: before } } };
      // Puskás miss = sent off; Screamer miss = booked. Both are in the state already.
    }
    g = finishTurn(g).state;
  }
  return { earned, moves, questions, hot };
}

function run(label: string, p: Player, games: number) {
  const rng = mulberry32(12345);
  let earned = 0, moves = 0, qs = 0, hot = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame({ white: p, black: { ...p } }, rng);
    for (const c of ["white", "black"] as Color[]) { earned += r.earned[c]; moves += r.moves[c]; qs += r.questions[c]; hot += r.hot[c]; }
  }
  console.log(`${label.padEnd(34)} ${(earned / moves).toFixed(2)} Form/move   ${(qs / moves).toFixed(2)} questions/move   ${(hot / moves).toFixed(3)} Hot Spots/move`);
}

const games = Number(process.argv[2] ?? 2000);
console.log(`Form per own move (${games} games each, first 40 moves a side, no spending, no cap)\n`);
for (const chase of [false, true]) {
  console.log(chase ? "\nChasing Hot Spots whenever one is in reach:" : "Not chasing Hot Spots:");
  run("Strong (85%), Screamer", { acc: 0.85, pick: "hard", chase }, games);
  run("Strong (85%), Puskás", { acc: 0.75, pick: "puskas", chase }, games);
  run("Average (65%), Screamer", { acc: 0.65, pick: "hard", chase }, games);
  run("Weak (45%; 65% on Tap-ins), Tap-in", { acc: 0.65, pick: "easy", chase }, games);
}
