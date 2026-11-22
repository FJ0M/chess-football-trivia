import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const QUESTIONS = fileURLToPath(new URL("./data/questions.json", import.meta.url));
const PREFIX = "virtual:questions";

/**
 * Splits data/questions.json into one download for the general questions and one per club,
 * so a game only fetches what its two players need (about 1.3 MB down to roughly 150 kB).
 * `import { loadGeneral, loadClub } from "virtual:questions"`; each part is its own chunk.
 */
function splitQuestions(): Plugin {
  type Q = { club: string | null };
  const read = (): Q[] => (JSON.parse(readFileSync(QUESTIONS, "utf8")) as { questions: Q[] }).questions;
  const asModule = (qs: Q[]) => `export default JSON.parse(${JSON.stringify(JSON.stringify(qs))});`;
  return {
    name: "split-questions",
    resolveId(id) {
      return id === PREFIX || id.startsWith(`${PREFIX}/`) ? `\0${id}` : null;
    },
    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return null;
      this.addWatchFile(QUESTIONS);
      const all = read();
      const part = id.slice(`\0${PREFIX}`.length);
      if (part === "") {
        const clubs = [...new Set(all.map((q) => q.club).filter((c): c is string => !!c))].sort();
        const loaders = clubs.map((c) => `  ${JSON.stringify(c)}: () => import(${JSON.stringify(`${PREFIX}/club/${c}`)}),`).join("\n");
        return [
          `const clubs = {\n${loaders}\n};`,
          `export const loadGeneral = () => import("${PREFIX}/general").then((m) => m.default);`,
          `export const loadClub = (id) => (clubs[id] ? clubs[id]().then((m) => m.default) : Promise.resolve([]));`,
        ].join("\n");
      }
      if (part === "/general") return asModule(all.filter((q) => !q.club));
      if (part.startsWith("/club/")) return asModule(all.filter((q) => q.club === part.slice("/club/".length)));
      return null;
    },
  };
}

/**
 * Writes asset-list.json: every built file of this version. The service worker (public/sw.js) uses it
 * to delete files from older versions, so an installed copy doesn't grow with every update.
 */
function assetList(): Plugin {
  return {
    name: "asset-list",
    apply: "build",
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => f.startsWith("assets/")).sort();
      this.emitFile({ type: "asset", fileName: "asset-list.json", source: JSON.stringify({ files }) });
    },
  };
}

// GitHub Pages serves the app from /chess-football-trivia/.
export default defineConfig({
  base: "/chess-football-trivia/",
  plugins: [react(), splitQuestions(), assetList()],
  test: { environment: "jsdom" },
} as never);
