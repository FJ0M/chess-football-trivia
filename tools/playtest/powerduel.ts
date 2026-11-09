// Power-up duel: the same bot plays itself with the real game rules (src/game/rules.ts),
// trivia included, but one side plans its power-ups with the engine (the game passes it
// every option, as in the app) and the other uses the old rules of thumb. The score
// says how much the planner is worth. It also reports how often a side 3+ points up
// at move 20 goes on to win (the "runaway" check).
//
//   npx vite-node tools/playtest/powerduel.ts -- <bot> [games=20] [seed=1]
//
// <bot> is "<bot>-<level>" or a ladder bot id, e.g. "ryan-medium" or "mo-mate".

import { createBotWith, type Bot } from "../../src/bots/bot";
import type { UciEngine } from "../../src/bots/engine";
import { botPowerOptions } from "../../src/game/botPowers";
import { POWER_UPS } from "../../src/game/powerups";
import {
  PROMOTION_AIM, applyAnswer, finishTurn, legalMoves, materialEdge, newGame, playMove, positionOf, powerBlocked, powerCost, resolvePromotion, turnOf, usePowerUp,
} from "../../src/game/rules";
import type { Color, Difficulty, GameState, PowerUpId } from "../../src/game/types";
import { mulberry32, nodeEngine, parseBotSpec } from "./common";

const [spec = "ryan-medium", gamesArg = "20", seedArg = "1"] = process.argv.slice(2).filter((a) => a !== "--");
const GAMES = Number(gamesArg);
const MAX_PLIES = 200;

const timing = { calls: 0, ms: 0, max: 0 };

interface Side { bot: Bot; engine: UciEngine; smart: boolean }

async function play(sides: Record<Color, Side>, rng: () => number) {
  let g: GameState = newGame({ mode: "bot", trivia: true, timed: false, chess960: false, position: 518 },
    { white: { name: "W", kind: "bot", club: null }, black: { name: "B", kind: "bot", club: null } }, rng);
  const used: Record<Color, Partial<Record<PowerUpId, number>>> = { white: {}, black: {} };
  let edgeAt20: number | null = null;
  for (let ply = 0; ply < MAX_PLIES && !g.outcome && !g.pendingDraw; ply++) {
    const color = turnOf(g);
    const side = sides[color];
    if (ply === 40) edgeAt20 = materialEdge(g, "white");
    if (g.step === "normal") {
      const available = POWER_UPS.filter((d) => !powerBlocked(g, d.id) && d.id !== "scout-report" && d.id !== "assistants-flag")
        .map((d) => ({ id: d.id, cost: powerCost(g, color, d.id) }));
      if (available.length) {
        const t0 = Date.now();
        const choice = await side.bot.choosePowerUp({
          fen: g.fen, color, form: g.players[color].form, available, inCheck: positionOf(g.fen).isCheck(),
          options: side.smart ? botPowerOptions(g) : undefined,
        });
        if (side.smart) { timing.calls++; timing.ms += Date.now() - t0; timing.max = Math.max(timing.max, Date.now() - t0); }
        if (choice) {
          const res = usePowerUp(g, choice.id as PowerUpId, [choice.target, choice.target2].filter((t): t is string => !!t));
          if (!res.error) {
            g = res.state;
            used[color][choice.id as PowerUpId] = (used[color][choice.id as PowerUpId] ?? 0) + 1;
          }
        }
      }
    }
    const allowed = legalMoves(g).moves;
    if (!allowed.length) break;
    let uci = allowed[0];
    const dash = g.counterAttack ? allowed.find((m) => m.startsWith(g.counterAttack!) && Math.abs(Number(m[3]) - Number(m[1])) === 2) : undefined;
    if (dash) uci = dash;
    else {
      try {
        const r = await side.bot.chooseMove({ fen: g.fen, allowedMoves: allowed, managersTip: g.powerUsedId === "managers-tip", hotSpots: g.hotSpots, goldenBoot: g.players[color].goldenBootMoves > 0 });
        if (allowed.includes(r.uci)) uci = r.uci;
      } catch { /* keep the first legal move */ }
    }
    const r = playMove(g, uci, rng);
    g = r.state;
    const t = r.trigger;
    if (t.kind === "promotion") {
      const aim = PROMOTION_AIM[side.bot.promotionPick()];
      const a = side.bot.answer({ question: { options: ["a", "b", "c", "d"], answer: 0, difficulty: aim.difficulty }, puskas: aim.puskas });
      g = resolvePromotion(g, t.square, aim.clues, a.choice === 0).state;
    } else if (t.kind !== "none") {
      const cards = (["easy", "medium", "hard"] as Difficulty[]).map((difficulty) => ({ topic: "General", difficulty, club: null }));
      const pick = side.bot.chooseCard({ cards, puskasAllowed: true, form: g.players[color].form });
      const difficulty = cards[pick.index].difficulty;
      const a = side.bot.answer({ question: { options: ["a", "b", "c", "d"], answer: 0, difficulty }, puskas: pick.puskas });
      g = applyAnswer(g, { color, difficulty, puskas: pick.puskas, bonus: false, correct: a.choice === 0, ms: a.delayMs, landed: r.landed }).state;
    }
    g = finishTurn(g).state;
  }
  let white = 0.5;
  const o = g.outcome;
  if (o && o.kind !== "draw") white = o.winner === "white" ? 1 : 0;
  else if (!o && !g.pendingDraw) {
    const lines = await sides.white.engine.analyse(g.fen, { depth: 10, multiPv: 1 });
    const s = (lines[0]?.scoreCp ?? 0) * (turnOf(g) === "white" ? 1 : -1);
    white = s > 300 ? 1 : s < -300 ? 0 : 0.5;
  }
  return { white, used, edgeAt20 };
}

