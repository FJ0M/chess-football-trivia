// Feeds the game's events to the commentator (commentary.ts) and keeps the latest line.
// After a move it asks the engine for a quick score, but the commentator never sees that score
// straight away: VAR Review could still undo the move, so a live "that's a blunder" would give
// the game away. Lines during play only go on the material on the board. The engine's view of
// a move comes out later, as a verdict, once the player who made it has moved again.

import { useEffect, useRef, useState } from "react";
import { comment, judgeMove, type CommentEvent, type PendingMove } from "./commentary";
import { materialCp } from "./material";
import { POWER_UP_BY_ID } from "./powerups";
import { ODDS_POINTS } from "./handicap";
import type { GameEvent } from "./useGame";
import type { Color, GameState } from "./types";

export function useCommentary(
  game: GameState, events: GameEvent[], enabled: boolean, names: Record<Color, string>,
  evaluate: (fen: string) => Promise<number | null>,
): { id: number; text: string } | null {
  const [line, setLine] = useState<{ id: number; text: string } | null>(null);
  const seen = useRef(0);
  const bucket = useRef<number | null>(null);
  const lastEval = useRef<number | null>(null);
  const lastMaterial = useRef<number>(materialCp(game.fen));
  const pending = useRef<Partial<Record<Color, PendingMove>>>({});
  const gameRef = useRef(game);
  gameRef.current = game;
  const namesRef = useRef(names);
  namesRef.current = names;

  const say = (event: CommentEvent, id: number) => {
    // With Pass and Play piece odds, the commentator judges the game against the handicap:
    // the side that gave a piece away isn't "behind" because of it.
    const g = gameRef.current;
    const h = g.options.mode === "local" ? g.options.handicap : null;
    const offset = h ? (h.weaker === "white" ? -1 : 1) * ODDS_POINTS[h.odds] * 100 : 0;
    const c = comment({ event, names: namesRef.current, evalCp: null, materialCp: materialCp(g.fen) + offset, prevBucket: bucket.current });
    bucket.current = c.bucket;
    setLine({ id, text: c.text });
  };

  useEffect(() => {
    if (enabled && seen.current === 0 && !line) say({ kind: "kickoff" }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const fresh = events.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    if (!enabled) return;
    for (const e of fresh) {
      if (e.kind === "power" && e.power === "var-review") {
        // The moves waiting for a verdict have just been overturned.
        pending.current = {};
        lastEval.current = null;
        lastMaterial.current = materialCp(gameRef.current.fen);
      }
      const ev = toComment(e);
      if (!ev) continue;
      if (e.kind === "move") {
        const fen = gameRef.current.fen;
        const material = materialCp(fen);
        const materialBefore = lastMaterial.current;
        lastMaterial.current = material;
        evaluate(fen).then((cp) => {
          const evalBefore = lastEval.current;
          lastEval.current = cp;
          // This player's previous move can't be reviewed any more, so it gets its verdict now.
          const earlier = pending.current[e.color];
          const verdict = earlier ? judgeMove(earlier, cp, material) : null;
          pending.current[e.color] = { color: e.color, evalBefore, evalAfter: cp, materialBefore };
          // Only speak if nothing newer has been said since.
          if (seen.current !== e.id) return;
          say(ev, e.id);
          if (verdict) setTimeout(() => { if (seen.current === e.id) say({ kind: "verdict", color: e.color, verdict }, e.id + 0.5); }, 2500);
        });
      } else say(ev, e.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, enabled]);

  return enabled ? line : null;
}

function toComment(e: GameEvent): CommentEvent | null {
  switch (e.kind) {
    case "move": return { kind: "move", color: e.color, captured: e.captured, check: e.check, castle: e.castle };
    case "power": return { kind: "power", color: e.color, name: POWER_UP_BY_ID[e.power].name };
    case "answer": return { kind: "answer", color: e.color, correct: e.correct, puskas: e.puskas, hatTrick: e.hatTrick };
    case "whoami": return { kind: "whoami", color: e.color, correct: e.correct };
    case "hot-spot": return { kind: "hot-spot", color: e.color };
    case "ebk": return { kind: "ebk", color: e.color };
    case "shootout": return { kind: "shootout" };
    case "checkmate": return { kind: "checkmate", winner: e.winner };
  }
}
