import { describe, expect, it } from "vitest";
import { createBotWith } from "../bots/bot";
import type { Analyser } from "../bots/engine";
import { legalMoves as chessMoves, materialBalance, positionFromFen } from "../bots/movePicker";
import { planPowerUp } from "../bots/planner";
import { BOT_PROFILES } from "../bots/profiles";
import { parseUci } from "chessops/util";
import { botPowerOptions } from "./botPowers";
import { newGame, powerCost } from "./rules";
import type { GameState } from "./types";

function at(fen: string, form = 12): GameState {
  const g = newGame({ mode: "bot", trivia: true, timed: false, chess960: false, position: 518 },
    { white: { name: "Bot", kind: "bot", club: null }, black: { name: "You", kind: "human", club: null } }, () => 0.3);
  const ready = (p: GameState["players"]["white"]) => ({ ...p, form, cooldowns: Object.fromEntries(Object.keys(p.cooldowns).map((k) => [k, 0])) as typeof p.cooldowns });
  return { ...g, fen, hotSpots: [], players: { white: ready(g.players.white), black: ready(g.players.black) } };
}

/** Fake engine: one ply of greedy material, so tests can reason about what the planner sees. */
const greedy: Analyser = {
  async analyse(fen, opts) {
    const pos = positionFromFen(fen);
    const me = pos.turn;
    const moves = opts.searchMoves ?? chessMoves(pos);
    const scored = moves.map((uci) => {
      const p = pos.clone();
      p.play(parseUci(uci)!);
      return { uci, scoreCp: materialBalance(p, me), depth: opts.depth, multipv: 1 };
    }).sort((a, b) => b.scoreCp - a.scoreCp);
    return scored.slice(0, opts.multiPv).map((l, i) => ({ ...l, multipv: i + 1 }));
  },
};

describe("bot power-up options", () => {
  it("lists every valid target, in the real rules", () => {
    const g = at("4k3/1p4p1/8/8/8/8/P6P/4K3 w - - 0 1");
    const { options } = botPowerOptions(g);
    expect(options.filter((o) => o.id === "red-card").map((o) => o.target).sort()).toEqual(["b7", "g7"]);
    expect(options.filter((o) => o.id === "super-sub").map((o) => o.target).sort()).toEqual(["a2", "h2"]);
    // Counter-Attack is only worth trying as the dash itself.
    for (const o of options.filter((o) => o.id === "counter-attack")) expect(o.node.moves).toHaveLength(1);
  });

  it("knows a Tactical Foul turn can't capture", () => {
    const g = at("n3k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    const foul = botPowerOptions(g).options.find((o) => o.id === "tactical-foul" && o.target === "a8")!;
    expect(foul.node.moves).not.toContain("a1a8");
    expect(botPowerOptions(g).base.moves).toContain("a1a8");
  });
});

describe("power-up planner", () => {
  const profile = { ...BOT_PROFILES["mo-mate"], favouritePowerUps: [] };
  const strength = BOT_PROFILES["mo-mate"].levels.medium.chess;
  const plan = (g: GameState) => planPowerUp(greedy, profile, strength, { form: g.players.white.form, ...botPowerOptions(g) }, () => 0.5);

  it("buys a power-up only when it gains more than its Form is worth", async () => {
    // Super-Sub turns a pawn into a knight (+2 pawns). At full price (7 Form) that's not quite worth it...
    const fen = "4k3/p7/8/8/8/8/3P3P/4K3 w - - 0 1";
    const g = at(fen, 7);
    expect(powerCost(g, "white", "super-sub")).toBe(7);
    expect(await plan(g)).toBeNull();
    // ...but with Form at the cap it's use it or lose it.
    expect((await plan(at(fen, 12)))?.choice).toEqual({ id: "super-sub", target: "d2" });
  });

  it("the bot uses the planner when the game sends options", async () => {
    const g = at("4k3/p7/8/8/8/8/3P3P/4K3 w - - 0 1", 12);
    const bot = createBotWith("mo-mate", "medium", greedy, () => 0.5, profile);
    const available = [{ id: "super-sub", cost: 7 }];
    const pick = await bot.choosePowerUp({ fen: g.fen, form: 12, available, options: botPowerOptions(g) });
    expect(pick).toEqual({ id: "super-sub", target: "d2" });
  });
});
