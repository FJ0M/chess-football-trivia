// The game loop for the UI: whose turn it is, which panel is showing (cards,
// question, "Who am I?", result, shootout), the bots, the clocks and the sounds.
// The rules themselves are in rules.ts; this file only sequences them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { opposite } from "chessops/util";
import type { SfxName } from "../audio/sfx";
import { botList, importWithRetry, loadBots, type BotLike, type BotLevel, type BotMeta, type BotModule, type TalkMoment } from "./bots";
import { botPowerOptions } from "./botPowers";
import { POWER_UP_BY_ID, POWER_UPS } from "./powerups";
import {
  PROMOTION_AIM, addIncrement, earnedPiece, safePromotion, applyAnswer, attackedSquares, withClocksFrom, finishTurn, flipTurn, legalMoves, newGame, playMove, powerBlocked, powerCost,
  resign as resignRule, resolveMove, resolvePromotion, setClock, skipExtraTime, timeout, turnOf, usePowerUp, endInDraw,
  type MoveResult, type PlayerInit,
} from "./rules";
import { QuestionBank, TIMER_MS, browserSeenStore, memorySeenStore } from "./trivia";
import { CLUE_MS, WhoAmIBank, type WhoAmI } from "./whoami";
import { RESULT_MS, RESULT_MS_HUMAN } from "./match";
import { DRAW_WORDS } from "./history";
import {
  EBK_RUN, cardLabel, clockOwner, positionCheck, shootoutWinner, targetPrompt, type GameEvent, type NewEvent, type Overlay, type Phase,
} from "./match";
import { loadClub, loadGeneral } from "virtual:questions";
import type { Color, GameOptions, GameState, PowerUpId, PromoRole, Question } from "./types";

export interface SetupChoice {
  options: GameOptions;
  players: Record<Color, PlayerInit>;
  botLevel: BotLevel;
  /** A league season match: which one, so the result is recorded against it (see season.ts). */
  season?: { key: string; kind: "league" | "cup" };
}

interface Banks {
  bank: QuestionBank;
  whoami: WhoAmIBank;
}
/** Each side draws from its own banks, so each human player has their own "seen" list. */
type Data = Record<Color, Banks>;

