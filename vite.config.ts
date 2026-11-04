import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from /chess-football-trivia/.
export default defineConfig({
  base: "/chess-football-trivia/",
  plugins: [react()],
  test: { environment: "jsdom" },
} as never);
