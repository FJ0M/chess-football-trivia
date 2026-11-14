import { describe, expect, it } from "vitest";
import { clearMatch, loadMatch, matchLabel, saveMatch } from "./savedMatch";
import { emptyStats } from "./history";
import { newGame, playMove, finishTurn } from "./rules";
import type { SetupChoice } from "./useGame";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

const setup: SetupChoice = {
  options: { mode: "bot", trivia: true, timed: true, minutes: 10, chess960: false, position: 518 },
  players: { white: { name: "You", kind: "human", club: "west-ham" }, black: { name: "Pawny Dribbles", kind: "bot", botId: "pawny", club: "stockport" } },
  botLevel: "medium",
};

describe("saved match", () => {
  it("round-trips a game in progress", () => {
    const store = memStore();
    let g = newGame(setup.options, setup.players, () => 0.3);
    g = finishTurn(playMove(g, "e2e4").state).state;
    saveMatch(setup, g, emptyStats(), store);
    const back = loadMatch(store)!;
    expect(back.game.fen).toBe(g.fen);
    expect(back.setup.players.black.botId).toBe("pawny");
    expect(matchLabel(back)).toBe("vs Pawny Dribbles · move 1");
  });
  it("is removed at full time and on clear", () => {
    const store = memStore();
    const g = newGame(setup.options, setup.players, () => 0.3);
    saveMatch(setup, g, emptyStats(), store);
    expect(loadMatch(store)).not.toBeNull();
    saveMatch(setup, { ...g, outcome: { kind: "resign", winner: "black" } }, emptyStats(), store);
    expect(loadMatch(store)).toBeNull();
    saveMatch(setup, g, emptyStats(), store);
    clearMatch(store);
    expect(loadMatch(store)).toBeNull();
  });
  it("ignores junk", () => {
    const store = memStore();
    store.setItem("cft.match.v1", "{not json");
    expect(loadMatch(store)).toBeNull();
  });
});
