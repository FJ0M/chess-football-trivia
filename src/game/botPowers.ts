// Every way a bot could use its power-ups right now, as positions in the real rules.
// The bot tries each one with the engine and buys the best value (src/bots/planner.ts).
// Trivia is left out: a move that would trigger a question just finishes the turn.

import { makeUci, opposite } from "chessops/util";
import { POWER_UPS } from "./powerups";
import { attackedSquares, counterAttackMove, finishTurn, legalMoves, playMove, powerBlocked, powerCost, powerTargets, turnOf, usePowerUp } from "./rules";
import type { Color, GameState, PowerUpId } from "./types";

export interface SimNode {
  fen: string;
  moves: string[];
  mine: boolean;
  over?: "win" | "loss" | "draw";
  play(uci: string): SimNode | null;
}

export interface PowerUpOption {
  id: PowerUpId;
  cost: number;
  target?: string;
  target2?: string;
  node: SimNode;
}

/** Power-ups with no board effect to measure: the bot judges these itself (src/bots/bot.ts). */
const SKIP: PowerUpId[] = ["scout-report", "assistants-flag", "managers-tip", "golden-boot", "fergie-time"];
/** Formation Change has up to ~100 pairs; only the most promising ones are tried. */
const MAX_FORMATION_PAIRS = 16;

const fixed = () => 0.5;

export function simNode(state: GameState, me: Color): SimNode {
  const o = state.outcome;
  const over = !o ? undefined : o.kind === "draw" ? "draw" : o.winner === me ? "win" : "loss";
  const moves = over ? [] : legalMoves(state).moves;
  return {
    fen: state.fen,
    moves,
    mine: turnOf(state) === me,
    over: over ?? (state.pendingDraw ? "draw" : undefined),
    play(uci) {
      if (!moves.includes(uci)) return null;
      const played = playMove(state, uci, fixed).state;
      return simNode(finishTurn(played).state, me);
    },
  };
}

/** How many squares a side's pieces attack: a cheap way to rank Formation Change pairs. */
function reach(fen: string, color: Color): number {
  return attackedSquares(fen, color).length;
}

export interface BotPowerOptions { base: SimNode; options: PowerUpOption[] }

export function botPowerOptions(state: GameState): BotPowerOptions {
  const me = turnOf(state);
  const base = simNode(state, me);
  const options: PowerUpOption[] = [];
  const add = (id: PowerUpId, targets: string[]) => {
    const r = usePowerUp(state, id, targets);
    if (r.error) return;
    let node = simNode(r.state, me);
    if (id === "counter-attack") {
      // The point of it is the dash, and the game plays the dash straight after.
      const dash = counterAttackMove(state.fen, targets[0]);
      if (!dash) return;
      if (!node.moves.includes(makeUci(dash))) return;
      node = { ...node, moves: [makeUci(dash)] };
    }
    options.push({ id, cost: powerCost(state, me, id), target: targets[0], target2: targets[1], node });
  };

  for (const def of POWER_UPS) {
    if (SKIP.includes(def.id) || powerBlocked(state, def.id)) continue;
    switch (def.target) {
      case "none":
        add(def.id, []);
        break;
      case "two-own-pieces": {
        const before = reach(state.fen, me);
        const pairs: { a: string; b: string; score: number }[] = [];
        for (const a of powerTargets(state, def.id)) {
          for (const b of powerTargets(state, def.id, a)) {
            if (b <= a) continue;
            const r = usePowerUp(state, def.id, [a, b]);
            if (r.error) continue;
            // Swaps that free pieces up, or move a piece out of an attack, are worth a closer look.
            const hung = attackedSquares(state.fen, opposite(me));
            const rescue = hung.includes(a) || hung.includes(b) ? 4 : 0;
            pairs.push({ a, b, score: reach(r.state.fen, me) - before + rescue });
          }
        }
        pairs.sort((x, y) => y.score - x.score);
        for (const p of pairs.slice(0, MAX_FORMATION_PAIRS)) add(def.id, [p.a, p.b]);
        break;
      }
      default:
        for (const sq of powerTargets(state, def.id)) add(def.id, [sq]);
    }
  }
  return { base, options };
}
