import { describe, expect, it } from "vitest";
import { HISTORY_MAX, emptyStats, entryFor, loadHistory, recordHistory, resultKind, resultText } from "./history";
import type { GameState, Outcome } from "./types";

function game(mode: "bot" | "local", outcome: Outcome | null): GameState {
  const p = (name: string, kind: "human" | "bot", botId?: string) => ({ name, kind, botId, club: null, form: 0 });
  return {
    options: { mode, trivia: true, timed: false, chess960: false, position: 518 },
    players: { white: p("Freddie", "human"), black: mode === "bot" ? p("Ryan", "bot", "ryan") : p("Ollie", "human") },
    history: new Array(41).fill({}),
    outcome,
  } as unknown as GameState;
}

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe("game history", () => {
  it("builds an entry with result, Form earned and trivia score", () => {
    const stats = emptyStats();
    stats.formEarned.white = 9;
    stats.trivia.white = { right: 7, asked: 9 };
    const e = entryFor(game("bot", { kind: "checkmate", winner: "white" }), stats, "medium", new Date("2026-11-07T12:00:00Z"))!;
    expect(e).toMatchObject({ mode: "bot", you: "white", botId: "ryan", botLevel: "medium", winner: "white", how: "checkmate", moves: 21 });
    expect(e.formEarned.white).toBe(9);
    expect(e.quiz.white).toEqual({ right: 7, asked: 9 });
    expect(resultText(e)).toBe("Won by checkmate");
    expect(resultKind(e)).toBe("won");
    expect(entryFor(game("bot", null), stats, "medium")).toBeNull();
    expect(e.assisted).toBeUndefined();
  });

  it("marks a game where you used Manager's Tip or VAR Review as assisted", () => {
    const stats = emptyStats();
    stats.feats!.white.powerUps = ["golden-boot"];
    expect(entryFor(game("bot", { kind: "checkmate", winner: "white" }), stats, "medium")!.assisted).toBeUndefined();
    stats.feats!.white.powerUps = ["golden-boot", "managers-tip"];
    expect(entryFor(game("bot", { kind: "checkmate", winner: "white" }), stats, "medium")!.assisted).toBe(true);
    // The bot's own use doesn't count against you.
    const botOnly = emptyStats();
    botOnly.feats!.black.powerUps = ["var-review"];
    expect(entryFor(game("bot", { kind: "checkmate", winner: "white" }), botOnly, "medium")!.assisted).toBeUndefined();
  });

  it("words every ending", () => {
    const t = (o: Outcome, mode: "bot" | "local" = "bot") => resultText(entryFor(game(mode, o), emptyStats(), "hard")!);
    expect(t({ kind: "timeout", winner: "black" })).toBe("Lost on time");
    expect(t({ kind: "shootout", winner: "black", score: { white: 3, black: 4 } })).toBe("Lost on penalties 4-3");
    expect(t({ kind: "draw", reason: "fifty-moves" })).toBe("Drawn by the 50-move rule");
    expect(t({ kind: "resign", winner: "black" }, "local")).toBe("Ollie won by resignation");
  });

  it("keeps the newest games first, up to the limit", () => {
    const s = memory();
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      recordHistory(entryFor(game("local", { kind: "checkmate", winner: "white" }), emptyStats(), "", new Date(2026, 0, 1, 0, i))!, s);
    }
    const list = loadHistory(s);
    expect(list).toHaveLength(HISTORY_MAX);
    expect(new Date(list[0].at).getMinutes()).toBe((HISTORY_MAX + 4) % 60);
    expect(loadHistory({ getItem: () => "{bad", setItem: () => {} })).toEqual([]);
  });
});
