import { describe, expect, it } from "vitest";
import { actorOf, savable, seasonResult, step, startMatch, shootoutWinner, RESULT_MS_HUMAN, RESULT_MS, KICK_PAUSE_MS, type Action, type Data, type Effect, type Env, type Match } from "./match";
import { newGame, type PlayerInit } from "./rules";
import { TIMER_MS, type Card } from "./trivia";
import { CLUE_MS, type WhoAmI } from "./whoami";
import type { Color, GameOptions, GameState, Question } from "./types";

const opts = (o: Partial<GameOptions> = {}): GameOptions => ({ mode: "local", trivia: true, timed: false, chess960: false, position: 518, ...o });
const human = (name: string): PlayerInit => ({ name, kind: "human", club: null });
const bot = (name: string): PlayerInit => ({ name, kind: "bot", botId: "pawny", club: null });

function game(o: Partial<GameOptions> = {}, black = human("Ollie")): GameState {
  return newGame(opts(o), { white: human("Ryan"), black });
}
/** A position with everything unlocked and plenty of Form. */
function at(fen: string, o: Partial<GameOptions> = {}, black = human("Ollie")): GameState {
  const g = game(o, black);
  const ready = (p: GameState["players"]["white"]) => ({ ...p, form: 12, cooldowns: Object.fromEntries(Object.keys(p.cooldowns).map((k) => [k, 0])) as typeof p.cooldowns });
  return { ...g, fen, hotSpots: [], players: { white: ready(g.players.white), black: ready(g.players.black) } };
}

const Q: Question = { id: "q1", question: "Who?", options: ["A", "B", "C", "D"], answer: 2, difficulty: "medium", topic: "Premier League", club: null, verified: true };
const CARDS: Card[] = [
  { topic: "Premier League", difficulty: "easy", club: null },
  { topic: "Premier League", difficulty: "medium", club: null },
  { topic: "Premier League", difficulty: "hard", club: null },
];
const SET: WhoAmI = { id: "w1", clues: ["c1", "c2", "c3", "c4", "c5"], options: ["Mark Noble", "B", "C", "D"], answer: 0, name: "Mark Noble", club: null, verified: true };

function banks(): Data {
  const side = () => ({
    bank: { deal: () => CARDS, draw: (c: Card) => ({ ...Q, difficulty: c.difficulty }), any: () => Q },
    whoami: { draw: () => SET, check: (_s: WhoAmI, typed: string) => typed.toLowerCase() === "mark noble" },
  });
  return { white: side(), black: side() };
}

/** Runs actions in order from a start time, returning the match and every effect. */
function run(m: Match, actions: Array<Action | [Action, number]>, env: Partial<Env> = {}): { m: Match; fx: Effect[] } {
  const fx: Effect[] = [];
  let now = 1000;
  for (const a of actions) {
    const [action, t] = Array.isArray(a) ? a : [a, now];
    now = t;
    const out = step(m, action, { now, banks: banks(), engineReady: true, ...env });
    m = out.match;
    fx.push(...out.fx);
  }
  return { m, fx };
}
const sounds = (fx: Effect[]) => fx.flatMap((e) => (e.kind === "sfx" ? [e.sound] : []));

