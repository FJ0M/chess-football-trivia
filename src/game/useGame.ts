// The React shell around the match engine (match.ts): it downloads the questions and
// the bots, ticks the clocks, runs the bots, and carries out the engine's effects
// (sounds, animation events, speech bubbles, delayed actions, engine lookups).
// Every change to the match itself goes through step() in match.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SfxName } from "../audio/sfx";
import { botList, importWithRetry, loadBots, type BotLike, type BotLevel, type BotMeta, type BotModule, type TalkMoment } from "./bots";
import { botPowerOptions } from "./botPowers";
import { POWER_UPS } from "./powerups";
import { PROMOTION_AIM, legalMoves, newGame, powerBlocked, powerCost, resolveMove, turnOf, type PlayerInit } from "./rules";
import { QuestionBank, TIMER_MS, browserSeenStore, memorySeenStore } from "./trivia";
import { WhoAmIBank, type WhoAmI } from "./whoami";
import {
  actorOf, positionCheck, startMatch, step, type Action, type Data, type Effect, type GameEvent, type Match, type NewEvent, type Phase,
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
    const banks = (c: Color): Data[Color] => {
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
  const [match, setMatchState] = useState<Match>(() => {
    // A saved match picks up where it was (the position after the last finished turn).
    if (resume) return startMatch(resume, true);
    let g = newGame(setup.options, setup.players);
    // Dev only: ?fen=... starts from a position, ?form=12 unlocks everything (for testing).
    if (import.meta.env.DEV) {
      const q = new URLSearchParams(location.search);
      const fen = q.get("fen");
      const form = Number(q.get("form") ?? NaN);
      if (fen) g = { ...g, fen, repetition: {} };
      if (Number.isFinite(form)) {
        const ready = (p: GameState["players"]["white"]) => ({ ...p, form, cooldowns: Object.fromEntries(Object.keys(p.cooldowns).map((k) => [k, 0])) as typeof p.cooldowns });
        g = { ...g, players: { white: ready(g.players.white), black: ready(g.players.black) } };
      }
    }
    return startMatch(g);
  });
  const { game, phase } = match;
  const [data, setData] = useState<Data | null>(null);
  const [mod, setMod] = useState<BotModule | null>(null);
  const [now, setNow] = useState(Date.now());
  const [bubble, setBubble] = useState<{ color: Color; text: string } | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);

  // The latest of everything, for callbacks, timers and the bots (which outlive a render).
  const matchRef = useRef(match);
  const dataRef = useRef(data);
  const modRef = useRef(mod);
  const playRef = useRef(play);
  playRef.current = play;
  const bots = useRef<Partial<Record<Color, BotLike>>>({});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const eventId = useRef(0);
  /** Keeps the last few seconds of events. */
  const emit = useCallback((e: NewEvent) => {
    const at = Date.now();
    setEvents((cur) => [...cur.filter((x) => at - x.at < 6000), { ...e, id: ++eventId.current, at } as GameEvent]);
  }, []);

  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const talk = useCallback((c: Color, m: TalkMoment) => {
    const line = bots.current[c]?.say(m);
    if (!line) return;
    setBubble({ color: c, text: line });
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => alive.current && setBubble(null), 3000);
  }, []);

  // ------------------------------------------------------------ the engine
  /** Runs one action through the engine, then carries out its effects. Returns the match after it. */
  const dispatch = useRef((a: Action): Match => {
    const out = step(matchRef.current, a, { now: Date.now(), banks: dataRef.current, engineReady: !!modRef.current });
    if (out.match !== matchRef.current) { matchRef.current = out.match; setMatchState(out.match); }
    for (const e of out.fx) perform(e);
    return out.match;
  }).current;
  function perform(e: Effect) {
    switch (e.kind) {
      case "sfx":
        if (e.delayMs) setTimeout(() => alive.current && playRef.current(e.sound), e.delayMs);
        else playRef.current(e.sound);
        break;
      case "event":
        if (e.delayMs) setTimeout(() => alive.current && emit(e.event), e.delayMs);
        else emit(e.event);
        break;
      case "talk": talk(e.color, e.moment); break;
      case "later": setTimeout(() => alive.current && dispatch(e.action), e.delayMs); break;
      case "lookup": {
        const m = modRef.current;
        const done = (best: string | null | "error") => alive.current && dispatch({ type: "lookup-done", id: e.id, color: e.color, targets: e.targets, best });
        if (!m) { done("error"); break; }
        m.bestMove(e.fen, e.chess960, undefined, e.allowed).then((best) => done(best ?? null), () => done("error"));
        break;
      }
    }
  }

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
    dispatch({ type: "unpause", pausedMs: d });
  }, [paused, dispatch]);

  // Questions and bots are downloaded separately. If either fails, say so and keep trying,
  // rather than quietly playing without them (playtest 2026-11-09).
  useEffect(() => {
    if (!setup.options.trivia) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => loadData(setup.players).then((d) => { if (alive.current) { dataRef.current = d; setData(d); } }, () => {
      if (!alive.current) return;
      dispatch({ type: "note", text: "Couldn't download the questions. Check your connection: trying again…" });
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
      modRef.current = m;
      setMod(m);
      for (const c of ["white", "black"] as Color[]) {
        const p = setup.players[c];
        if (p.kind === "bot" && p.botId) bots.current[c] = m.createBot(p.botId as never, setup.botLevel);
      }
      for (const c of ["white", "black"] as Color[]) talk(c, "start");
    }, () => {
      if (!alive.current) return;
      dispatch({ type: "note", text: "Couldn't download the bots. Check your connection: trying again…" });
      timer = setTimeout(attempt, 5000);
    });
    attempt();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ time
  // Five times a second: the question timers, clues, results and the chess clock (see "tick" in match.ts).
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const dt = t - lastTick.current;
      lastTick.current = t;
      setNow(t);
      if (!pausedRef.current) dispatch({ type: "tick", dt });
    }, 200);
    return () => clearInterval(id);
  }, [dispatch]);

  // ------------------------------------------------------------ bots
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current || paused) return;
    const actor = actorOf(match);
    if (!actor) return;
    const bot = bots.current[actor];
    if (!bot) return;
    busy.current = true;
    runBot(bot, actor, phase).finally(() => { busy.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mod, paused]);

  async function runBot(bot: BotLike, color: Color, p: Phase) {
    const live = () => matchRef.current;
    const still = () => alive.current && !pausedRef.current && live().phase === p;
    if (p.kind === "move") {
      await wait(400);
      if (!still()) return;
      let g = live().game;
      let managersTip = false;
      const available = POWER_UPS.filter((d) => !powerBlocked(g, d.id) && d.id !== "scout-report" && d.id !== "assistants-flag")
        .map((d) => ({ id: d.id, cost: powerCost(g, color, d.id) }));
      if (available.length) {
        const choice = await bot.choosePowerUp({
          fen: g.fen, color, form: g.players[color].form, available, inCheck: positionCheck(g), timed: g.options.timed, clockMs: g.players[color].clockMs ?? undefined,
          options: botPowerOptions(g),
        });
        // The engine took a while to plan, and the clock ran meanwhile: the engine applies the
        // power-up to the live game, not the copy from before the planning.
        if (!still()) return;
        if (choice && available.some((a) => a.id === choice.id)) {
          const id = choice.id as PowerUpId;
          const targets = [choice.target, choice.target2].filter((t): t is string => !!t);
          const before = live().game;
          g = dispatch({ type: "bot-power", color, id, targets }).game;
          if (g !== before) {
            if (id === "managers-tip") managersTip = true;
            await wait(900);
            if (!alive.current) return;
            if (id === "counter-attack" && targets[0]) {
              const push = legalMoves(g).moves.find((m) => m.startsWith(targets[0]) && Math.abs(Number(m[3]) - Number(m[1])) === 2);
              if (push) { dispatch({ type: "bot-move", color, uci: push }); return; }
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
        uci = resolveMove(live().game, res.uci) ?? allowed[Math.floor(Math.random() * allowed.length)];
      } catch {
        uci = allowed[Math.floor(Math.random() * allowed.length)];
      }
      if (!alive.current || pausedRef.current || live().phase.kind !== "move" || turnOf(live().game) !== color) return;
      dispatch({ type: "bot-move", color, uci });
    } else if (p.kind === "cards") {
      await wait(1100);
      if (!still()) return;
      const c = await bot.chooseCard({ cards: p.cards, puskasAllowed: true, form: live().game.players[color].form, bonusRound: p.bonus });
      dispatch({ type: "pick", index: Math.min(2, Math.max(0, c.index)), puskas: c.puskas });
    } else if (p.kind === "question") {
      const a = await bot.answer({ question: p.q, puskas: p.puskas });
      await wait(Math.min(a.delayMs, p.limitMs + 100));
      if (!alive.current || pausedRef.current || live().phase !== p) return;
      dispatch({ type: "answer", choice: a.delayMs > p.limitMs ? null : a.choice });
    } else if (p.kind === "whoami") {
      const aim = PROMOTION_AIM[bot.promotionPick()] ?? PROMOTION_AIM.n;
      // Reveal clues at a watchable pace up to the bot's aim, then guess.
      for (let k = p.clues; k < aim.clues; k++) {
        await wait(1500);
        if (!alive.current || live().phase.kind !== "whoami") return;
        dispatch({ type: "next-clue" });
      }
      const set = p.set;
      const a = await bot.answer({ question: { options: set.options, answer: set.answer, difficulty: aim.difficulty, club: set.club }, puskas: aim.puskas });
      await wait(Math.min(2500, Math.max(900, a.delayMs / 3)));
      if (!alive.current || live().phase.kind !== "whoami") return;
      dispatch({ type: "guess", input: a.choice });
    } else if (p.kind === "shootout") {
      const a = await bot.answer({ question: p.q });
      await wait(Math.min(a.delayMs, TIMER_MS.normal));
      if (!still()) return;
      dispatch({ type: "kick", choice: a.choice });
    }
  }

  // ------------------------------------------------------------ what the screen calls
  const actions = useMemo(() => ({
    /** A person's move; false if the rules don't allow it. */
    move: (uci: string): boolean => {
      const before = matchRef.current;
      return dispatch({ type: "move", uci }) !== before;
    },
    choosePower: (id: PowerUpId) => { dispatch({ type: "power", id }); },
    tapTarget: (square: string) => { dispatch({ type: "target", square }); },
    skipExtra: () => { dispatch({ type: "skip-extra" }); },
    pickCard: (index: number, puskas: boolean) => { dispatch({ type: "pick", index, puskas }); },
    answer: (choice: number | null) => { dispatch({ type: "answer", choice }); },
    nextClue: () => { dispatch({ type: "next-clue" }); },
    guess: (input: string | number | null) => { dispatch({ type: "guess", input }); },
    promote: (role: PromoRole) => { dispatch({ type: "promote", role }); },
    continueOn: () => { dispatch({ type: "continue" }); },
    kick: (choice: number | null) => { dispatch({ type: "kick", choice }); },
    resign: (color: Color) => { dispatch({ type: "resign", color }); },
    agreeDraw: () => { dispatch({ type: "agree-draw" }); },
  }), [dispatch]);

  const botMeta: BotMeta[] = useMemo(() => (mod ? botList(mod) : []), [mod]);

  return {
    game, phase, note: match.note, bubble, overlay: match.overlay, now, ready: !!data, botMeta, engineReady: !!mod, events, ebk: match.ebk, runs: match.runs,
    /** White's engine score in centipawns for a position, or null (for the commentator). */
    evaluate: useCallback((fen: string) => (mod?.evaluate ? mod.evaluate(fen, game.options.chess960) : Promise.resolve(null)), [mod, game.options.chess960]),
    ...actions,
  };
}
