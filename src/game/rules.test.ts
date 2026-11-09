import { describe, expect, it } from "vitest";
import { backRank, startFen } from "./chess960";
import {
  applyAnswer, attackedSquares, resolvePromotion, finishTurn, firstMoveReach, legalMoves, material, newGame, pickHotSpots, playMove,
  powerBlocked, powerCost, powerTargets, resolveMove, skipExtraTime, turnOf, usePowerUp, addIncrement, withClocksFrom,
} from "./rules";
import { fergieMs } from "./powerups";
import type { GameOptions, GameState } from "./types";

const opts = (o: Partial<GameOptions> = {}): GameOptions => ({ mode: "local", trivia: true, timed: false, chess960: false, position: 518, ...o });
const game = (o: Partial<GameOptions> = {}) =>
  newGame(opts(o), { white: { name: "Ryan", kind: "human", club: "west-ham" }, black: { name: "Ollie", kind: "human", club: "west-ham" } }, () => 0.3);

/** Puts the game in an arbitrary position with everything unlocked and plenty of Form. */
function at(fen: string, o: Partial<GameOptions> = {}): GameState {
  const g = game(o);
  const ready = (p: GameState["players"]["white"]) => ({ ...p, form: 12, cooldowns: Object.fromEntries(Object.keys(p.cooldowns).map((k) => [k, 0])) as typeof p.cooldowns });
  return { ...g, fen, hotSpots: [], players: { white: ready(g.players.white), black: ready(g.players.black) } };
}

function move(state: GameState, uci: string): GameState {
  const m = resolveMove(state, uci);
  if (!m) throw new Error(`illegal ${uci}`);
  return finishTurn(playMove(state, m).state).state;
}