describe("match engine: moves and turns", () => {
  it("a quiet move passes the turn and says who's next", () => {
    const { m, fx } = run(startMatch(game()), [{ type: "move", uci: "e2e4" }]);
    expect(m.phase.kind).toBe("move");
    expect(m.game.fen.split(" ")[1]).toBe("b");
    expect(m.note).toBe("Ollie to move");
    expect(sounds(fx)).toEqual(["move"]);
    expect(fx.some((e) => e.kind === "event" && e.event.kind === "move")).toBe(true);
  });

  it("an illegal move, or a move out of turn, changes nothing", () => {
    const m0 = startMatch(game());
    expect(step(m0, { type: "move", uci: "e2e5" }, { now: 0, banks: banks(), engineReady: true }).match).toBe(m0);
    const cards = { ...m0, phase: { kind: "cards", color: "white", cards: CARDS, bonus: false, landed: null, label: "" } as const };
    expect(step(cards, { type: "move", uci: "e2e4" }, { now: 0, banks: banks(), engineReady: true }).match).toBe(cards);
  });

  it("never changes the match it was given", () => {
    const m0 = startMatch(game());
    const before = JSON.stringify(m0);
    run(m0, [{ type: "move", uci: "e2e4" }, { type: "move", uci: "d7d5" }, { type: "move", uci: "e4d5" }]);
    expect(JSON.stringify(m0)).toBe(before);
  });

  it("a capture deals the question cards, and the bot on the other side gets to moan", () => {
    const { m, fx } = run(startMatch(game({}, bot("Pawny"))), [{ type: "move", uci: "e2e4" }, { type: "bot-move", color: "black", uci: "d7d5" }, { type: "move", uci: "e4d5" }]);
    expect(m.phase).toMatchObject({ kind: "cards", color: "white", label: "Capture: pick a question" });
    expect(m.note).toBe("Ryan: Capture: pick a question");
    expect(fx).toContainEqual({ kind: "talk", color: "black", moment: "lostPiece" });
  });

  it("without the questions downloaded, a capture just ends the turn", () => {
    const { m } = run(startMatch(game()), [{ type: "move", uci: "e2e4" }, { type: "move", uci: "d7d5" }, { type: "move", uci: "e4d5" }], { banks: null });
    expect(m.phase.kind).toBe("move");
  });

  it("checkmate ends the match", () => {
    const { m, fx } = run(startMatch(game({ trivia: false })), ["f2f3", "e7e5", "g2g4", "d8h4"].map((uci) => ({ type: "move", uci }) as Action));
    expect(m.game.outcome).toEqual({ kind: "checkmate", winner: "black" });
    expect(m.phase.kind).toBe("over");
    expect(sounds(fx)).toContain("fulltime");
    expect(actorOf(m)).toBeNull();
  });
});

describe("match engine: questions", () => {
  const capture = (black = human("Ollie")) => run(startMatch(game({}, black)), [{ type: "move", uci: "e2e4" }, { type: "move", uci: "d7d5" }, { type: "move", uci: "e4d5" }]).m;

  it("pick, answer right, then the result moves on to the next turn", () => {
    let { m, fx } = run(capture(), [{ type: "pick", index: 1, puskas: false }, [{ type: "answer", choice: 2 }, 3000]]);
    expect(m.phase).toMatchObject({ kind: "result", correct: true, title: "Ryan got it right!", auto: false });
    expect(m.game.players.white.form).toBeGreaterThan(0);
    expect(m.runs.white).toBe(1);
    expect(fx).toContainEqual({ kind: "sfx", sound: "form", delayMs: 300 });
    ({ m } = run(m, [{ type: "continue" }]));
    expect(m.phase.kind).toBe("move");
    expect(m.game.fen.split(" ")[1]).toBe("b");
  });

  it("a Puskás only applies to a Screamer and has the shorter timer", () => {
    expect(run(capture(), [{ type: "pick", index: 2, puskas: true }]).m.phase).toMatchObject({ kind: "question", puskas: true, limitMs: TIMER_MS.puskas });
    expect(run(capture(), [{ type: "pick", index: 0, puskas: true }]).m.phase).toMatchObject({ kind: "question", puskas: false, limitMs: TIMER_MS.normal });
  });

  it("a person's question times out on the tick, a bot's waits for the bot", () => {
    const { m } = run(capture(), [[{ type: "pick", index: 1, puskas: false }, 1000], [{ type: "tick", dt: 200 }, 1000 + TIMER_MS.normal]]);
    expect(m.phase).toMatchObject({ kind: "result", correct: false, title: "Time's up!" });
    // Black is a bot: black captures back and its question doesn't time out on its own.
    let b = run(capture(bot("Pawny")), [{ type: "pick", index: 1, puskas: false }, { type: "answer", choice: 0 }, { type: "continue" }, { type: "bot-move", color: "black", uci: "d8d5" }]).m;
    expect(b.phase).toMatchObject({ kind: "cards", color: "black" });
    b = run(b, [[{ type: "pick", index: 1, puskas: false }, 5000], [{ type: "tick", dt: 200 }, 5000 + TIMER_MS.normal * 2]]).m;
    expect(b.phase.kind).toBe("question");
  });

  it("an answer after the time limit counts as wrong", () => {
    const { m } = run(capture(), [[{ type: "pick", index: 1, puskas: false }, 1000], [{ type: "answer", choice: 2 }, 1000 + TIMER_MS.normal + 300]]);
    expect(m.phase).toMatchObject({ kind: "result", correct: false });
  });

  it("results move on by themselves: a person gets longer than a bot", () => {
    const shown = run(capture(), [[{ type: "pick", index: 1, puskas: false }, 1000], [{ type: "answer", choice: 2 }, 2000]]).m;
    expect(run(shown, [[{ type: "tick", dt: 200 }, 2000 + RESULT_MS]]).m.phase.kind).toBe("result");
    expect(run(shown, [[{ type: "tick", dt: 200 }, 2000 + RESULT_MS_HUMAN]]).m.phase.kind).toBe("move");
  });

  it("ten right in a row earns Elite Ball Knowledge", () => {
    let m = { ...capture(), runs: { white: 9, black: 0 } };
    const out = run(m, [{ type: "pick", index: 1, puskas: false }, { type: "answer", choice: 2 }]);
    m = out.m;
    expect(m.ebk.white).toBe(true);
    expect(out.fx).toContainEqual({ kind: "event", event: { kind: "ebk", color: "white" }, delayMs: 700 });
  });

  it("unpausing pushes the question timer back by the pause", () => {
    const m = run(capture(), [[{ type: "pick", index: 1, puskas: false }, 1000], { type: "unpause", pausedMs: 30_000 }]).m;
    expect(m.phase).toMatchObject({ kind: "question", startedAt: 31_000 });
  });
});

