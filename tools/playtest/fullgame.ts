// Full-game playtest: chess plus trivia, Form, penalties and power-ups, using
// a simplified copy of the rules in docs/game-design.md. The real rules live in
// the game code; this exists to measure how much trivia skill is worth
// compared with chess skill.
//
//   npx vite-node tools/playtest/fullgame.ts -- <config.json> <out.json>
//
// config: { "pairs": [[a, b], ...], "games": 10, "seed": 1 }
// A player is "<bot>-<level>" (that bot, chess and trivia), or
// "<chess>+<trivia>" where <chess> is "<bot>-<level>" or "sf-<elo>" and
// <trivia> is "<bot>-<level>" or "acc-<percent>" (a flat trivia player who
// gets that share of medium questions right).

import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import type { Color, Square } from "chessops/types";
import { opposite, parseSquare, parseUci, squareRank } from "chessops/util";
import { createBotWith, type Bot } from "../../src/bots/bot";
import type { UciEngine } from "../../src/bots/engine";
import { legalMoves, moveFeatures, normaliseUci } from "../../src/bots/movePicker";
import { BOT_PROFILES } from "../../src/bots/profiles";
import type { BotId, BotLevel, BotProfile, Difficulty, PowerUpId, TriviaSkill } from "../../src/bots/types";
import { chess960Fen, mulberry32, nodeEngine, type GameResult } from "./match";

const STANDARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Costs from the design doc; cooldowns in own moves (start locked).
const POWER_UPS: Record<string, { cost: number; cooldown: number }> = {
  "tactical-foul": { cost: 3, cooldown: 6 },
  "var-review": { cost: 3, cooldown: 8 },
  "golden-boot": { cost: 5, cooldown: 6 },
  "managers-tip": { cost: 2, cooldown: 8 },
  "super-sub": { cost: 6, cooldown: 12 },
  "red-card": { cost: 7, cooldown: 12 },
  "extra-time": { cost: 8, cooldown: 16 },
};
const REWARD: Record<Difficulty | "worldie", number> = { easy: 1, medium: 2, hard: 4, worldie: 6 };
const FORM_CAP = 12;

export function triviaFromAccuracy(a: number): TriviaSkill {
  const c = (x: number) => Math.min(0.99, Math.max(0.01, x));
  return {
    accuracy: { easy: c(a + 0.2), medium: c(a), hard: c(a - 0.2), worldie: c(a - 0.3) },
    ownClubAccuracy: c(a + 0.1),
    answerMs: [3000, 9000],
    // Sensible play: go harder when you're good at it.
    cardWeights: a >= 0.75 ? { easy: 1, medium: 3, hard: 6 } : a >= 0.5 ? { easy: 2, medium: 6, hard: 2 } : { easy: 7, medium: 3, hard: 0 },
    worldieRate: a >= 0.85 ? 0.4 : 0,
  };
}

interface FullPlayer {
  name: string;
  bot: Bot;
  /** Stockfish fixed-Elo chess, or null to use the bot's own chess. */
  sf: UciEngine | null;
  engine: UciEngine;
  club: string;
}

async function makeFullPlayer(name: string, seed: number): Promise<FullPlayer> {
  const [chessSpec, triviaSpec = chessSpec] = name.split("+");
  const engine = nodeEngine();
  let sf: UciEngine | null = null;
  let base: BotProfile;
  let level: BotLevel = "medium";
  let id: BotId = "ryan";
  if (chessSpec.startsWith("sf-")) {
    sf = nodeEngine();
    await sf.setOption("UCI_LimitStrength", true);
    await sf.setOption("UCI_Elo", Number(chessSpec.slice(3)));
    base = BOT_PROFILES.ryan;
  } else {
    [id, level] = chessSpec.split("-") as [BotId, BotLevel];
    base = BOT_PROFILES[id];
  }
  let trivia: TriviaSkill;
  if (triviaSpec.startsWith("acc-")) trivia = triviaFromAccuracy(Number(triviaSpec.slice(4)) / 100);
  else {
    const [tid, tl] = triviaSpec.split("-") as [BotId, BotLevel];
    trivia = BOT_PROFILES[tid].levels[tl].trivia;
  }
  const profile: BotProfile = {
    ...base,
    // A neutral spender for custom players; real bots keep their own habits.
    ...(name.includes("+") ? { favouritePowerUps: ["tactical-foul", "red-card", "golden-boot", "super-sub", "extra-time", "managers-tip"], saveFor: undefined } : {}),
    club: "test-club",
    levels: { ...base.levels, [level]: { chess: base.levels[level].chess, trivia } },
  };
  const bot = createBotWith(id, level, engine, mulberry32(seed), profile);
  return { name, bot, sf, engine, club: "test-club" };
}