describe("Chess960", () => {
  it("518 is the normal start", () => {
    expect(backRank(518)).toBe("RNBQKBNR");
  });
  it("every position has opposite-coloured bishops and the king between the rooks", () => {
    for (let n = 0; n < 960; n++) {
      const r = backRank(n);
      const b = [...r].flatMap((c, i) => (c === "B" ? [i] : []));
      expect(b[0] % 2).not.toBe(b[1] % 2);
      expect(r.indexOf("R")).toBeLessThan(r.indexOf("K"));
      expect(r.lastIndexOf("R")).toBeGreaterThan(r.indexOf("K"));
    }
    expect(new Set(Array.from({ length: 960 }, (_, n) => backRank(n))).size).toBe(960);
  });
  it("castles the Chess960 way: king and rook end on the usual squares", () => {
    // Position with king on b1 and rooks on a1 and c1 after clearing.
    let g = at("3k4/8/8/8/8/8/8/1R1K1R2 w K - 0 1", { chess960: true });
    const castle = resolveMove(g, "d1f1");
    expect(castle).toBe("d1f1");
    g = playMove(g, castle!).state;
    expect(g.fen.startsWith("3k4/8/8/8/8/8/8/1R3RK1")).toBe(true);
  });
  it("accepts the usual e1g1 castling in normal chess", () => {
    const g = at("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(resolveMove(g, "e1g1")).toBe("e1h1");
  });
});

describe("Hot Spots", () => {
  it("puts one on each half of the board, never where a piece can land on move one", () => {
    for (const n of [518, 0, 100, 959]) {
      const fen = startFen(n);
      const reach = firstMoveReach(fen);
      for (let seed = 0; seed < 5; seed++) {
        const spots = pickHotSpots(fen, () => (seed + 0.5) / 5);
        expect(spots).toHaveLength(2);
        expect(spots.filter((s) => "34".includes(s[1]))).toHaveLength(1);
        expect(spots.filter((s) => "56".includes(s[1]))).toHaveLength(1);
        for (const s of spots) expect(reach.has(s)).toBe(false);
      }
    }
  });
  it("triggers a club round and moves once used", () => {
    let g = game();
    g = { ...g, hotSpots: ["e4", "c5"] };
    const r = playMove(g, resolveMove(g, "e2e4")!);
    expect(r.trigger.kind).toBe("hot-spot");
    expect(r.state.hotSpots).not.toContain("e4");
    expect(r.state.hotSpots).toHaveLength(2);
    expect(r.state.hotSpots.filter((s) => "34".includes(s[1]))).toHaveLength(1);
  });
  it("Hot Spots stay put until someone lands on one", () => {
    let g = game();
    g = { ...g, hotSpots: ["a3", "h5"] };
    for (const m of ["g1f3", "g8f6", "f3g1", "f6g8"]) {
      const r = playMove(g, resolveMove(g, m)!, Math.random);
      expect(r.state.hotSpots).toEqual(["a3", "h5"]);
      g = finishTurn(r.state).state;
    }
  });
});

describe("triggers", () => {
  it("fires Kick-off on every 4th quiet move", () => {
    let g: GameState = { ...game(), hotSpots: [] };
    const kinds: string[] = [];
    for (const m of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6"]) {
      const r = playMove(g, resolveMove(g, m)!);
      kinds.push(r.trigger.kind);
      g = finishTurn(r.state).state;
    }
    expect(kinds).toEqual(["none", "none", "none", "none", "none", "none", "kickoff", "kickoff", "none", "none"]);
  });
  it("a Who am I? restarts the Kick-off count, so a kick-off can't follow straight after", () => {
    let g = at("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    g = { ...g, players: { ...g.players, white: { ...g.players.white, kickoffCount: 3 } } };
    const r = playMove(g, "b7b8q");
    expect(r.trigger.kind).toBe("promotion");
    expect(r.state.players.white.kickoffCount).toBe(0);
  });
  it("a capture triggers a question", () => {
    let g = at("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    expect(playMove(g, "e4d5").trigger.kind).toBe("capture");
    g = at("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", { trivia: false });
    expect(playMove(g, "e4d5").trigger.kind).toBe("none");
  });
  it("promotion is a Who am I: earlier right guesses earn better pieces, wrong gives a knight and +2 to the opponent", () => {
    const g = at("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    const r = playMove(g, "b7b8q");
    expect(r.trigger).toMatchObject({ kind: "promotion", square: "b8" });
    expect(resolvePromotion(r.state, "b8", 1, true).state.fen.startsWith("1Q2k3")).toBe(true);
    expect(resolvePromotion(r.state, "b8", 2, true).state.fen.startsWith("1Q2k3")).toBe(true);
    expect(resolvePromotion(r.state, "b8", 3, true).state.fen.startsWith("1R2k3")).toBe(true);
    expect(resolvePromotion(r.state, "b8", 4, true).state.fen.startsWith("1B2k3")).toBe(true);
    expect(resolvePromotion(r.state, "b8", 5, true).state.fen.startsWith("1N2k3")).toBe(true);
    const low = { ...r.state, players: { ...r.state.players, black: { ...r.state.players.black, form: 3 } } };
    const wrong = resolvePromotion(low, "b8", 1, false).state;
    expect(wrong.fen.startsWith("1N2k3")).toBe(true);
    expect(wrong.players.black.form).toBe(5);
  });
});

describe("answers", () => {
  const ctx = { color: "white" as const, puskas: false, bonus: false, ms: 9000, landed: "e4" };
  it("rewards 1/2/3/5 (the same on a Hot Spot), with a quick bonus on Screamers and Puskás only", () => {
    const g = game();
    expect(applyAnswer(g, { ...ctx, difficulty: "easy", correct: true }).state.players.white.form).toBe(1);
    expect(applyAnswer(g, { ...ctx, difficulty: "medium", correct: true }).state.players.white.form).toBe(2);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", correct: true }).state.players.white.form).toBe(3);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", puskas: true, correct: true }).state.players.white.form).toBe(5);
    expect(applyAnswer(g, { ...ctx, difficulty: "medium", bonus: true, correct: true, ms: 2000 }).state.players.white.form).toBe(2);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", bonus: true, correct: true }).state.players.white.form).toBe(3);
    expect(applyAnswer(g, { ...ctx, difficulty: "easy", correct: true, ms: 2000 }).state.players.white.form).toBe(1);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", correct: true, ms: 2000 }).state.players.white.form).toBe(4);
  });
  it("catch-up: the side behind on material gets +1 for a right answer", () => {
    const behind = at("4k3/8/8/8/8/8/8/R3K3 b - - 0 1");
    const zero = (s: GameState) => ({ ...s, players: { white: { ...s.players.white, form: 0 }, black: { ...s.players.black, form: 0 } } });
    expect(material(behind.fen)).toEqual({ white: 5, black: 0 });
    expect(applyAnswer(zero(behind), { ...ctx, color: "black", difficulty: "easy", correct: true }).state.players.black.form).toBe(2);
    expect(applyAnswer(zero(behind), { ...ctx, color: "white", difficulty: "easy", correct: true }).state.players.white.form).toBe(1);
  });
  it("penalties: medium feeds the opponent, hard books the piece, Puskás sends you off", () => {
    const g = game();
    expect(applyAnswer(g, { ...ctx, difficulty: "easy", correct: false }).state.players.black.form).toBe(0);
    expect(applyAnswer(g, { ...ctx, difficulty: "medium", correct: false }).state.players.black.form).toBe(2);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", correct: false }).state.frozen).toEqual([{ square: "e4", owner: "white", reason: "booked" }]);
    expect(applyAnswer(g, { ...ctx, difficulty: "hard", puskas: true, correct: false }).state.players.white.sentOff).toBe(true);
  });
  it("hat-trick, Form cap and the four-wrong red card", () => {
    let g = game();
    for (let i = 0; i < 3; i++) g = applyAnswer(g, { ...ctx, difficulty: "easy", correct: true }).state;
    expect(g.players.white.form).toBe(5);
    for (let i = 0; i < 6; i++) g = applyAnswer(g, { ...ctx, difficulty: "hard", correct: true }).state;
    expect(g.players.white.form).toBe(12);
    for (let i = 0; i < 4; i++) g = applyAnswer(g, { ...ctx, difficulty: "easy", correct: false }).state;
    expect(g.players.white.doubleNextPower).toBe(true);
  });
  it("a booked piece can't move next turn, then is free again", () => {
    let g = at("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    let r = playMove(g, "a1a4");
    g = applyAnswer(r.state, { ...ctx, difficulty: "hard", correct: false, landed: r.landed }).state;
    g = finishTurn(g).state;
    g = move(g, "e8d8");
    expect(legalMoves(g).moves.some((m) => m.startsWith("a4"))).toBe(false);
    g = move(g, "e1e2");
    g = move(g, "d8e8");
    expect(legalMoves(g).moves.some((m) => m.startsWith("a4"))).toBe(true);
  });
  it("a freeze is lifted when nothing else is legal", () => {
    // Only the rook can block the check.
    const g = { ...at("6k1/8/8/8/8/8/5PPP/Rr4K1 w - - 0 1"), frozen: [{ square: "a1", owner: "white" as const, reason: "foul" as const }] };
    const f = legalMoves(g);
    expect(f.moves).toEqual(["a1b1"]);
    expect(f.lifted).toBe(true);
  });
});

describe("Puskás sending off", () => {
  it("skips the next turn and gives the opponent a quiet Free Kick", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    const r = playMove(g, "e2e4");
    g = applyAnswer(r.state, { color: "white", difficulty: "hard", puskas: true, bonus: false, correct: false, ms: 8000, landed: r.landed }).state;
    g = finishTurn(g).state;
    expect(turnOf(g)).toBe("black");
    g = move(g, "d7d5");
    // White's turn is skipped: Black takes a Free Kick, which can't capture.
    expect(turnOf(g)).toBe("black");
    expect(g.step).toBe("free-kick");
    expect(legalMoves(g).moves).not.toContain("d5e4");
    g = move(g, "a7a6");
    expect(turnOf(g)).toBe("white");
    expect(g.step).toBe("normal");
  });
});

describe("power-ups", () => {
  it("every power-up starts locked for its cooldown, and cooldowns count down on your moves", () => {
    let g = game();
    expect(powerBlocked(g, "tactical-foul")).toMatch(/Ready in 10/);
    g = { ...g, hotSpots: [], players: { ...g.players, white: { ...g.players.white, form: 12 } } };
    for (let i = 0; i < 5; i++) for (const m of ["g1f3", "g8f6", "f3g1", "f6g8"]) g = move(g, m);
    expect(powerBlocked(g, "tactical-foul")).toBeNull();
    const used = usePowerUp(g, "tactical-foul", ["d7"]).state;
    expect(used.players.white.form).toBe(7);
    expect(powerBlocked(used, "park-the-bus")).toMatch(/One power-up per turn/);
    // Locked for 10 of your moves after the one you used it on.
    const after = move(move(used, "e2e4"), "e7e5");
    expect(after.players.white.cooldowns["tactical-foul"]).toBe(10);
    expect(move(move(after, "d2d4"), "d7d5").players.white.cooldowns["tactical-foul"]).toBe(9);
  });
  it("Tactical Foul freezes an enemy piece for one turn, but not the king, the queen or a checking piece", () => {
    const g = at("4k3/8/8/8/8/8/8/R2rK3 w - - 0 1");
    expect(usePowerUp(g, "tactical-foul", ["e8"]).error).toBe("Not the king");
    expect(usePowerUp(g, "tactical-foul", ["d1"]).error).toMatch(/giving check/);
    expect(usePowerUp(at("4k3/3q4/8/8/8/8/8/R3K3 w - - 0 1"), "tactical-foul", ["d7"]).error).toBe("Not the queen");
    const g2 = at("4k3/3r4/8/8/8/8/8/R3K3 w - - 0 1");
    let s = usePowerUp(g2, "tactical-foul", ["d7"]).state;
    s = move(s, "a1a2");
    expect(legalMoves(s).moves.some((m) => m.startsWith("d7"))).toBe(false);
  });
  it("Park the Bus protects the back two ranks during the opponent's next turn", () => {
    const g = at("4k3/8/8/8/8/8/6q1/R3K3 w - - 0 1".replace("6q1", "q7"));
    let s = usePowerUp(g, "park-the-bus").state;
    s = move(s, "e1f1");
    expect(legalMoves(s).moves).not.toContain("a2a1");
    s = move(s, "a2a3");
    s = move(s, "f1e1");
    expect(s.parkTheBus).toBeNull();
  });
  it("VAR Review undoes your last move and the reply", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    g = move(g, "e2e4");
    g = move(g, "e7e5");
    const r = usePowerUp(g, "var-review");
    expect(r.error).toBeUndefined();
    const v = r.state;
    expect(v.fen).toBe("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    expect(v.players.white.form).toBe(6);
  });
  it("VAR Review rolls back Form, cooldowns, streaks and freezes too, but not the clocks", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1", { timed: true });
    g = { ...g, hotSpots: ["e4"], players: { ...g.players, white: { ...g.players.white, form: 6 } } };
    // White lands on a Hot Spot and banks Form, Black replies and is booked.
    const r = playMove(g, "e2e4");
    expect(r.trigger.kind).toBe("hot-spot");
    g = applyAnswer(r.state, { color: "white", difficulty: "hard", puskas: false, bonus: true, correct: true, ms: 9000, landed: r.landed }).state;
    expect(g.players.white.form).toBe(9);
    g = finishTurn(g).state;
    const r2 = playMove(g, "e7e5");
    g = applyAnswer(r2.state, { color: "black", difficulty: "hard", puskas: false, bonus: false, correct: false, ms: 9000, landed: r2.landed }).state;
    g = finishTurn(g).state;
    g = { ...g, players: { ...g.players, white: { ...g.players.white, clockMs: 1234 } } };
    expect(g.frozen).toHaveLength(1);
    const v = usePowerUp(g, "var-review").state;
    expect(v.players.white.form).toBe(0); // the 6 from before the move, minus the 6 it costs
    expect(v.players.white.rightStreak).toBe(0);
    expect(v.players.white.cooldowns["var-review"]).toBe(15);
    expect(v.players.white.clockMs).toBe(1234);
    expect(v.frozen).toEqual([]);
    expect(v.hotSpots).toEqual(["e4"]);
  });
  it("VAR Review needs its cost from the Form you had before the move", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    g = { ...g, players: { ...g.players, white: { ...g.players.white, form: 2 } } };
    g = move(g, "e2e4");
    g = move(g, "e7e5");
    g = { ...g, players: { ...g.players, white: { ...g.players.white, form: 12 } } };
    expect(powerBlocked(g, "var-review")).toMatch(/from before that move/);
  });
  it("Counter-Attack lets a pawn move two squares from anywhere, but not onto the 7th rank or past an enemy pawn", () => {
    const g = at("4k3/8/8/8/3P4/8/8/4K3 w - - 0 1");
    const s = usePowerUp(g, "counter-attack", ["d4"]).state;
    expect(legalMoves(s).moves).toContain("d4d6");
    const after = move(s, "d4d6");
    expect(after.fen.startsWith("4k3/8/3P4")).toBe(true);
    expect(usePowerUp(at("4k3/8/3P4/8/8/8/8/4K3 w - - 0 1"), "counter-attack", ["d6"]).error).toBeTruthy();
    expect(usePowerUp(at("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1"), "counter-attack", ["d5"]).error).toMatch(/7th rank/);
    // Black pawn on e5 would take en passant on d5 if the d3 pawn dashed to d5: not allowed.
    expect(usePowerUp(at("4k3/8/8/4p3/8/3P4/8/4K3 w - - 0 1"), "counter-attack", ["d3"]).error).toMatch(/enemy pawn/);
  });
  it("Substitution, Super-Sub and Red Card edit the board", () => {
    let g = at("4k3/pppp4/8/8/8/8/1PPP4/4K3 w - - 0 1");
    g = { ...g, captured: { white: ["p"], black: [] } };
    const sub = usePowerUp(g, "substitution", ["a2"]).state;
    expect(sub.fen.startsWith("4k3/pppp4/8/8/8/8/PPPP4")).toBe(true);
    expect(sub.captured.white).toEqual([]);
    const ss = usePowerUp(g, "super-sub", ["b2"]).state;
    expect(ss.fen.startsWith("4k3/pppp4/8/8/8/8/1NPP4")).toBe(true);
    expect(usePowerUp(g, "red-card", ["a7"]).state.fen.startsWith("4k3/1ppp4")).toBe(true);
    const deep = at("4k3/8/8/8/8/p7/8/4K3 w - - 0 1");
    expect(usePowerUp(deep, "red-card", ["a3"]).error).toMatch(/6th or 7th/);
  });
  it("Formation Change swaps two pieces, removes castling for a moved rook, never into check", () => {
    const g = at("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1");
    const s = usePowerUp(g, "formation-change", ["a1", "b1"]).state;
    expect(s.fen).toBe("r3k2r/8/8/8/8/8/8/NR2K2R w Kkq - 0 1");
    const checking = at("7k/8/8/8/8/8/4R3/4K2N w - - 0 1");
    expect(usePowerUp(checking, "formation-change", ["e2", "h1"]).error).toMatch(/check/);
  });
  it("Formation Change: no pawn past its 5th rank, no frozen piece, not while in check", () => {
    const g = at("4k3/1N6/8/8/8/8/P7/4K3 w - - 0 1");
    expect(usePowerUp(g, "formation-change", ["a2", "b7"]).error).toMatch(/2nd to 5th/);
    const mid = at("4k3/8/8/1N6/8/8/P7/4K3 w - - 0 1");
    expect(usePowerUp(mid, "formation-change", ["a2", "b5"]).error).toBeUndefined();
    const frozen = { ...mid, frozen: [{ square: "b5", owner: "white" as const, reason: "booked" as const }] };
    expect(usePowerUp(frozen, "formation-change", ["a2", "b5"]).error).toMatch(/frozen/);
    expect(powerBlocked(at("4k3/8/8/1N6/8/8/P7/r3K3 w - - 0 1"), "formation-change")).toMatch(/check/);
  });
  it("Golden Boot: +2 Form for each capture over your next 3 moves", () => {
    let g = at("4k3/8/8/p1p1p3/1P1P1P2/8/8/4K3 w - - 0 1");
    g = { ...g, players: { ...g.players, white: { ...g.players.white, form: 2 } } };
    g = usePowerUp(g, "golden-boot").state;
    expect(g.players.white.form).toBe(0);
    g = move(g, "b4a5");
    expect(g.players.white.form).toBe(2);
    g = move(g, "e8e7");
    g = move(g, "d4c5");
    expect(g.players.white.form).toBe(4);
    g = move(g, "e7e8");
    g = move(g, "e1e2");
    g = move(g, "e8e7");
    expect(g.players.white.goldenBootMoves).toBe(0);
    g = move(g, "f4e5");
    expect(g.players.white.form).toBe(4);
  });
  it("Extra Time: neither move can capture", () => {
    let g = at("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    g = usePowerUp(g, "extra-time").state;
    expect(legalMoves(g).moves).not.toContain("e4d5");
    expect(legalMoves(g).moves).toContain("e4e5");
    expect(powerBlocked(at("4k3/8/8/8/8/8/8/4K3 w - - 0 1"), "extra-time")).toBeNull();
  });
  it("Extra Time gives a second, quiet move", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    g = usePowerUp(g, "extra-time").state;
    g = move(g, "e2e4");
    expect(turnOf(g)).toBe("white");
    expect(g.step).toBe("extra-time");
    g = move(g, "d2d4");
    expect(turnOf(g)).toBe("black");
  });
  it("Extra Time's second move can be skipped, handing the turn back", () => {
    let g = at("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    g = usePowerUp(g, "extra-time").state;
    g = move(g, "e2e4");
    const skipped = finishTurn(skipExtraTime(g)!).state;
    expect(turnOf(skipped)).toBe("black");
    expect(skipped.step).toBe("normal");
    expect(skipped.history).toHaveLength(1);
    expect(skipExtraTime(skipped)).toBeNull();
  });
  it("Fergie Time scales with the clock and timed games start on the chosen minutes", () => {
    expect([3, 5, 10, 15, 30].map((m) => fergieMs(m) / 1000)).toEqual([20, 30, 60, 90, 180]);
    let g = at("4k3/8/8/8/8/8/8/4K3 w - - 0 1", { timed: true, minutes: 5 });
    expect(game({ timed: true, minutes: 5 }).players.white.clockMs).toBe(5 * 60_000);
    g = { ...g, players: { ...g.players, white: { ...g.players.white, clockMs: 60_000 } } };
    expect(usePowerUp(g, "fergie-time").state.players.white.clockMs).toBe(90_000);
  });
  it("timed games add 3 seconds per move, and a saved state never winds the clocks back", () => {
    const g = at("4k3/8/8/8/8/8/8/4K3 w - - 0 1", { timed: true, minutes: 5 });
    expect(addIncrement(g, "white").players.white.clockMs).toBe(5 * 60_000 + 3000);
    expect(addIncrement(at("4k3/8/8/8/8/8/8/4K3 w - - 0 1"), "white").players.white.clockMs).toBeNull();
    const live = { ...g, players: { ...g.players, white: { ...g.players.white, clockMs: 1000 } } };
    const saved = { ...g, players: { ...g.players, white: { ...g.players.white, form: 7 } } };
    const merged = withClocksFrom(saved, live);
    expect(merged.players.white.clockMs).toBe(1000);
    expect(merged.players.white.form).toBe(7);
  });
  it("no capture on the turn you use Formation Change, Tactical Foul or Super-Sub", () => {
    // White rook a1 can take the knight on a8; after swapping with the h1 bishop it could take h8.
    const g = at("n3k2n/8/8/8/8/8/1P6/R3K2B w - - 0 1");
    expect(legalMoves(g).moves).toContain("a1a8");
    for (const [id, t] of [["tactical-foul", ["e8"]], ["super-sub", ["b2"]]] as const) {
      const r = usePowerUp(g, id, [...t]);
      if (id === "tactical-foul") { expect(r.error).toBe("Not the king"); continue; }
      expect(r.error).toBeUndefined();
      expect(legalMoves(r.state).moves).not.toContain("a1a8");
    }
    const foul = usePowerUp(g, "tactical-foul", ["h8"]);
    expect(legalMoves(foul.state).moves).not.toContain("a1a8");
    const swap = usePowerUp(g, "formation-change", ["a1", "h1"]);
    expect(swap.error).toBeUndefined();
    expect(legalMoves(swap.state).moves).not.toContain("h1h8");
    expect(legalMoves(swap.state).moves).toContain("h1h7");
    // A power-up that would leave only captures is refused.
    const onlyCapture = at("4k3/8/8/8/8/7p/1r5P/K7 w - - 0 1");
    expect(legalMoves(onlyCapture).moves).toEqual(["a1b2"]);
    expect(usePowerUp(onlyCapture, "tactical-foul", ["h3"]).error).toMatch(/isn't a capture/);
  });
  it("comeback pricing: 3+ points down is 1 cheaper with faster cooldowns, 3+ up is 1 dearer", () => {
    // White has an extra rook.
    const g = at("4k3/pppp4/8/8/8/8/PPPP4/R3K3 w - - 0 1");
    expect(powerCost(g, "white", "red-card")).toBe(6);
    expect(powerCost(g, "black", "red-card")).toBe(4);
    expect(powerCost(g, "black", "assistants-flag")).toBe(1);
    const level = at("4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1");
    expect(powerCost(level, "white", "red-card")).toBe(5);
    const cd = (st: GameState) => ({ ...st, players: { white: { ...st.players.white, cooldowns: { ...st.players.white.cooldowns, "red-card": 5 } }, black: { ...st.players.black, cooldowns: { ...st.players.black.cooldowns, "red-card": 5 } } } });
    const after = move(move(cd(g), "e1f1"), "e8f8");
    expect(after.players.white.cooldowns["red-card"]).toBe(4);
    expect(after.players.black.cooldowns["red-card"]).toBe(3);
  });
  it("Scout Report can't be used when it would do nothing", () => {
    const check = at("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
    expect(powerBlocked(check, "scout-report")).toMatch(/check/);
  });
  it("red card from four wrong answers doubles the next power-up", () => {
    let g = at("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    g = { ...g, players: { ...g.players, white: { ...g.players.white, doubleNextPower: true, form: 9 } } };
    expect(powerBlocked(g, "red-card")).toMatch(/Needs 10/);
    // Cheap power-ups (under 3 Form) neither pay the double price nor clear it.
    expect(powerCost(g, "white", "assistants-flag")).toBe(1);
    const flagged = usePowerUp(g, "assistants-flag").state;
    expect(flagged.players.white.doubleNextPower).toBe(true);
    const sub = usePowerUp({ ...g, captured: { white: ["p"], black: [] } }, "substitution", ["a2"]).state;
    expect(sub.players.white.form).toBe(1);
    expect(sub.players.white.doubleNextPower).toBe(false);
  });
  it("lists valid targets", () => {
    const g = at("4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1");
    expect(powerTargets(g, "red-card").sort()).toEqual(["a7", "b7", "c7", "d7"]);
    expect(attackedSquares(g.fen, "black")).toContain("e7");
  });
});

describe("game end", () => {
  it("checkmate ends the game", () => {
    let g = game({ trivia: false });
    for (const m of ["f2f3", "e7e5", "g2g4", "d8h4"]) g = move(g, m);
    expect(g.outcome).toEqual({ kind: "checkmate", winner: "black" });
  });
  it("a draw goes to a Penalty Shootout in trivia games", () => {
    const g = at("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(finishTurn(g).state.pendingDraw).toBe("stalemate");
    expect(finishTurn({ ...g, options: { ...g.options, trivia: false } }).state.outcome).toEqual({ kind: "draw", reason: "stalemate" });
  });
});
