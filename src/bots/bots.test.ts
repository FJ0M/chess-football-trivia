import { describe, expect, it } from "vitest";
import { createBotWith } from "./bot";
import { MATE_CP, parseInfoLine, type Analyser, type EngineLine } from "./engine";
import { GOLDEN_BOOT_CAPTURE_CP, legalMoves, normaliseUci, pickMove, positionFromFen } from "./movePicker";
import { BOT_IDS, BOT_PROFILES, LADDER_IDS, triviaAccuracy } from "./profiles";
import { choosePowerUp } from "./powerUps";
import { TALK, Talker } from "./talk";
import { answerChance, answerQuestion, chooseCard } from "./trivia";
import type { CardOffer, QuestionLike } from "./types";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function seeded(seed = 1) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fake engine: returns the given lines, or ranks legal moves in a fixed order. */
function fakeEngine(lines?: EngineLine[]): Analyser & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async analyse(fen, opts) {
      calls.push(opts);
      if (lines) return lines;
      const moves = opts.searchMoves ?? legalMoves(positionFromFen(fen));
      return moves.slice(0, opts.multiPv).map((uci, i) => ({ uci, scoreCp: -i * 30, depth: opts.depth, multipv: i + 1 }));
    },
  };
}

describe("UCI parsing", () => {
  it("reads centipawn lines", () => {
    expect(parseInfoLine("info depth 10 seldepth 17 multipv 2 score cp -134 nodes 19840 pv e2e4 b7b5")).toEqual({
      uci: "e2e4",
      scoreCp: -134,
      depth: 10,
      multipv: 2,
    });
  });
  it("reads mate scores", () => {
    expect(parseInfoLine("info depth 5 multipv 1 score mate 2 pv d1h5")!.scoreCp).toBe(MATE_CP - 2);
    expect(parseInfoLine("info depth 5 multipv 1 score mate -3 pv a2a3")!.scoreCp).toBe(-MATE_CP + 3);
  });
  it("ignores other lines", () => {
    expect(parseInfoLine("info string NNUE evaluation using nn-xyz")).toBeNull();
    expect(parseInfoLine("bestmove e2e4")).toBeNull();
  });
});

describe("move picking", () => {
  it("normalises standard castling to king-to-rook", () => {
    const pos = positionFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(normaliseUci(pos, "e1g1")).toBe("e1h1");
    expect(normaliseUci(pos, "e1h1")).toBe("e1h1");
    expect(normaliseUci(pos, "e1e3")).toBeNull();
  });

  it("always plays a mate it can see, even the weakest bot", () => {
    const pos = positionFromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    const lines: EngineLine[] = [
      { uci: "a1a8", scoreCp: MATE_CP - 1, depth: 4, multipv: 1 },
      { uci: "a1a2", scoreCp: 500, depth: 4, multipv: 2 },
    ];
    const strength = BOT_PROFILES.pawny.levels.medium.chess;
    for (let s = 1; s < 50; s++) {
      const pick = pickMove({ pos, lines, allowed: legalMoves(pos), strength, style: "chaotic", rng: seeded(s) });
      expect(pick.uci).toBe("a1a8");
    }
  });

  it("only plays allowed moves (frozen pieces, Free Kick)", () => {
    const pos = positionFromFen(START);
    const lines: EngineLine[] = [
      { uci: "e2e4", scoreCp: 40, depth: 8, multipv: 1 },
      { uci: "d2d4", scoreCp: 35, depth: 8, multipv: 2 },
    ];
    for (let s = 1; s < 50; s++) {
      const pick = pickMove({ pos, lines, allowed: ["d2d4", "a2a3"], strength: BOT_PROFILES.pawny.levels.medium.chess, style: "chaotic", rng: seeded(s) });
      expect(["d2d4", "a2a3"]).toContain(pick.uci);
    }
  });

  it("takes the top line with no temperature or blunders", () => {
    const pos = positionFromFen(START);
    const lines: EngineLine[] = [
      { uci: "e2e4", scoreCp: 40, depth: 14, multipv: 1 },
      { uci: "d2d4", scoreCp: 39, depth: 14, multipv: 2 },
    ];
    for (let s = 1; s < 30; s++) {
      expect(pickMove({ pos, lines, allowed: legalMoves(pos), strength: { ...BOT_PROFILES.rookland.levels.medium.chess, temperatureCp: 0, blunderRate: 0 }, style: "positional", rng: seeded(s) }).uci).toBe("e2e4");
    }
  });

  it("chaotic Eezy grabs captures more than positional Florence", () => {
    // White can take a pawn on d5 (slightly worse per engine) or play quietly.
    const pos = positionFromFen("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    const lines: EngineLine[] = [
      { uci: "b1c3", scoreCp: 40, depth: 8, multipv: 1 },
      { uci: "e4d5", scoreCp: 20, depth: 8, multipv: 2 },
    ];
    const rate = (id: "eezy" | "knightingale") => {
      let n = 0;
      for (let s = 1; s <= 400; s++) {
        const p = BOT_PROFILES[id];
        // Same strength for both, so only the style differs.
        const strength = { ...BOT_PROFILES["mo-mate"].levels.medium.chess, blunderRate: 0 };
        if (pickMove({ pos, lines, allowed: legalMoves(pos), strength, style: p.style, rng: seeded(s) }).uci === "e4d5") n++;
      }
      return n / 400;
    };
    expect(rate("eezy")).toBeGreaterThan(0.5);
    expect(rate("knightingale")).toBeLessThan(rate("eezy") - 0.15);
  });
});

