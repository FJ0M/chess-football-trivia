// Feeds the game's events to the commentator (commentary.ts) and keeps the latest line.
// After a move it asks the engine for a quick score first; everything else reuses the last score.

import { useEffect, useRef, useState } from "react";
import { comment, type CommentEvent } from "./commentary";
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
  const gameRef = useRef(game);
  gameRef.current = game;
  const namesRef = useRef(names);
  namesRef.current = names;

  const say = (event: CommentEvent, evalCp: number | null, id: number) => {
    // With Pass and Play piece odds, the commentator judges the game against the handicap:
    // the side that gave a piece away isn't "behind" because of it.
    const g = gameRef.current;
    const h = g.options.mode === "local" ? g.options.handicap : null;
    const offset = h ? (h.weaker === "white" ? -1 : 1) * ODDS_POINTS[h.odds] * 100 : 0;
    const c = comment({ event, names: namesRef.current, evalCp: evalCp === null ? null : evalCp + offset, materialCp: materialCp(g.fen) + offset, prevBucket: bucket.current });
    bucket.current = c.bucket;
    setLine({ id, text: c.text });
  };

  useEffect(() => {
    if (enabled && seen.current === 0 && !line) say({ kind: "kickoff" }, null, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const fresh = events.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    if (!enabled) return;
    for (const e of fresh) {
      const ev = toComment(e);
      if (!ev) continue;
      if (e.kind === "move") {
        const fen = gameRef.current.fen;
        evaluate(fen).then((cp) => {
          // Only speak if nothing newer has been said since.
          if (seen.current !== e.id) return;
          lastEval.current = cp;
          say(ev, cp, e.id);
        });
      } else say(ev, lastEval.current, e.id);
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
