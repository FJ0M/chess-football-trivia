import { afterEach, describe, expect, it, vi } from "vitest";
import { BOT_NAMES, LADDER_BOT_IDS, botList, importWithRetry, loadBots, resetBotsForTest } from "./bots";

afterEach(() => resetBotsForTest());

/** createBot with a do-nothing engine, so no Stockfish worker is started in tests. */
const noEngine = { analyse: async () => [] };
const make = (mod: Awaited<ReturnType<typeof loadBots>>, id: string) =>
  (mod.createBot as unknown as (id: string, level: string, engine: unknown) => { promotionPick(): string })(id, "medium", noEngine);

describe("the bot picker list (playtest 2026-11-09: 'where have all the bots gone?')", () => {
  it("loads all seven ladder bots, weakest first, and none of the retired three", async () => {
    const list = botList(await loadBots());
    expect(list.map((b) => b.id)).toEqual([...LADDER_BOT_IDS]);
    for (const b of list) {
      expect(b.name).toBe(BOT_NAMES[b.id]);
      expect(b.fixedLevel).toBe(true);
      expect(b.ratings?.medium.chess).toBeGreaterThan(0);
    }
    expect(list.map((b) => b.id)).not.toContain("ryan");
  });

  it("every listed bot can be created", async () => {
    const mod = await loadBots();
    for (const b of botList(mod)) expect(make(mod, b.id).promotionPick()).toMatch(/^[qrbn]$/);
  });

  it("a retired bot from an old saved setup still gets an opponent", async () => {
    const mod = await loadBots();
    expect(() => make(mod, "ryan")).not.toThrow();
  });
});

describe("downloading parts of the game", () => {
  it("retries a failed download once", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("ok");
    const reload = vi.fn();
    await expect(importWithRetry(load, { retryMs: 1, reload })).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads the page (once) when the download keeps failing, and says so instead of carrying on quietly", async () => {
    const load = vi.fn().mockRejectedValue(new Error("chunk gone after a deploy"));
    const reload = vi.fn();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(importWithRetry(load, { retryMs: 1, reload })).rejects.toThrow("chunk gone");
    expect(reload).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it("doesn't remember a failed bots download, so trying again works", async () => {
    vi.useFakeTimers();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sessionStorage.setItem("ttic-chunk-reload", String(Date.now())); // no real reload in the test
    const failing = loadBots(() => Promise.reject(new Error("offline")));
    const caught = failing.catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await caught).toBeInstanceOf(Error);
    vi.useRealTimers();
    const list = botList(await loadBots());
    expect(list).toHaveLength(7);
    err.mockRestore();
  });
});
