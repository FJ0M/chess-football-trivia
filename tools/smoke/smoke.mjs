// Browser smoke test: drives the real built app in Chromium, the way a player would.
// It catches the kind of break unit tests miss (playtest 2026-11-09: the bot list fell
// back to three stand-ins and Hot Spots stopped asking questions, with no error shown).
//
//   npm run build && npm run smoke
//
// Checks:
//  1. Play a bot lists all seven ladder bots.
//  2. A game against a bot starts, and the bot answers your move.
//  3. Landing on a Hot Spot brings up the question cards.
//  4. If the bots download fails once, the picker still fills (retry works).

import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4178;
const URL = `http://localhost:${PORT}/chess-football-trivia/`;
const LADDER = ["Pawny Dribbles", "Eezy Peasy", "Billy Chillwall", "Gambit Gary", "Mo Mate", "Florence Knightingale", "Ragnar Rookland"];

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe", detached: true });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("vite preview didn't start")), 20000);
  server.stdout.on("data", (d) => { if (d.toString().includes(String(PORT))) { clearTimeout(t); resolve(); } });
});

const browser = await chromium.launch();
const errors = [];

async function openPicker(page, { load = true } = {}) {
  if (load) await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Play/ }).first().click();
  await page.getByRole("button", { name: /Play a bot/ }).click();
}

