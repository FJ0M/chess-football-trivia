import { beforeEach, describe, expect, it } from "vitest";
import { loadScores, recordGame, resetScores } from "./scores";
import type { GameState, Outcome } from "./types";

function vsBot(botId: string, outcome: Outcome): GameState {
  const p = (name: string, kind: "human" | "bot", id?: string) => ({ name, kind, botId: id, club: null, form: 0 });
  return { options: { mode: "bot" }, players: { white: p("You", "human"), black: p(botId, "bot", botId) }, outcome } as unknown as GameState;
}

describe("high score: best combined rating beaten", () => {
  beforeEach(() => resetScores());
  const win: Outcome = { kind: "checkmate", winner: "white" };

  it("keeps the strongest bot you've beaten", () => {
    recordGame(vsBot("mo-mate", win), "medium", 5, { chess: 1200, triviaElo: 1490, match: 1249 });
    recordGame(vsBot("pawny", win), "medium", 5, { chess: 400, triviaElo: 1317, match: 388 });
    expect(loadScores().best).toMatchObject({ botId: "mo-mate", match: 1249 });
    recordGame(vsBot("rookland", win), "medium", 5, { chess: 1600, triviaElo: 1269, match: 1572 });
    expect(loadScores().best).toMatchObject({ botId: "rookland", match: 1572, chess: 1600 });
  });

  it("an assisted win still counts, and is marked", () => {
    recordGame(vsBot("rookland", win), "medium", 5, { chess: 1600, triviaElo: 1269, match: 1572 }, new Date(), true);
    expect(loadScores().best).toMatchObject({ botId: "rookland", match: 1572, assisted: true });
    expect(loadScores().bots["rookland:medium"]).toMatchObject({ won: 1 });
  });

  it("doesn't count losses or draws", () => {
    recordGame(vsBot("rookland", { kind: "checkmate", winner: "black" }), "medium", 0, { chess: 1600, triviaElo: 1269, match: 1572 });
    recordGame(vsBot("rookland", { kind: "draw", reason: "stalemate" }), "medium", 0, { chess: 1600, triviaElo: 1269, match: 1572 });
    expect(loadScores().best).toBeUndefined();
    expect(loadScores().bots["rookland:medium"]).toMatchObject({ played: 2, lost: 1, drawn: 1 });
  });
});