describe("match engine: Who am I?", () => {
  const promo = (black = human("Ollie")) => startMatch({ ...at("8/P6k/8/8/8/8/8/K7 w - - 0 1", {}, black) });

  it("a right guess on clue 1 lets the player choose a piece, then shows the result", () => {
    let m = run(promo(), [{ type: "move", uci: "a7a8q" }]).m;
    expect(m.phase).toMatchObject({ kind: "whoami", color: "white", clues: 1 });
    m = run(m, [{ type: "guess", input: "Mark Noble" }]).m;
    expect(m.phase).toMatchObject({ kind: "promote", earned: "q" });
    m = run(m, [{ type: "promote", role: "r" }]).m;
    expect(m.phase).toMatchObject({ kind: "result", correct: true, title: "Ryan got it on clue 1!" });
    expect(m.game.fen.startsWith("R7")).toBe(true);
  });

  it("clues come on the timer, and after the fifth it's time up (a knight)", () => {
    let m = run(promo(), [[{ type: "move", uci: "a7a8q" }, 0]]).m;
    for (let k = 1; k <= 4; k++) m = run(m, [[{ type: "tick", dt: 200 }, k * CLUE_MS]]).m;
    expect(m.phase).toMatchObject({ kind: "whoami", clues: 5 });
    m = run(m, [[{ type: "tick", dt: 200 }, 5 * CLUE_MS]]).m;
    expect(m.phase).toMatchObject({ kind: "result", correct: false, title: "Time's up!" });
    expect(m.game.fen.startsWith("N7")).toBe(true);
  });

  it("a wrong typed guess says what the answer was", () => {
    const m = run(promo(), [{ type: "move", uci: "a7a8q" }, { type: "guess", input: "Kevin Nolan" }]).m;
    expect(m.phase).toMatchObject({ kind: "result", correct: false });
    if (m.phase.kind === "result") expect(m.phase.lines[0]).toBe(`"Kevin Nolan" isn't right: it was Mark Noble`);
  });
});