try {
  // 1. The bot list.
  // The offline cache (sw.js) is checked on its own at the end; here it would hide the network.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  page.on("pageerror", (e) => errors.push(e.message));
  await openPicker(page);
  await page.waitForSelector(".bot-card", { timeout: 15000 });
  const names = await page.$$eval(".bot-card strong", (els) => els.map((e) => e.textContent));
  check(JSON.stringify(names) === JSON.stringify(LADDER), `bot picker lists the 7 ladder bots (got ${names.join(", ")})`);

  // 2. Start against Pawny, trivia on, and play until the bot has replied and we've hit a Hot Spot.
  await page.getByRole("radio", { name: /Pawny Dribbles/ }).click();
  await page.getByRole("button", { name: "Kick off" }).click();
  await page.waitForSelector(".board button", { timeout: 15000 });
  const board = async () => page.$$eval(".board button", (els) => els.map((e) => e.getAttribute("aria-label")).join("|"));
  const start = await board();

  let botReplied = false;
  let hotSpotCards = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !hotSpotCards) {
    // Answer any question that is ours: first card, first answer.
    const body = await page.innerText("body");
    if (/Hot Spot: pick a question/.test(body) && /You pick\b/.test(body)) { hotSpotCards = true; break; }
    const card = page.locator(".qcard:not([disabled])").first();
    if (await card.count()) { await card.click(); await page.waitForTimeout(300); continue; }
    const answer = page.locator(".answers button:not([disabled])").first();
    if (await answer.count()) { await answer.click(); await page.waitForTimeout(300); continue; }
    if (!/You to move/i.test(body) && !/White to move/.test(body)) { await page.waitForTimeout(400); continue; }

    // Our move: go for a Hot Spot if one of our pieces can reach it, otherwise any quiet move.
    const spots = await page.$$eval(".board button", (els) => els.filter((e) => e.querySelector(".hs")).map((e) => e.getAttribute("aria-label").split(" ")[0]));
    const mine = await page.$$eval(".board button", (els) => els.map((e) => e.getAttribute("aria-label")).filter((l) => / white /.test(l)).map((l) => l.split(" ")[0]));
    let played = false;
    let fallback = null;
    for (const from of mine) {
      await page.locator(`.board button[aria-label^="${from} "]`).click();
      const dests = await page.$$eval(".board button", (els) => els.filter((e) => e.querySelector(".dot")).map((e) => ({ sq: e.getAttribute("aria-label").split(" ")[0], cap: !!e.querySelector(".dot.cap") })));
      const spot = dests.find((d) => spots.includes(d.sq));
      if (spot) { await page.locator(`.board button[aria-label^="${spot.sq}"]`).first().click(); played = true; break; }
      const quiet = dests.find((d) => !d.cap);
      if (quiet && !fallback) fallback = { from, to: quiet.sq };
      await page.locator(`.board button[aria-label^="${from} "]`).click(); // deselect
    }
    if (!played && fallback) {
      await page.locator(`.board button[aria-label^="${fallback.from} "]`).click();
      await page.locator(`.board button[aria-label^="${fallback.to}"]`).first().click();
      played = true;
    }
    if (!played) break;
    await page.waitForTimeout(500);
    // Wait for the bot's reply (or a question for us).
    for (let i = 0; i < 40 && !botReplied; i++) {
      const b = await board();
      if (b.split("|").some((l, k) => / black /.test(l) !== / black /.test(start.split("|")[k]))) botReplied = true;
      else await page.waitForTimeout(500);
    }
  }
  // If the Hot Spot came before the bot had moved, answer it and then wait for the reply.
  if (!botReplied) {
    for (let i = 0; i < 60 && !botReplied; i++) {
      const card = page.locator(".qcard:not([disabled])").first();
      if (await card.count()) await card.click();
      const answer = page.locator(".answers button:not([disabled])").first();
      if (await answer.count()) await answer.click();
      const b = await board();
      if (b.split("|").some((l, k) => / black /.test(l) !== / black /.test(start.split("|")[k]))) botReplied = true;
      else await page.waitForTimeout(500);
    }
  }
  check(botReplied, "the bot answers your move");
  check(hotSpotCards, "landing on a Hot Spot brings up the question cards");
  await page.close();

  // 3. The bots download fails once: the retry still fills the picker.
  const flaky = await browser.newPage({ serviceWorkers: "block" });
  let failedOnce = false;
  // The bots are their own chunk: any index-*.js that index.html doesn't load directly.
  const html = await (await fetch(URL)).text();
  const main = /assets\/(index-[^"]+\.js)/.exec(html)?.[1];
  await flaky.route(/assets\/index-[^/]+\.js$/, (route) => {
    if (!failedOnce && !route.request().url().endsWith(main)) {
      failedOnce = true;
      return route.abort();
    }
    return route.continue();
  });
  // The browser remembers a failed chunk for the life of the page, so after one retry the game
  // reloads itself (this is also what fixes a page left open across a deploy).
  let mainLoads = 0;
  flaky.on("request", (r) => { if (r.url().endsWith(main)) mainLoads++; });
  await openPicker(flaky); // the bots download fails here
  for (let i = 0; i < 40 && mainLoads < 2; i++) await flaky.waitForTimeout(250);
  const didReload = mainLoads >= 2;
  await flaky.waitForLoadState("networkidle");
  await openPicker(flaky, { load: false });
  await flaky.waitForSelector(".bot-card", { timeout: 15000 }).catch(() => undefined);
  check(failedOnce && didReload && (await flaky.locator(".bot-card").count()) === 7, `after a failed bots download the game reloads itself and the bots are back${failedOnce ? "" : " (no failure was injected)"}`);
  await flaky.close();

  // 4. Offline: after one visit, the game opens and a bot plays with no connection.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const off = await ctx.newPage();
  await openPicker(off);
  await off.getByRole("radio", { name: /Pawny Dribbles/ }).click();
  await off.getByRole("button", { name: /Kick off/ }).click();
  await off.waitForSelector(".board .sq", { timeout: 15000 });
  await off.waitForTimeout(3000);
  await off.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => undefined);
  await ctx.setOffline(true);
  await off.reload().catch(() => undefined);
  await off.waitForTimeout(1500);
  const offlineMenu = await off.getByRole("button", { name: /^Play/ }).count();
  let offlineBot = false;
  if (offlineMenu) {
    await openPicker(off, { load: false });
    await off.getByRole("radio", { name: /Pawny Dribbles/ }).click();
    await off.getByRole("button", { name: /Kick off/ }).click();
    await off.waitForSelector(".board .sq", { timeout: 15000 });
    await off.waitForTimeout(2000);
    await off.locator('button.sq[aria-label^="d2"]').click();
    await off.locator('button.sq[aria-label^="d4"]').click();
    for (let i = 0; i < 40 && !offlineBot; i++) {
      const card = off.locator(".qcard:not([disabled])").first();
      if (await card.count()) await card.click();
      const answer = off.locator(".answers button:not([disabled])").first();
      if (await answer.count()) await answer.click();
      offlineBot = /Move 2/.test(await off.locator(".strip").innerText());
      if (!offlineBot) await off.waitForTimeout(500);
    }
  }
  check(offlineMenu > 0 && offlineBot, "offline after one visit: the game opens and the bot plays");
  await ctx.close();

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} finally {
  await browser.close();
  process.kill(-server.pid); // npx and the vite server it started
}

if (failures.length) {
  console.log(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