describe("bot.chooseMove", () => {
  it("passes restricted moves to the engine as searchmoves", async () => {
    const engine = fakeEngine();
    const bot = createBotWith("mo-mate", "medium", engine, seeded(3));
    const res = await bot.chooseMove({ fen: START, allowedMoves: ["g1f3", "b1c3"] });
    expect(["g1f3", "b1c3"]).toContain(res.uci);
    expect((engine.calls[0] as { searchMoves: string[] }).searchMoves).toEqual(["g1f3", "b1c3"]);
  });

  it("returns 960 castling as king-to-rook", async () => {
    // Chess960: king b1, rook a1; castling queenside is the only legal-and-offered move.
    const fen = "rk6/8/8/8/8/8/8/RK6 w Aa - 0 1";
    const engine = fakeEngine([{ uci: "b1a1", scoreCp: 0, depth: 6, multipv: 1 }]);
    const bot = createBotWith("rookland", "medium", engine, seeded(1));
    const res = await bot.chooseMove({ fen, chess960: true });
    expect(res.uci).toBe("b1a1");
  });

  it("skips the engine when only one move is allowed", async () => {
    const engine = fakeEngine();
    const bot = createBotWith("pawny", "medium", engine, seeded(1));
    expect((await bot.chooseMove({ fen: START, allowedMoves: ["a2a3"] })).uci).toBe("a2a3");
    expect(engine.calls).toHaveLength(0);
  });
});

describe("trivia", () => {
  const q = (difficulty: QuestionLike["difficulty"], club: string | null = null): QuestionLike => ({
    options: ["a", "b", "c", "d"],
    answer: 2,
    difficulty,
    club,
  });

  function rate(id: (typeof LADDER_IDS)[number], question: QuestionLike, puskas = false) {
    const p = BOT_PROFILES[id];
    const rng = seeded(7);
    let right = 0;
    for (let i = 0; i < 4000; i++) if (answerQuestion(p, p.levels.medium.trivia, { question, puskas }, rng).choice === question.answer) right++;
    return right / 4000;
  }

  it("answers about as often as its profile says", () => {
    for (const id of LADDER_IDS) {
      const avg = (rate(id, q("easy")) + rate(id, q("medium")) + rate(id, q("hard"))) / 3;
      expect(Math.abs(avg - triviaAccuracy(BOT_PROFILES[id].levels.medium.trivia))).toBeLessThan(0.03);
    }
  });

  it("knows its own club best", () => {
    const p = BOT_PROFILES["mo-mate"];
    expect(answerChance(p, p.levels.medium.trivia, { question: q("hard", p.club) })).toBeGreaterThan(answerChance(p, p.levels.medium.trivia, { question: q("hard") }));
  });

  it("answers inside the timer, and faster on a Puskás", () => {
    const p = BOT_PROFILES.rookland;
    const rng = seeded(2);
    for (let i = 0; i < 200; i++) {
      expect(answerQuestion(p, p.levels.medium.trivia, { question: q("hard") }, rng).delayMs).toBeLessThan(10000);
      expect(answerQuestion(p, p.levels.medium.trivia, { question: q("hard"), puskas: true }, rng).delayMs).toBeLessThan(8000);
    }
  });

  const deal: CardOffer[] = [
    { topic: "Managers", difficulty: "easy", club: null },
    { topic: "Transfers", difficulty: "medium", club: null },
    { topic: "West Ham players", difficulty: "hard", club: "west-ham" },
  ];

  it("Eezy mostly goes Hard, Ragnar mostly goes Easy", () => {
    const general: CardOffer[] = deal.map((c) => ({ ...c, club: null }));
    const share = (id: "eezy" | "rookland", diff: number) => {
      const p = BOT_PROFILES[id];
      const rng = seeded(6);
      let n = 0;
      for (let i = 0; i < 1000; i++) if (chooseCard(p, p.levels.medium.trivia, { cards: general, puskasAllowed: true, form: 0 }, rng).index === diff) n++;
      return n / 1000;
    };
    expect(share("eezy", 2)).toBeGreaterThan(0.5);
    expect(share("rookland", 0)).toBeGreaterThan(0.5);
  });
});

