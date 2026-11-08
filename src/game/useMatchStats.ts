// Keeps count, during a game, of the Form each side earns and their trivia score, for the game history.

import { useEffect, useRef } from "react";
import type { Phase } from "./useGame";
import type { Color, GameState } from "./types";
import { emptyStats, type MatchStats } from "./history";
import type { Answer } from "./triviaElo";

const COLORS: Color[] = ["white", "black"];

export function useMatchStats(game: GameState, phase: Phase): { current: MatchStats } {
  const stats = useRef<MatchStats>(emptyStats());
  const lastForm = useRef<Record<Color, number>>({ white: game.players.white.form, black: game.players.black.form });
  const counted = useRef(new WeakSet<object>());
  const kicks = useRef(0);
  /** The question card each side is answering, so its result can be rated. */
  const pending = useRef<Partial<Record<Color, Answer["tier"]>>>({});

  // Form earned = every rise in a player's Form (spending on power-ups doesn't take it away).
  useEffect(() => {
    for (const c of COLORS) {
      const f = game.players[c].form;
      if (f > lastForm.current[c]) stats.current.formEarned[c] += f - lastForm.current[c];
      lastForm.current[c] = f;
    }
  }, [game]);

  // Each answered question or "Who am I?" shows one result panel; each Penalty Shootout kick is a question too.
  useEffect(() => {
    if (counted.current.has(phase)) return;
    if (phase.kind === "question") {
      pending.current[phase.color] = phase.puskas ? "puskas" : phase.card.difficulty;
    } else if (phase.kind === "whoami") {
      delete pending.current[phase.color];
    } else if (phase.kind === "result") {
      counted.current.add(phase);
      const t = stats.current.trivia[phase.color];
      t.asked++;
      if (phase.correct) t.right++;
      const tier = pending.current[phase.color];
      if (tier) {
        stats.current.answers[phase.color].push({ tier, right: phase.correct });
        delete pending.current[phase.color];
      }
    } else if (phase.kind === "shootout") {
      // Count by kicks taken, since a shootout phase is copied (on pause) without a new kick.
      for (const k of phase.kicks.slice(kicks.current)) {
        const t = stats.current.trivia[k.color];
        t.asked++;
        if (k.scored) t.right++;
      }
      kicks.current = Math.max(kicks.current, phase.kicks.length);
    }
  }, [phase]);

  return stats;
}
