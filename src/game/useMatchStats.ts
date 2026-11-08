// Keeps count, during a game, of the Form each side earns and their trivia score, for the game history.

import { useEffect, useRef } from "react";
import type { Phase } from "./useGame";
import type { Color, GameState } from "./types";
import { emptyStats, type MatchStats } from "./history";
import type { Answer } from "./triviaElo";
import { emptyFeats, type Feats } from "./badges";
import { materialCp } from "./material";

const COLORS: Color[] = ["white", "black"];

export function useMatchStats(game: GameState, phase: Phase): { current: MatchStats } {
  const stats = useRef<MatchStats>(emptyStats());
  const lastForm = useRef<Record<Color, number>>({ white: game.players.white.form, black: game.players.black.form });
  const counted = useRef(new WeakSet<object>());
  const kicks = useRef(0);
  /** The question card each side is answering, so its result can be rated. */
  const pending = useRef<Partial<Record<Color, Answer["tier"]>>>({});
  /** For the badges: the club of the question being answered, the clue a "Who am I?" is on, and streaks. */
  const club = useRef<Partial<Record<Color, string | null>>>({});
  const clue = useRef<Partial<Record<Color, number>>>({});
  const run = useRef<Record<Color, number>>({ white: 0, black: 0 });
  const cardRun = useRef<Record<Color, number>>({ white: 0, black: 0 });
  const lastPower = useRef<string | null>(null);
  const feats = (c: Color): Feats => {
    const all = (stats.current.feats ??= { white: emptyFeats(), black: emptyFeats() });
    return all[c];
  };

  // Badges: how far behind on material each side has been, and which power-ups each has used.
  useEffect(() => {
    const cp = materialCp(game.fen);
    for (const c of COLORS) {
      const f = feats(c);
      f.worstCp = Math.min(f.worstCp, c === "white" ? cp : -cp);
    }
    const id = game.powerUsedId;
    if (id && id !== lastPower.current) {
      const mover: Color = game.fen.split(" ")[1] === "b" ? "black" : "white";
      const f = feats(mover);
      if (!f.powerUps.includes(id)) f.powerUps.push(id);
    }
    lastPower.current = id;
  }, [game]); // eslint-disable-line react-hooks/exhaustive-deps

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
      club.current[phase.color] = phase.q.club;
      delete clue.current[phase.color];
    } else if (phase.kind === "whoami") {
      delete pending.current[phase.color];
      delete club.current[phase.color];
      clue.current[phase.color] = phase.clues;
    } else if (phase.kind === "result") {
      counted.current.add(phase);
      const t = stats.current.trivia[phase.color];
      t.asked++;
      if (phase.correct) t.right++;
      const c = phase.color;
      const f = feats(c);
      run.current[c] = phase.correct ? run.current[c] + 1 : 0;
      f.bestRun = Math.max(f.bestRun, run.current[c]);
      if (clue.current[c] !== undefined) {
        if (phase.correct && clue.current[c] === 1) f.clueOne++;
        delete clue.current[c];
      } else if (pending.current[c]) {
        // Hat-tricks: three right question cards in a row, then the count starts again (as in the rules).
        cardRun.current[c] = phase.correct ? cardRun.current[c] + 1 : 0;
        if (cardRun.current[c] === 3) { f.hatTricks++; cardRun.current[c] = 0; }
        if (phase.correct && pending.current[c] === "puskas") f.puskasRight++;
        const qc = club.current[c];
        if (phase.correct && qc) {
          if (!f.clubsRight.includes(qc)) f.clubsRight.push(qc);
          if (qc === game.players[c].club) f.clubRight++;
        }
      }
      delete club.current[c];
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
