// One-time tips for new players (audit, 2026-11-22): each rule is explained the first time it
// matters, in the game, and never again on this device.

import type { Color, GameState } from "./types";
import type { Phase } from "./match";

export type TipId = "how-to-play" | "cards" | "wrong" | "form" | "hot-spots" | "yellow" | "score";

const KEY = "cft.tips.v1";

function store(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function seenTips(): Set<TipId> {
  try { return new Set(JSON.parse(store()?.getItem(KEY) ?? "[]") as TipId[]); } catch { return new Set(); }
}

export function markTip(id: TipId): void {
  const seen = seenTips();
  if (seen.has(id)) return;
  seen.add(id);
  try { store()?.setItem(KEY, JSON.stringify([...seen])); } catch { /* private mode: the tip just shows again */ }
}

export const TIP_TEXT: Record<Exclude<TipId, "how-to-play">, string> = {
  cards: "Pick a card. A Tap-in is safe. A Screamer pays 3 Form, but a wrong answer books the piece you just moved: it can't move on your next turn.",
  wrong: "Wrong answers cost you on harder cards. Two wrong in a row is a yellow card. Four in a row is a red card: -3 Form.",
  form: "You've got Form! Tap Power-ups to spend it. You use a power-up before you move.",
  "hot-spots": "Hot Spots are on the board: the squares with a football. Land on one for a free Puskás: +4 Form, and no harm if you miss.",
  yellow: "Yellow card: that's two wrong in a row. Get the next one right to clear it. Four in a row is a red card (-3 Form).",
  score: "The score at the top counts the pieces each side has taken, by their points: a pawn is 1, a knight or bishop 3, a rook 5, a queen 9.",
};

/** The tip that applies right now for this player, if they haven't seen it. In order of how much it matters. */
export function tipFor(game: GameState, phase: Phase, me: Color, seen: Set<TipId>): Exclude<TipId, "how-to-play"> | null {
  if (!game.options.trivia || game.outcome) return null;
  const p = game.players[me];
  const mine = "color" in phase && phase.color === me;
  const want = (id: Exclude<TipId, "how-to-play">, when: boolean) => (when && !seen.has(id) ? id : null);
  return (
    want("cards", phase.kind === "cards" && mine) ??
    want("wrong", phase.kind === "result" && mine && !phase.correct) ??
    want("yellow", p.wrongStreak >= 2 && phase.kind !== "question") ??
    want("form", phase.kind === "move" && p.form > 0 && game.fen.split(" ")[1] === me[0]) ??
    want("hot-spots", phase.kind === "move" && game.hotSpots.length > 0) ??
    want("score", phase.kind === "move" && game.captured.white.length + game.captured.black.length > 0)
  );
}