describe("match engine: power-ups", () => {
  it("a blocked power-up says why and changes nothing else", () => {
    const m0 = startMatch(game());
    const { m, fx } = run(m0, [{ type: "power", id: "red-card" }]);
    expect(m.phase.kind).toBe("move");
    expect(m.game).toBe(m0.game);
    expect(sounds(fx)).toEqual(["locked"]);
  });

  it("a targeted power-up asks for a square, then applies", () => {
    const m0 = startMatch(at("4k3/8/8/3p4/8/8/8/4K3 w - - 0 1"));
    let m = run(m0, [{ type: "power", id: "tactical-foul" }]).m;
    expect(m.phase).toMatchObject({ kind: "target", power: "tactical-foul" });
    const out = run(m, [{ type: "target", square: "d5" }]);
    m = out.m;
    expect(m.phase.kind).toBe("move");
    expect(m.game.frozen.some((f) => f.square === "d5")).toBe(true);
    expect(sounds(out.fx)).toContain("powerup");
  });

  it("Manager's Tip asks the engine, and only spends Form once it answers", () => {
    const m0 = startMatch(at("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"));
    const out = run(m0, [{ type: "power", id: "managers-tip" }]);
    expect(out.m.phase).toMatchObject({ kind: "thinking", power: "managers-tip" });
    expect(out.m.game.players.white.form).toBe(12);
    const look = out.fx.find((e) => e.kind === "lookup");
    expect(look).toMatchObject({ kind: "lookup", id: "managers-tip", color: "white" });
    const stumped = run(out.m, [{ type: "lookup-done", id: "managers-tip", color: "white", targets: [], best: null }]).m;
    expect(stumped.phase.kind).toBe("move");
    expect(stumped.game.players.white.form).toBe(12);
    const tip = run(out.m, [{ type: "lookup-done", id: "managers-tip", color: "white", targets: [], best: "e2e4" }]).m;
    expect(tip.overlay.tip).toEqual(["e2", "e4"]);
    expect(tip.game.players.white.form).toBeLessThan(12);
  });

  it("engine power-ups wait for the engine to load", () => {
    const { m } = run(startMatch(at("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")), [{ type: "power", id: "managers-tip" }], { engineReady: false });
    expect(m.phase.kind).toBe("move");
    expect(m.note).toMatch(/warming up/);
  });

  it("a bot's power-up applies to the live game", () => {
    const m0 = startMatch(at("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", {}, bot("Pawny")));
    const { m, fx } = run(m0, [{ type: "move", uci: "a1a2" }, { type: "bot-power", color: "black", id: "park-the-bus", targets: [] }]);
    expect(fx).toContainEqual({ kind: "talk", color: "black", moment: "powerUp" });
    expect(m.game.powerUsedId).toBe("park-the-bus");
  });
});

describe("match engine: clocks", () => {
  it("the clock runs for whoever has to act, and a flag fall ends the game", () => {
    let m = startMatch(game({ timed: true, minutes: 1, trivia: false }));
    m = run(m, [{ type: "tick", dt: 1000 }]).m;
    expect(m.game.players.white.clockMs).toBe(59_000);
    expect(m.game.players.black.clockMs).toBe(60_000);
    m = run(m, [{ type: "tick", dt: 60_000 }]).m;
    expect(m.game.outcome).toEqual({ kind: "timeout", winner: "black" });
    expect(m.phase.kind).toBe("over");
  });

  it("a tick in an untimed game with nothing due returns the same match", () => {
    const m0 = startMatch(game());
    expect(step(m0, { type: "tick", dt: 200 }, { now: 5000, banks: banks(), engineReady: true }).match).toBe(m0);
  });

  it("the clock keeps the same phase object, so a waiting bot isn't interrupted", () => {
    const m0 = startMatch(game({ timed: true }));
    const m = step(m0, { type: "tick", dt: 200 }, { now: 5000, banks: banks(), engineReady: true }).match;
    expect(m.phase).toBe(m0.phase);
    expect(m.game).not.toBe(m0.game);
  });
});