interface Side {
  form: number;
  sinceQuestion: number;
  streak: number;
  cooldown: Record<string, number>;
  frozen: Square | null;
  goldenBoot: boolean;
  skipNext: boolean;
  lastEval: number;
  stats: { questions: number; right: number; formEarned: number; powerUps: Record<string, number> };
}

const newSide = (): Side => ({
  form: 0,
  sinceQuestion: 0,
  streak: 0,
  cooldown: Object.fromEntries(Object.entries(POWER_UPS).map(([k, v]) => [k, v.cooldown])),
  frozen: null,
  goldenBoot: false,
  skipNext: false,
  lastEval: 0,
  stats: { questions: 0, right: 0, formEarned: 0, powerUps: {} },
});

const relRank = (sq: Square, color: Color) => (color === "white" ? squareRank(sq) : 7 - squareRank(sq));

let lastFen = "";

export interface FullResult extends GameResult {
  stats: { white: Side["stats"]; black: Side["stats"] };
}

export async function playFullGame(white: FullPlayer, black: FullPlayer, startFen: string, rng: () => number, judge: UciEngine): Promise<FullResult> {
  let pos = Chess.fromSetup(parseFen(startFen).unwrap()).unwrap();
  const sides: Record<Color, Side> = { white: newSide(), black: newSide() };
  const players: Record<Color, FullPlayer> = { white, black };
  const history: Chess[] = [];
  const moves: string[] = [];
  const seen = new Map<string, number>();
  for (const p of [white, black]) await p.engine.newGame();

  // Hot Spots: two squares on ranks 3-4 and two on ranks 5-6.
  const randSq = (ranks: number[]) => {
    for (;;) {
      const sq = (ranks[Math.floor(rng() * ranks.length)] << 3) | Math.floor(rng() * 8);
      if (!pos.board.occupied.has(sq)) return sq;
    }
  };
  const hot = new Set<Square>();
  while (hot.size < 2) hot.add(randSq([2, 3]));
  while (hot.size < 4) hot.add(randSq([4, 5]));

  const award = (s: Side, n: number) => {
    const before = s.form;
    s.form = Math.min(FORM_CAP, s.form + n);
    s.stats.formEarned += s.form - before;
  };

  const shootout = (): number => {
    for (let round = 0; round < 15; round++) {
      let w = 0;
      let b = 0;
      const kicks = round === 0 ? 5 : 1;
      for (let k = 0; k < kicks; k++) {
        for (const c of ["white", "black"] as Color[]) {
          const q = { options: ["a", "b", "c", "d"], answer: 0, difficulty: "medium" as Difficulty, club: null };
          const r = players[c].bot.answer({ question: q });
          if (r.choice === 0 && r.delayMs <= 15000) c === "white" ? w++ : b++;
        }
      }
      if (w !== b) return w > b ? 1 : 0;
    }
    return 0.5;
  };

  const base = { white: white.name, black: black.name, chess960: startFen !== STANDARD, start: startFen };
  const done = (score: number, reason: string): FullResult => ({
    ...base,
    score,
    reason,
    plies: moves.length,
    moves,
    stats: { white: sides.white.stats, black: sides.black.stats },
  });

  const allowedFor = (c: Color, freeKick: boolean): string[] => {
    const side = sides[c];
    let legal = legalMoves(pos);
    if (side.frozen !== null && !pos.isCheck()) {
      const unfrozen = legal.filter((u) => parseSquare(u.slice(0, 2)) !== side.frozen);
      if (unfrozen.length) legal = unfrozen;
    }
    if (freeKick) {
      const quiet = legal.filter((u) => {
        const f = moveFeatures(pos, u);
        return !f.capture && !f.check;
      });
      if (quiet.length) legal = quiet;
    }
    return legal;
  };

  const chessMove = async (c: Color, allowed: string[], tip: boolean): Promise<string> => {
    const p = players[c];
    const fen = makeFen(pos.toSetup());
    lastFen = `${fen} | ${p.name} | ${allowed.join(" ")}`;
    if (p.sf && !tip) {
      const m = await p.sf.go(fen, `movetime 300${allowed.length < legalMoves(pos).length ? ` searchmoves ${allowed.join(" ")}` : ""}`);
      const n = m ? normaliseUci(pos, m) : null;
      if (n && allowed.includes(n)) return n;
      return allowed[Math.floor(rng() * allowed.length)];
    }
    const r = await p.bot.chooseMove({ fen, allowedMoves: allowed, managersTip: tip });
    sides[c].lastEval = r.evalCp;
    return r.uci;
  };

  const play = (uci: string) => {
    history.push(pos.clone());
    pos.play(parseUci(uci)!);
    moves.push(uci);
  };

  const ask = (c: Color, movedTo: Square, bonus: boolean) => {
    const side = sides[c];
    const p = players[c];
    const other = sides[opposite(c)];
    const diffs: Difficulty[] = ["easy", "medium", "hard"];
    const clubCard = bonus ? -1 : rng() < 1 / 3 ? Math.floor(rng() * 3) : -2;
    const cards = diffs.map((d, i) => ({ topic: "x", difficulty: d, club: bonus || i === clubCard ? p.club : null }));
    const pick = p.bot.chooseCard({ cards, worldieAllowed: true, form: side.form, bonusRound: bonus, evalCp: side.lastEval });
    const card = cards[pick.index];
    const question = { options: ["a", "b", "c", "d"], answer: 0, difficulty: card.difficulty, club: card.club };
    const ans = p.bot.answer({ question, worldie: pick.worldie });
    const timer = pick.worldie ? 8000 : 15000;
    const right = ans.choice === 0 && ans.delayMs <= timer;
    side.stats.questions++;
    side.sinceQuestion = 0;
    if (right) {
      side.stats.right++;
      side.streak++;
      let n = REWARD[pick.worldie ? "worldie" : card.difficulty] * (bonus ? 2 : 1);
      if (ans.delayMs < 5000) n++;
      if (side.streak % 3 === 0) n += 3;
      award(side, n);
    } else {
      side.streak = 0;
      if (pick.worldie) side.skipNext = true;
      else if (card.difficulty === "hard") side.frozen = movedTo;
      else if (card.difficulty === "medium") award(other, 2);
    }
  };

  let freeKick = false;
  for (;;) {
    const fen = makeFen(pos.toSetup());
    const key = fen.split(" ").slice(0, 4).join(" ");
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (pos.isCheckmate()) return done(pos.turn === "white" ? 0 : 1, "mate");
    if (pos.isStalemate() || pos.isInsufficientMaterial() || pos.halfmoves >= 100 || seen.get(key)! >= 3) return done(shootout(), "shootout");
    if (moves.length >= 240) {
      const lines = await judge.analyse(fen, { depth: 12, multiPv: 1 });
      const s = (lines[0]?.scoreCp ?? 0) * (pos.turn === "white" ? 1 : -1);
      return done(s > 300 ? 1 : s < -300 ? 0 : 0.5, "adjudicated");
    }

    const c = pos.turn;
    const side = sides[c];
    const opp = sides[opposite(c)];
    const frozenThisTurn = side.frozen;
    let tip = false;
    let extraTime = false;

    // Power-up before the move (not on a Free Kick).
    if (!freeKick) {
      for (const k of Object.keys(side.cooldown)) side.cooldown[k]--;
      const available = Object.entries(POWER_UPS)
        .filter(([id, v]) => v.cost <= side.form && side.cooldown[id] <= 0)
        .map(([id, v]) => ({ id: id as PowerUpId, cost: v.cost }));
      const choice = players[c].bot.choosePowerUp({ fen, form: side.form, available, inCheck: pos.isCheck(), evalCp: side.lastEval });
      if (choice && POWER_UPS[choice.id]) {
        let used = true;
        const t = choice.target ? parseSquare(choice.target) : undefined;
        switch (choice.id) {
          case "tactical-foul":
            if (t === undefined || pos.board.get(t)?.color !== opposite(c) || pos.board.get(t)?.role === "king") used = false;
            else opp.frozen = t;
            break;
          case "red-card":
          case "super-sub": {
            const owner = choice.id === "red-card" ? opposite(c) : c;
            const piece = t === undefined ? undefined : pos.board.get(t);
            if (t === undefined || piece?.role !== "pawn" || piece.color !== owner || relRank(t, owner) >= (choice.id === "red-card" ? 5 : 6)) {
              used = false;
              break;
            }
            const setup = pos.toSetup();
            if (choice.id === "red-card") setup.board.take(t);
            else setup.board.set(t, { role: "knight", color: c });
            const next = Chess.fromSetup(setup);
            if (next.isErr || next.unwrap().isEnd()) used = false;
            else pos = next.unwrap();
            break;
          }
          case "var-review":
            if (history.length >= 2) {
              pos = history[history.length - 2];
              history.length -= 2;
              moves.length -= 2;
            } else used = false;
            break;
          case "managers-tip":
            tip = true;
            break;
          case "golden-boot":
            side.goldenBoot = true;
            break;
          case "extra-time":
            extraTime = true;
            break;
        }
        if (used) {
          side.form -= POWER_UPS[choice.id].cost;
          side.cooldown[choice.id] = POWER_UPS[choice.id].cooldown;
          side.stats.powerUps[choice.id] = (side.stats.powerUps[choice.id] ?? 0) + 1;
          if (pos.isEnd()) continue;
        }
      }
    }

    const allowed = allowedFor(c, freeKick);
    if (allowed.length === 0) {
      // Rules filters can't leave no move (they fall back), so this is mate/stalemate; loop handles it.
      continue;
    }
    const uci = await chessMove(c, allowed, tip);
    const f = moveFeatures(pos, uci);
    const to = parseSquare(uci.slice(2, 4))!;
    play(uci);
    if (frozenThisTurn !== null && side.frozen === frozenThisTurn) side.frozen = null;
    side.sinceQuestion++;

    if (f.capture && side.goldenBoot) {
      award(side, 3);
      side.goldenBoot = false;
    }
    if (!freeKick && !pos.isEnd()) {
      if (hot.has(to)) {
        ask(c, to, true);
        hot.delete(to);
        hot.add(randSq([2, 3, 4, 5]));
      } else if (f.capture || side.sinceQuestion >= 3) ask(c, to, false);
    }

    if (extraTime && !pos.isEnd() && !pos.isCheck()) {
      // Second move straight away: no capture or check.
      const back = withTurn(pos, c);
      if (back) {
        pos = back;
        const second = allowedFor(c, true);
        if (second.length) play(await chessMove(c, second, false));
        const fwd = withTurn(pos, opposite(c));
        if (fwd) pos = fwd;
      }
    }

    // Sent off: after this normal move, the sent-off side loses its turn and
    // this side takes a Free Kick (cancelled if the sent-off side is in check).
    const wasFreeKick = freeKick;
    freeKick = false;
    if (!wasFreeKick && opp.skipNext && !pos.isEnd()) {
      opp.skipNext = false;
      if (!pos.isCheck()) {
        const fk = withTurn(pos, c);
        if (fk && legalMoves(fk).length) {
          pos = fk;
          freeKick = true;
        }
      }
    }
  }
}