describe("power-ups", () => {
  const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const always = () => 0;

  it("fouls the most valuable enemy piece it's allowed to (not the queen)", () => {
    const pick = choosePowerUp(BOT_PROFILES.chillwall, { fen, form: 5, available: [{ id: "tactical-foul", cost: 5 }] }, always, 0);
    expect(pick?.id).toBe("tactical-foul");
    expect(["a8", "h8"]).toContain(pick?.target);
  });

  it("Red Card never targets a pawn on its 6th or 7th rank", () => {
    // Black pawns on a3 (black's 6th rank) and h5 (black's 4th).
    const f = "4k3/8/8/7p/8/p7/8/4K3 w - - 0 1";
    const pick = choosePowerUp(BOT_PROFILES.chillwall, { fen: f, form: 9, available: [{ id: "red-card", cost: 7 }] }, always, 0);
    expect(pick).toEqual({ id: "red-card", target: "h5" });
  });

  it("uses VAR Review after a blunder", () => {
    const pick = choosePowerUp(BOT_PROFILES.eezy, { fen, form: 3, available: [{ id: "var-review", cost: 3 }] }, () => 0.99, 400);
    expect(pick).toEqual({ id: "var-review" });
  });

  it("Ragnar saves up instead of buying small things", () => {
    const req = { fen, form: 9, available: [{ id: "red-card", cost: 4 }] };
    expect(choosePowerUp(BOT_PROFILES.rookland, req, always, 0)).toBeNull();
    expect(choosePowerUp(BOT_PROFILES.rookland, { ...req, form: 12 }, always, 0)?.id).toBe("red-card");
    expect(choosePowerUp(BOT_PROFILES.rookland, { fen, form: 8, available: [{ id: "extra-time", cost: 8 }] }, always, 0)).toEqual({ id: "extra-time" });
  });

  it("buys nothing while in check (except VAR after a blunder)", () => {
    expect(choosePowerUp(BOT_PROFILES.chillwall, { fen, form: 9, inCheck: true, available: [{ id: "tactical-foul", cost: 3 }] }, always, 0)).toBeNull();
  });
});

describe("trash talk", () => {
  it("has at least one line for every bot and moment", () => {
    for (const id of BOT_IDS) for (const lines of Object.values(TALK[id])) expect(lines.length).toBeGreaterThan(0);
  });

  it("speaks at most once every two bot moves, but always at the start", () => {
    const t = new Talker("mo-mate", "Liverpool", () => 0.9);
    expect(t.say("start")).toBeTruthy();
    expect(t.say("capture")).toBeNull();
    t.tickMove();
    expect(t.say("capture")).toBeNull();
    t.tickMove();
    expect(t.say("capture")).toBeTruthy();
  });

  it("fills in the club name", () => {
    const t = new Talker("mo-mate", "Liverpool", () => 0.5);
    for (let i = 0; i < 6; i++) expect(t.say("hotSpot")).not.toContain("{club}");
  });
});

describe("promotion", () => {
  it("aims for the piece its profile says", () => {
    const e = fakeEngine();
    for (const id of LADDER_IDS) expect(createBotWith(id, "medium", e).promotionPick()).toBe(BOT_PROFILES[id].promotionAim?.medium ?? "r");
  });
});

describe("ratings", () => {
  it("keeps chess as the main part of the match rating", async () => {
    const { matchRating } = await import("./profiles");
    // 2500 chess with no football knowledge beats perfect trivia with 600 chess.
    expect(matchRating(2500, 800)).toBeGreaterThan(matchRating(600, 2200));
  });
});

describe("the Elo ladder", () => {
  it("has one bot at each of 400 to 1600 chess Elo, each with a single level", () => {
    expect(LADDER_IDS.map((id) => BOT_PROFILES[id].levels.medium.chess.rating)).toEqual([400, 600, 800, 1000, 1200, 1400, 1600]);
    for (const id of LADDER_IDS) {
      const p = BOT_PROFILES[id];
      expect(p.fixedLevel).toBe(true);
      expect(p.levels.low).toEqual(p.levels.medium);
      expect(p.levels.hard).toEqual(p.levels.medium);
    }
    expect(BOT_IDS).toEqual(LADDER_IDS);
  });

  it("answers inside the 10-second question timer", () => {
    for (const id of LADDER_IDS) expect(BOT_PROFILES[id].levels.medium.trivia.answerMs[1]).toBeLessThanOrEqual(8000);
  });

  it("gets more patient at chess as the Elo goes up", () => {
    const blunders = LADDER_IDS.map((id) => BOT_PROFILES[id].levels.medium.chess.blunderRate);
    for (let i = 1; i < blunders.length; i++) expect(blunders[i]).toBeLessThanOrEqual(blunders[i - 1]);
  });
});