describe("match engine: draws and the shootout", () => {
  it("an agreed draw goes to penalties, which run to a winner", () => {
    let { m } = run(startMatch(game()), [{ type: "agree-draw" }]);
    expect(m.phase).toMatchObject({ kind: "shootout", taker: "white", kicks: [] });
    // White scores every kick, Black misses every one: 3-0 after three each settles it.
    for (let i = 0; i < 6; i++) {
      const taker: Color = i % 2 ? "black" : "white";
      const out = run(m, [{ type: "kick", choice: taker === "white" ? 2 : 0 }]);
      expect(out.fx).toContainEqual({ kind: "later", delayMs: KICK_PAUSE_MS, action: { type: "kick-settle" } });
      m = run(out.m, [{ type: "kick-settle" }]).m;
      if (m.phase.kind === "over") break;
    }
    expect(m.game.outcome).toEqual({ kind: "shootout", winner: "white", score: { white: 3, black: 0 } });
  });

  it("without the questions a draw is just a draw", () => {
    const { m } = run(startMatch(game()), [{ type: "agree-draw" }], { banks: null });
    expect(m.game.outcome).toEqual({ kind: "draw", reason: "agreement" });
  });

  it("resigning ends the match for the other side", () => {
    const { m } = run(startMatch(game()), [{ type: "resign", color: "white" }]);
    expect(m.game.outcome).toEqual({ kind: "resign", winner: "black" });
  });

  it("shootoutWinner: five each, then sudden death", () => {
    const k = (c: Color, scored: boolean) => ({ color: c, scored });
    expect(shootoutWinner([k("white", true), k("black", false), k("white", true), k("black", false), k("white", true), k("black", false)])).toBe("white");
    const ten = Array.from({ length: 10 }, (_, i) => k(i % 2 ? "black" : "white", true));
    expect(shootoutWinner(ten)).toBeNull();
    expect(shootoutWinner([...ten, k("white", true), k("black", false)])).toBe("white");
  });
});

describe("match engine: save/resume and the season", () => {
  it("saves at the start of each turn and at full time, never halfway through a question", () => {
    const m0 = startMatch(game());
    expect(savable(m0)).toBe(m0.game);
    const cards = run(m0, [{ type: "move", uci: "e2e4" }, { type: "move", uci: "d7d5" }, { type: "move", uci: "e4d5" }]).m;
    expect(savable(cards)).toBeNull();
    const over = run(m0, [{ type: "resign", color: "white" }]).m;
    expect(savable(over)).toBe(over.game);
    // Hidden mid-turn: only while it's someone's move, and not once it's over.
    expect(savable(m0, true)).toBe(m0.game);
    expect(savable(over, true)).toBeNull();
  });

  it("a saved match carries on from its position with a welcome back", () => {
    const played = run(startMatch(game()), [{ type: "move", uci: "e2e4" }]).m;
    const { step: _drop, ...old } = played.game;
    const back = startMatch(old as GameState, true);
    expect(back.game.fen).toBe(played.game.fen);
    expect(back.game.step).toBe("normal");
    expect(back.phase.kind).toBe("move");
    expect(back.note).toMatch(/Welcome back/);
    expect(run(back, [{ type: "move", uci: "e7e5" }]).m.note).toBe("Ryan to move");
  });

  it("season result: goals are pieces taken, and a shootout win is a win", () => {
    let m = run(startMatch(game()), [{ type: "move", uci: "e2e4" }, { type: "move", uci: "d7d5" }, { type: "move", uci: "e4d5" }], { banks: null }).m;
    m = run(m, [{ type: "resign", color: "black" }]).m;
    expect(seasonResult(m.game, "white")).toEqual({ goalsFor: 1, goalsAgainst: 0, result: "won" });
    expect(seasonResult(m.game, "black")).toEqual({ goalsFor: 0, goalsAgainst: 1, result: "lost" });
    const shoot = { ...m.game, outcome: { kind: "shootout" as const, winner: "black" as const, score: { white: 2, black: 3 } } };
    expect(seasonResult(shoot, "black").result).toBe("won");
    const draw = { ...m.game, outcome: { kind: "draw" as const, reason: "agreement" as const } };
    expect(seasonResult(draw, "white").result).toBe("drawn");
  });
});