/** Same position with a different side to move, or null if that would be illegal. */
function withTurn(pos: Chess, color: Color): Chess | null {
  const setup = pos.toSetup();
  setup.turn = color;
  setup.epSquare = undefined;
  const next = Chess.fromSetup(setup);
  return next.isOk ? next.value : null;
}

process.on("unhandledRejection", (e) => {
  console.log(`UNHANDLED ${(e as Error)?.message} at ${lastFen}`);
});

async function main() {
  const [configPath, outPath] = process.argv.slice(2).filter((x) => x !== "--");
  const cfg = JSON.parse(readFileSync(configPath, "utf8")) as { pairs: [string, string][]; games: number; seed: number };
  const rng = mulberry32(cfg.seed);
  const judge = nodeEngine();
  const results: FullResult[] = [];
  for (const [a, b] of cfg.pairs) {
    let pa = await makeFullPlayer(a, Math.floor(rng() * 1e9));
    let pb = await makeFullPlayer(b, Math.floor(rng() * 1e9));
    for (let g = 0; g < cfg.games; g++) {
      const round = Math.floor(g / 2);
      const r2 = mulberry32(cfg.seed * 7919 + round * 104729 + a.length * 31 + b.length);
      const start = round % 2 === 1 ? chess960Fen(r2) : STANDARD;
      const [w, bl] = g % 2 === 0 ? [pa, pb] : [pb, pa];
      let res: FullResult;
      try {
        res = await playFullGame(w, bl, start, r2, judge);
      } catch (e) {
        console.log(`ERROR ${(e as Error).message} at ${lastFen}`);
        for (const p of [pa, pb]) {
          p.engine.close();
          p.sf?.close();
        }
        pa = await makeFullPlayer(a, Math.floor(rng() * 1e9));
        pb = await makeFullPlayer(b, Math.floor(rng() * 1e9));
        continue;
      }
      results.push(res);
      writeFileSync(outPath, JSON.stringify(results));
      const st = res.stats;
      console.log(
        `${res.white} vs ${res.black}: ${res.score} (${res.reason}, ${res.plies} plies) Q ${st.white.right}/${st.white.questions} v ${st.black.right}/${st.black.questions} PU ${JSON.stringify(st.white.powerUps)} ${JSON.stringify(st.black.powerUps)}`,
      );
    }
    for (const p of [pa, pb]) {
      p.engine.close();
      p.sf?.close();
    }
  }
  judge.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