describe("the game around the chess", () => {
  const pos = positionFromFen(START);
  const lines = [
    { uci: "e2e4", scoreCp: 30, depth: 8, multipv: 1 },
    { uci: "d2d4", scoreCp: 25, depth: 8, multipv: 2 },
  ];
  const strength = { rating: 1200, depth: 6, multiPv: 2, temperatureCp: 30, blunderRate: 0 };

  it("steers towards a Hot Spot when the bot rates them", () => {
    let spot = 0;
    const rng = seeded(4);
    for (let i = 0; i < 200; i++) {
      const pick = pickMove({ pos, lines, allowed: legalMoves(pos), strength, style: "balanced", rng, hotSpots: ["d4"], hotSpotCp: 60 });
      if (pick.uci === "d2d4") spot++;
    }
    expect(spot).toBeGreaterThan(150);
  });

  it("ignores Hot Spots when it isn't chasing them", () => {
    let spot = 0;
    const rng = seeded(4);
    for (let i = 0; i < 200; i++) if (pickMove({ pos, lines, allowed: legalMoves(pos), strength, style: "balanced", rng, hotSpots: ["d4"] }).uci === "d2d4") spot++;
    expect(spot).toBeLessThan(130);
  });

  it("likes captures more while Golden Boot runs", () => {
    expect(GOLDEN_BOOT_CAPTURE_CP).toBeGreaterThan(0);
    const f = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    const p = positionFromFen(f);
    const l = [
      { uci: "b1c3", scoreCp: 40, depth: 8, multipv: 1 },
      { uci: "e4d5", scoreCp: 30, depth: 8, multipv: 2 },
    ];
    const count = (goldenBoot: boolean) => {
      const rng = seeded(9);
      let n = 0;
      for (let i = 0; i < 200; i++) if (pickMove({ pos: p, lines: l, allowed: legalMoves(p), strength, style: "positional", rng, goldenBoot }).uci === "e4d5") n++;
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false) + 50);
  });

  it("only buys Golden Boot with a capture on (it costs 2 and pays 2 a capture)", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const req = { fen, form: 6, available: [{ id: "golden-boot", cost: 2 }] };
    expect(choosePowerUp(BOT_PROFILES.eezy, req, () => 0, 0)).toBeNull();
    expect(choosePowerUp(BOT_PROFILES.eezy, req, () => 0, 0, { bestIsCapture: true })).toEqual({ id: "golden-boot" });
  });

  it("looks at the position before a power-up, so Park the Bus fires when it's losing (bug 10)", async () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const losing = fakeEngine([{ uci: "b1c3", scoreCp: -400, depth: 8, multipv: 1 }]);
    const level = fakeEngine([{ uci: "b1c3", scoreCp: 20, depth: 8, multipv: 1 }]);
    const req = { fen, form: 6, available: [{ id: "park-the-bus", cost: 2 }] };
    expect(await createBotWith("chillwall", "medium", losing, () => 0).choosePowerUp(req)).toEqual({ id: "park-the-bus" });
    expect(await createBotWith("chillwall", "medium", level, () => 0).choosePowerUp(req)).toBeNull();
  });
});

describe("human-like mistakes", () => {
  it("never picks the best move, prefers the engine's worse lines and rarely walks the king", async () => {
    const { humanMistake, positionFromFen: pf, legalMoves: lm } = await import("./movePicker");
    const pos = pf("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
    const allowed = lm(pos);
    const lines = [{ uci: "f1b5", scoreCp: 40 }, { uci: "d2d4", scoreCp: 35 }, { uci: "f3g5", scoreCp: -60 }];
    let kingWalks = 0, fromLines = 0;
    for (let s = 1; s <= 400; s++) {
      const ctx = { pos, lines: [], allowed, strength: BOT_PROFILES.pawny.levels.medium.chess, style: "chaotic" as const, rng: seeded(s) };
      const u = humanMistake(ctx, lines, "f1b5", 40);
      expect(u).not.toBe("f1b5");
      if (u === "e1e2") kingWalks++;
      if (u === "f3g5") fromLines++;
    }
    expect(fromLines).toBeGreaterThan(200);
    expect(kingWalks).toBeLessThan(10);
  });
});