async function main() {
  const [id, level] = parseBotSpec(spec);
  const rng = mulberry32(Number(seedArg));
  const eA = nodeEngine(), eB = nodeEngine();
  let smartScore = 0;
  const usage = { smart: {} as Record<string, number>, old: {} as Record<string, number> };
  let leads = 0, leaderWins = 0;
  for (let i = 0; i < GAMES; i++) {
    const smartWhite = i % 2 === 0;
    const smart: Side = { bot: createBotWith(id, level, eA, rng), engine: eA, smart: true };
    const old: Side = { bot: createBotWith(id, level, eB, rng), engine: eB, smart: false };
    const sides = smartWhite ? { white: smart, black: old } : { white: old, black: smart };
    const r = await play(sides, rng);
    const s = smartWhite ? r.white : 1 - r.white;
    smartScore += s;
    for (const [c, k] of [["white", smartWhite ? "smart" : "old"], ["black", smartWhite ? "old" : "smart"]] as const) {
      for (const [p, n] of Object.entries(r.used[c])) usage[k][p] = (usage[k][p] ?? 0) + n!;
    }
    if (r.edgeAt20 !== null && Math.abs(r.edgeAt20) >= 3) {
      leads++;
      if ((r.edgeAt20 > 0 && r.white === 1) || (r.edgeAt20 < 0 && r.white === 0)) leaderWins++;
    }
    console.log(`game ${i + 1}: planner ${smartWhite ? "white" : "black"} scored ${s}`);
  }
  console.log(JSON.stringify({ bot: spec, games: GAMES, plannerScore: smartScore / GAMES, usage, runaway: { leadsAtMove20: leads, leaderWon: leaderWins }, plannerMs: { avg: Math.round(timing.ms / Math.max(1, timing.calls)), max: timing.max } }, null, 1));
  (eA as unknown as { transport: { close(): void } }).transport.close();
  (eB as unknown as { transport: { close(): void } }).transport.close();
  process.exit(0);
}

main();