let rawPromise: Promise<{ general: Question[]; sets: WhoAmI[] }> | null = null;
const clubPromises = new Map<string, Promise<Question[]>>();
/** One club's questions, downloaded on first use (the bank is split per club, see vite.config.ts). */
function clubQuestions(club: string | null): Promise<Question[]> {
  if (!club) return Promise.resolve([]);
  let p = clubPromises.get(club);
  if (!p) {
    p = importWithRetry(() => loadClub(club));
    clubPromises.set(club, p);
    p.catch(() => clubPromises.delete(club));
  }
  return p;
}
function loadData(players: SetupChoice["players"]): Promise<Data> {
  if (!rawPromise) {
    rawPromise = importWithRetry(() => Promise.all([loadGeneral(), import("../../data/whoami.json")])).then(([general, w]) => ({
      general,
      sets: (w.default as { sets: WhoAmI[] }).sets,
    }));
    // Don't remember a failed download: the next game (or retry) tries again.
    rawPromise.catch(() => { rawPromise = null; });
  }
  const clubs = [...new Set([players.white.club, players.black.club])];
  return Promise.all([rawPromise, ...clubs.map(clubQuestions)]).then(([{ general, sets }, ...clubSets]) => {
    const questions = [...general, ...clubSets.flat()];
    const banks = (c: Color): Banks => {
      const p = players[c];
      // Bots don't need to remember what they've been asked between games.
      const seen = p.kind === "human" ? browserSeenStore(p.name) : memorySeenStore();
      return { bank: new QuestionBank(questions, seen), whoami: new WhoAmIBank(sets, seen) };
    };
    return { white: banks("white"), black: banks("black") };
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGame(setup: SetupChoice, play: (s: SfxName) => void, paused = false, resume?: GameState) {
  const [game, setGameState] = useState<GameState>(() => {
    // A saved match picks up where it was (the position after the last finished turn).
    if (resume) return { ...resume, step: resume.step ?? "normal" };
    const g = newGame(setup.options, setup.players);
    // Dev only: ?fen=... starts from a position, ?form=12 unlocks everything (for testing).
    if (import.meta.env.DEV) {
      const q = new URLSearchParams(location.search);
      const fen = q.get("fen");
      const form = Number(q.get("form") ?? NaN);
      let out = fen ? { ...g, fen, repetition: {} } : g;
      if (Number.isFinite(form)) {
        const ready = (p: GameState["players"]["white"]) => ({ ...p, form, cooldowns: Object.fromEntries(Object.keys(p.cooldowns).map((k) => [k, 0])) as typeof p.cooldowns });
        out = { ...out, players: { white: ready(out.players.white), black: ready(out.players.black) } };
      }
      return out;
    }
    return g;
  });
  const [phase, setPhase] = useState<Phase>({ kind: "move" });
  const [note, setNote] = useState(resume ? "Welcome back! The match carries on where you left it" : "Kick-off! White to move");
  const [bubble, setBubble] = useState<{ color: Color; text: string } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({});
  const [data, setData] = useState<Data | null>(null);
  const [mod, setMod] = useState<BotModule | null>(null);
  const [now, setNow] = useState(Date.now());
  const [events, setEvents] = useState<GameEvent[]>([]);
  const eventId = useRef(0);
  /** Keeps the last few seconds of events. */
  const emit = useCallback((e: NewEvent) => {
    const at = Date.now();
    setEvents((cur) => [...cur.filter((x) => at - x.at < 6000), { ...e, id: ++eventId.current, at } as GameEvent]);
  }, []);
  /** Right answers in a row for each side (unlike rightStreak, this doesn't reset at a hat-trick), and who has earned Elite Ball Knowledge. */
  const runs = useRef<Record<Color, number>>({ white: 0, black: 0 });
  const [ebk, setEbk] = useState<Record<Color, boolean>>({ white: false, black: false });
  const countAnswer = useCallback((c: Color, correct: boolean) => {
    runs.current[c] = correct ? runs.current[c] + 1 : 0;
    if (runs.current[c] === EBK_RUN) {
      setEbk((cur) => ({ ...cur, [c]: true }));
      setTimeout(() => { if (alive.current) { emit({ kind: "ebk", color: c }); play("cheer"); } }, 700);
    }
  }, [emit, play]);

  const gameRef = useRef(game);
  const phaseRef = useRef(phase);
  const bots = useRef<Partial<Record<Color, BotLike>>>({});
  const alive = useRef(true);
  const setGame = useCallback((g: GameState) => { gameRef.current = g; setGameState(g); }, []);
  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Pausing stops the clocks, the question timers and the bots. On resume, timers carry on where they were.
  const lastTick = useRef(Date.now());
  const pausedRef = useRef(paused);
  const pausedAt = useRef(0);
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) { pausedAt.current = Date.now(); return; }
    if (!pausedAt.current) return;
    const d = Date.now() - pausedAt.current;
    pausedAt.current = 0;
    lastTick.current = Date.now();
    const p = phaseRef.current;
    if (p.kind === "question" || p.kind === "shootout") go({ ...p, startedAt: p.startedAt + d });
    else if (p.kind === "whoami") go({ ...p, clueAt: p.clueAt + d });
    else if (p.kind === "result") go({ ...p, shownAt: p.shownAt + d });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  // Questions and bots are downloaded separately. If either fails, say so and keep trying,
  // rather than quietly playing without them (playtest 2026-11-09).
  useEffect(() => {
    if (!setup.options.trivia) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => loadData(setup.players).then((d) => alive.current && setData(d), () => {
      if (!alive.current) return;
      setNote("Couldn't download the questions. Check your connection: trying again…");
      timer = setTimeout(attempt, 5000);
    });
    attempt();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => loadBots().then((m) => {
      if (!alive.current) return;
      setMod(m);
      for (const c of ["white", "black"] as Color[]) {
        const p = setup.players[c];
        if (p.kind === "bot" && p.botId) bots.current[c] = m.createBot(p.botId as never, setup.botLevel);
      }
      for (const c of ["white", "black"] as Color[]) talk(c, "start");
    }, () => {
      if (!alive.current) return;
      setNote("Couldn't download the bots. Check your connection: trying again…");
      timer = setTimeout(attempt, 5000);
    });
    attempt();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBot = (c: Color) => game.players[c].kind === "bot";

  // ------------------------------------------------------------ talk
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const talk = useCallback((c: Color, m: TalkMoment) => {
    const line = bots.current[c]?.say(m);
    if (!line) return;
    setBubble({ color: c, text: line });
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => alive.current && setBubble(null), 3000);
  }, []);
  /** Lets every bot react to something (their own moment, or the opponent's). */
  const react = useCallback((actor: Color, own: TalkMoment, other?: TalkMoment) => {
    if (bots.current[actor]) talk(actor, own);
    if (other && bots.current[opposite(actor)]) talk(opposite(actor), other);
  }, [talk]);

  // ------------------------------------------------------------ ending a turn
  /** A drawn game goes to a Penalty Shootout. Without the questions (still downloading) it just ends as a draw. */
  const startShootout = useCallback((state: GameState) => {
    const reason = state.pendingDraw;
    if (!reason) return;
    if (!data) {
      setGame({ ...state, pendingDraw: null, outcome: { kind: "draw", reason } });
      play("fulltime");
      go({ kind: "over" });
      return;
    }
    setGame(state);
    setNote(reason === "timeout-insufficient"
      ? "Time's up, but there's nothing left to mate with, so it goes to a Penalty Shootout!"
      : `It's a draw (${DRAW_WORDS[reason] ?? reason}), so it goes to a Penalty Shootout!`);
    emit({ kind: "shootout" });
    play("kickoff");
    go({ kind: "shootout", kicks: [], q: data.white.bank.any("medium"), startedAt: Date.now(), choice: null, taker: "white" });
  }, [data, emit, go, play, setGame]);

  const endTurn = useCallback((state: GameState) => {
    const { state: next, notes } = finishTurn(state);
    setGame(next);
    setOverlay({});
    if (notes.length) setNote(notes.join(". "));
    if (next.outcome) {
      play("fulltime");
      if (next.outcome.kind === "checkmate") emit({ kind: "checkmate", winner: next.outcome.winner });
      const w = "winner" in next.outcome ? next.outcome.winner : null;
      if (w) { react(w, "win"); react(opposite(w), "loss"); }
      go({ kind: "over" });
      return;
    }
    if (next.pendingDraw) { startShootout(next); return; }
    if (!notes.length) setNote(`${next.players[turnOf(next)].name} to move`);
    if (positionCheck(next)) play("check");
    go({ kind: "move" });
  }, [emit, go, play, react, setGame, startShootout]);

  // ------------------------------------------------------------ moves
  const afterMove = useCallback((res: MoveResult, mover: Color) => {
    // +3 seconds on the mover's clock for every move (timed games).
    const r = { ...res, state: addIncrement(res.state, mover) };
    setGame(r.state);
    setOverlay({});
    play(r.captured ? "capture" : "move");
    const lm = r.state.lastMove;
    if (lm) emit({ kind: "move", color: mover, from: lm[0], to: lm[1], captured: r.captured, check: r.check, castle: r.san.startsWith("O-O") });
    if (r.captured) react(mover, "capture", "lostPiece");
    const name = r.state.players[mover].name;
    const t = r.trigger;
    if (t.kind === "none" || !data) { endTurn(r.state); return; }
    if (t.kind === "promotion") {
      play("kickoff");
      setNote(`${name} reaches the end: "Who am I?" decides the new piece`);
      const club = r.state.players[mover].club;
      const set = data[mover].whoami.draw(club);
      go({ kind: "whoami", color: mover, set, square: t.square, clues: 1, clueAt: Date.now(), bonus: !!club && set.club === club });
      return;
    }
    const bonus = t.kind === "hot-spot";
    if (bonus) { play("cheer"); react(mover, "hotSpot"); emit({ kind: "hot-spot", color: mover, square: r.landed }); }
    else play("kickoff");
    const label = bonus ? "Hot Spot: pick a question" : t.kind === "capture" ? "Capture: pick a question" : "Set piece: pick a question";
    setNote(`${name}: ${label}`);
    go({ kind: "cards", color: mover, cards: data[mover].bank.deal(r.state.players[mover].club), bonus, landed: r.landed, label });
  }, [data, emit, endTurn, go, play, react, setGame]);

  const move = useCallback((uci: string): boolean => {
    const g = gameRef.current;
    if (phaseRef.current.kind !== "move" || g.outcome) return false;
    const m = resolveMove(g, uci);
    if (!m) return false;
    afterMove(playMove(g, m), turnOf(g));
    return true;
  }, [afterMove]);

  // ------------------------------------------------------------ power-ups
  /** Spends the Form and applies the effect. Engine power-ups ask the engine first, so a failed lookup costs nothing. */
  const applyPower = useCallback((id: PowerUpId, targets: string[]): string | null => {
    const g = gameRef.current;
    const me = turnOf(g);
    const check = usePowerUp(g, id, targets);
    if (check.error) { play("locked"); setNote(check.error); return check.error; }
    const commit = (): GameState => {
      const res = usePowerUp(gameRef.current, id, targets);
      setGame(res.state);
      play("powerup");
      setNote(res.note ?? "");
      react(me, "powerUp");
      emit({ kind: "power", color: me, power: id, square: targets[0], square2: targets[1] });
      return res.state;
    };
    if (!POWER_UP_BY_ID[id].engine) {
      commit();
      if (id === "assistants-flag") setOverlay({ attacked: attackedSquares(g.fen, opposite(me)) });
      return null;
    }
    if (!mod) { play("locked"); setNote("The engine is still warming up. Try again in a moment"); return "engine"; }
    const fen = id === "scout-report" ? flipTurn(g.fen) : g.fen;
    if (!fen) { play("locked"); setNote("The scouts can't read the game right now"); return "engine"; }
    const back = phaseRef.current;
    go({ kind: "thinking", power: id });
    setNote(`${POWER_UP_BY_ID[id].name}: thinking…`);
    // Manager's Tip only looks at moves the game allows right now (a frozen piece or Park the Bus can rule out the engine's favourite).
    const allowed = id === "managers-tip" ? legalMoves(g).moves : undefined;
    mod.bestMove(fen, g.options.chess960, undefined, allowed).then((best) => {
      if (!alive.current) return;
      const legal = best ? (id === "scout-report" ? best : resolveMove(gameRef.current, best)) : null;
      if (!legal) { go(back.kind === "target" ? { kind: "move" } : back); setNote(`${POWER_UP_BY_ID[id].name}: the gaffer's stumped, so no Form spent`); return; }
      commit();
      if (id === "managers-tip") {
        go({ kind: "move" });
        setOverlay({ tip: [legal!.slice(0, 2), legal!.slice(2, 4)] });
        setNote(`Manager's Tip: ${legal!.slice(0, 2)} to ${legal!.slice(2, 4)}`);
      } else {
        go({ kind: "move" });
        setOverlay({ scout: legal!.slice(0, 2) });
        setNote(`Scout Report: watch the piece on ${legal!.slice(0, 2)}`);
      }
    }, () => { if (alive.current) { go({ kind: "move" }); setNote("The engine didn't answer, so no Form spent"); } });
    return null;
  }, [afterMove, emit, go, mod, play, react, setGame]);

  /** Extra Time's second move is optional. */
  const skipExtra = useCallback(() => {
    if (phaseRef.current.kind !== "move") return;
    const next = skipExtraTime(gameRef.current);
    if (!next) return;
    play("select");
    endTurn(next);
  }, [endTurn, play]);

  /** Human taps a power-up button. */
  const choosePower = useCallback((id: PowerUpId) => {
    const g = gameRef.current;
    // Once a power-up is confirmed it can't be cancelled or swapped.
    if (phaseRef.current.kind !== "move") return;
    const blocked = powerBlocked(g, id);
    if (blocked) { play("locked"); setNote(`${POWER_UP_BY_ID[id].name}: ${blocked}`); return; }
    const def = POWER_UP_BY_ID[id];
    if (def.target === "none") { applyPower(id, []); return; }
    play("select");
    setNote(`${def.name}: ${targetPrompt(def.target)}`);
    go({ kind: "target", power: id });
  }, [applyPower, go, play]);

  /** Human taps a square while picking a power-up target. */
  const tapTarget = useCallback((sq: string) => {
    const p = phaseRef.current;
    if (p.kind !== "target") return;
    const def = POWER_UP_BY_ID[p.power];
    if (def.target === "two-own-pieces" && !p.first) {
      play("select");
      setNote(`${def.name}: now tap the piece to swap with`);
      go({ ...p, first: sq });
      return;
    }
    const err = applyPower(p.power, p.first ? [p.first, sq] : [sq]);
    if (!err) go({ kind: "move" });
    else if (p.first) go({ ...p, first: undefined });
  }, [applyPower, go, play]);

  // ------------------------------------------------------------ questions
  const pickCard = useCallback((index: number, puskas: boolean) => {
    const p = phaseRef.current;
    if (p.kind !== "cards" || !data) return;
    const card = p.cards[index];
    const isPuskas = puskas && card.difficulty === "hard";
    play("select");
    go({
      kind: "question", color: p.color, q: data[p.color].bank.draw(card), card, puskas: isPuskas, bonus: p.bonus, landed: p.landed,
      startedAt: Date.now(), limitMs: isPuskas ? TIMER_MS.puskas : TIMER_MS.normal, label: cardLabel(card, isPuskas),
    });
  }, [data, go, play]);

  const answer = useCallback((choice: number | null) => {
    const p = phaseRef.current;
    if (p.kind !== "question") return;
    const ms = Date.now() - p.startedAt;
    const correct = choice === p.q.answer && ms <= p.limitMs + 250;
    const hatTrick = correct && gameRef.current.players[p.color].rightStreak === 2;
    const out = applyAnswer(gameRef.current, {
      color: p.color, difficulty: p.card.difficulty, puskas: p.puskas, bonus: p.bonus, correct, ms, landed: p.landed,
    });
    setGame(out.state);
    emit({ kind: "answer", color: p.color, correct, puskas: p.puskas, hatTrick });
    countAnswer(p.color, correct);
    if (correct) { play("correct"); setTimeout(() => play("form"), 300); react(p.color, "ownRight"); }
    else { play("wrong"); setTimeout(() => play("groan"), 350); react(p.color, "ownWrong", "oppWrong"); }
    const who = out.state.players[p.color].name;
    go({
      kind: "result", color: p.color, correct, title: correct ? `${who} got it right!` : choice === null ? "Time's up!" : `${who} got it wrong`,
      lines: out.lines, options: p.q.options, answer: p.q.answer, choice, explanation: p.q.explanation, next: out.state, auto: isBot(p.color),
      shownAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countAnswer, emit, go, play, react, setGame]);

  // "Who am I?"
  const nextClue = useCallback(() => {
    const p = phaseRef.current;
    if (p.kind !== "whoami") return;
    if (p.clues >= 5) { guess(null); return; }
    play("tick");
    go({ ...p, clues: p.clues + 1, clueAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, play]);

  /** Ends a "Who am I?": sets the piece and shows the result. */
  const finishWhoAmI = useCallback((p: { color: Color; set: WhoAmI; square: string; clues: number }, correct: boolean, typed: string | null, timedOut: boolean, pick?: PromoRole) => {
    const name = p.set.name ?? p.set.options[p.set.answer];
    const res = resolvePromotion(gameRef.current, p.square, p.clues, correct, pick);
    setGame(res.state);
    emit({ kind: "whoami", color: p.color, correct });
    countAnswer(p.color, correct);
    if (correct) { play("correct"); setTimeout(() => play("cheer"), 350); react(p.color, "ownRight"); }
    else { play("wrong"); react(p.color, "ownWrong", "oppWrong"); }
    const who = res.state.players[p.color].name;
    go({
      kind: "result", color: p.color, correct,
      title: correct ? `${who} got it on clue ${p.clues}!` : timedOut ? "Time's up!" : `${who} got it wrong`,
      lines: [
        ...(typed && !correct ? [`"${typed}" isn't right: it was ${name}`] : []),
        res.line,
      ],
      options: [name], answer: 0, choice: correct ? 0 : null,
      explanation: p.set.clues.slice(p.clues).length ? `The clues ${correct ? "you didn't need" : "still to come"}: ${p.set.clues.slice(p.clues).join(" ")}` : undefined,
      next: res.state, auto: isBot(p.color), shownAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countAnswer, emit, go, play, react, setGame]);

  /** A "Who am I?" guess: typed text from a player, an option index from a bot, or null when time runs out. */
  const guess = useCallback((input: string | number | null) => {
    const p = phaseRef.current;
    if (p.kind !== "whoami" || !data) return;
    const typed = typeof input === "string" ? input.trim() : null;
    const correct = typeof input === "number" ? input === p.set.answer : typed ? data[p.color].whoami.check(p.set, typed) : false;
    const timedOut = input === null || (typed !== null && !typed);
    const earned = earnedPiece(p.clues);
    if (correct && earned !== "n") {
      // Bots take the best piece that doesn't stalemate; people choose.
      if (isBot(p.color)) { finishWhoAmI(p, true, typed, false, safePromotion(gameRef.current, p.square, earned)); return; }
      go({ kind: "promote", color: p.color, set: p.set, square: p.square, clues: p.clues, earned });
      return;
    }
    finishWhoAmI(p, correct, typed, timedOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, finishWhoAmI, go]);

  /** The piece a player picked after a right "Who am I?". */
  const promote = useCallback((role: PromoRole) => {
    const p = phaseRef.current;
    if (p.kind !== "promote") return;
    finishWhoAmI(p, true, null, false, role);
  }, [finishWhoAmI]);

  const continueOn = useCallback(() => {
    const p = phaseRef.current;
    if (p.kind !== "result") return;
    // The clocks kept running while the result showed, so keep their current time.
    endTurn(withClocksFrom(p.next, gameRef.current));
  }, [endTurn]);

  // ------------------------------------------------------------ shootout
  const kick = useCallback((choice: number | null) => {
    const p = phaseRef.current;
    if (p.kind !== "shootout" || p.choice !== null || !data) return;
    const scored = choice === p.q.answer && Date.now() - p.startedAt <= TIMER_MS.normal + 250;
    play(scored ? "cheer" : "groan");
    const kicks = [...p.kicks, { color: p.taker, scored }];
    go({ ...p, choice: choice ?? -1, kicks });
    setTimeout(() => {
      if (!alive.current) return;
      const winner = shootoutWinner(kicks);
      if (winner) {
        const score = { white: kicks.filter((k) => k.color === "white" && k.scored).length, black: kicks.filter((k) => k.color === "black" && k.scored).length };
        const g = { ...gameRef.current, pendingDraw: null, outcome: { kind: "shootout" as const, winner, score } };
        setGame(g);
        play("fulltime");
        react(winner, "win");
        react(opposite(winner), "loss");
        go({ kind: "over" });
      } else {
        go({ kind: "shootout", kicks, q: data[opposite(p.taker)].bank.any("medium"), startedAt: Date.now(), choice: null, taker: opposite(p.taker) });
      }
    }, 1800);
  }, [data, go, play, react, setGame]);

  // ------------------------------------------------------------ resign / draw
  const resign = useCallback((c: Color) => {
    const g = resignRule(gameRef.current, c);
    setGame(g);
    play("fulltime");
    react(opposite(c), "win");
    go({ kind: "over" });
  }, [go, play, react, setGame]);

  const agreeDraw = useCallback(() => {
    const g = endInDraw(gameRef.current, "agreement");
    if (g.pendingDraw) { startShootout(g); return; }
    setGame(g);
    play("fulltime");
    go({ kind: "over" });
  }, [go, play, setGame, startShootout]);

  // ------------------------------------------------------------ timers (question clock, clues, chess clock)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const p = phase;
    if (pausedRef.current) return;
    if (p.kind === "question" && !isBot(p.color)) {
      const left = p.limitMs - (now - p.startedAt);
      if (left <= 0) answer(null);
    }
    if (p.kind === "whoami" && !isBot(p.color) && now - p.clueAt >= CLUE_MS) nextClue();
    if (p.kind === "result" && now - p.shownAt >= (p.auto ? RESULT_MS : RESULT_MS_HUMAN)) continueOn();
    if (p.kind === "shootout" && p.choice === null && !isBot(p.taker) && now - p.startedAt > TIMER_MS.normal) kick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Chess clock: always runs for whoever has to act, through questions, results and engine
  // thinking too. It stops only for a "Who am I?", the Penalty Shootout and the pause menu.
  useEffect(() => {
    const t = Date.now();
    const dt = t - lastTick.current;
    lastTick.current = t;
    if (pausedRef.current) return;
    const g = gameRef.current;
    if (!g.options.timed || g.outcome) return;
    const p = phaseRef.current;
    const c = clockOwner(g, p);
    if (!c) return;
    const left = (g.players[c].clockMs ?? 0) - dt;
    if (left <= 0) {
      const out = timeout(setClock(g, c, 0), c);
      if (out.pendingDraw) { startShootout(out); return; }
      setGame(out);
      play("fulltime");
      go({ kind: "over" });
    } else setGame(setClock(g, c, left));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ------------------------------------------------------------ bots
  const busy = useRef(false);
  useEffect(() => {
    const p = phase;
    const g = game;
    if (g.outcome || busy.current || paused) return;
    const actor: Color | null =
      p.kind === "move" ? turnOf(g)
        : p.kind === "cards" || p.kind === "question" || p.kind === "whoami" || p.kind === "result" ? p.color
          : p.kind === "shootout" && p.choice === null ? p.taker : null;
    if (!actor) return;
    const bot = bots.current[actor];
    if (!bot) return;
    busy.current = true;
    runBot(bot, actor, p).finally(() => { busy.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mod, paused]);

  async function runBot(bot: BotLike, color: Color, p: Phase) {
    const still = () => alive.current && !pausedRef.current && phaseRef.current === p;
    if (p.kind === "move") {
      await wait(400);
      if (!still()) return;
      let g = gameRef.current;
      let managersTip = false;
      const available = POWER_UPS.filter((d) => !powerBlocked(g, d.id) && d.id !== "scout-report" && d.id !== "assistants-flag")
        .map((d) => ({ id: d.id, cost: powerCost(g, color, d.id) }));
      if (available.length) {
        const choice = await bot.choosePowerUp({
          fen: g.fen, color, form: g.players[color].form, available, inCheck: positionCheck(g), timed: g.options.timed, clockMs: g.players[color].clockMs ?? undefined,
          options: botPowerOptions(g),
        });
        // The engine took a while to plan, and the clock ran meanwhile: apply the power-up to the
        // live game, not the copy from before the planning, or the bot's clock would jump back.
        if (!still()) return;
        if (choice && available.some((a) => a.id === choice.id)) {
          const id = choice.id as PowerUpId;
          const targets = [choice.target, choice.target2].filter((t): t is string => !!t);
          const res = usePowerUp(gameRef.current, id, targets);
          if (!res.error) {
            setGame(res.state);
            play("powerup");
            setNote(res.note ?? "");
            talk(color, "powerUp");
            emit({ kind: "power", color, power: id, square: targets[0], square2: targets[1] });
            g = res.state;
            if (id === "managers-tip") managersTip = true;
            await wait(900);
            if (!alive.current) return;
            if (id === "counter-attack" && targets[0]) {
              const push = legalMoves(g).moves.find((m) => m.startsWith(targets[0]) && Math.abs(Number(m[3]) - Number(m[1])) === 2);
              if (push) { afterMove(playMove(g, push), color); return; }
            }
          }
        }
      }
      const allowed = legalMoves(g).moves;
      if (!allowed.length) return;
      let uci = allowed[0];
      try {
        const me = g.players[color];
        const res = await bot.chooseMove({
          fen: g.fen, chess960: g.options.chess960, allowedMoves: allowed, managersTip,
          hotSpots: g.hotSpots, goldenBoot: me.goldenBootMoves > 0,
        });
        await wait(Math.min(res.thinkMs, 2500));
        uci = resolveMove(gameRef.current, res.uci) ?? allowed[Math.floor(Math.random() * allowed.length)];
      } catch {
        uci = allowed[Math.floor(Math.random() * allowed.length)];
      }
      if (!alive.current || pausedRef.current || phaseRef.current.kind !== "move" || turnOf(gameRef.current) !== color) return;
      afterMove(playMove(gameRef.current, uci), color);
    } else if (p.kind === "cards") {
      await wait(1100);
      if (!still()) return;
      const c = await bot.chooseCard({ cards: p.cards, puskasAllowed: true, form: gameRef.current.players[color].form, bonusRound: p.bonus });
      pickCard(Math.min(2, Math.max(0, c.index)), c.puskas);
    } else if (p.kind === "question") {
      const a = await bot.answer({ question: p.q, puskas: p.puskas });
      await wait(Math.min(a.delayMs, p.limitMs + 100));
      if (!alive.current || pausedRef.current || phaseRef.current !== p) return;
      answer(a.delayMs > p.limitMs ? null : a.choice);
    } else if (p.kind === "whoami") {
      const aim = PROMOTION_AIM[bot.promotionPick()] ?? PROMOTION_AIM.n;
      // Reveal clues at a watchable pace up to the bot's aim, then guess.
      for (let k = p.clues; k < aim.clues; k++) {
        await wait(1500);
        if (!alive.current || phaseRef.current.kind !== "whoami") return;
        go({ ...(phaseRef.current as Extract<Phase, { kind: "whoami" }>), clues: k + 1, clueAt: Date.now() });
        play("tick");
      }
      const set = p.set;
      const a = await bot.answer({ question: { options: set.options, answer: set.answer, difficulty: aim.difficulty, club: set.club }, puskas: aim.puskas });
      await wait(Math.min(2500, Math.max(900, a.delayMs / 3)));
      if (!alive.current || phaseRef.current.kind !== "whoami") return;
      guess(a.choice);
    } else if (p.kind === "shootout") {
      const a = await bot.answer({ question: p.q });
      await wait(Math.min(a.delayMs, TIMER_MS.normal));
      if (!still()) return;
      kick(a.choice);
    }
  }

  const botMeta: BotMeta[] = useMemo(() => (mod ? botList(mod) : []), [mod]);

  return {
    game, phase, note, bubble, overlay, now, ready: !!data, botMeta, engineReady: !!mod, events, ebk, runs: runs.current,
    /** White's engine score in centipawns for a position, or null (for the commentator). */
    evaluate: useCallback((fen: string) => (mod?.evaluate ? mod.evaluate(fen, game.options.chess960) : Promise.resolve(null)), [mod, game.options.chess960]),
    move, choosePower, tapTarget, skipExtra, pickCard, answer, nextClue, guess, promote, continueOn, kick, resign, agreeDraw,
  };
}
