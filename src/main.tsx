import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme/themes.css";
import "./app.css";

// Offline play: cache the game once it has loaded (public/sw.js). Not in development,
// where a cached page would hide your changes.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    // Hand the worker everything loaded so far (it starts after the first page load).
    navigator.serviceWorker.ready.then((reg) => {
      const cache = performance.getEntriesByType("resource").map((e) => e.name);
      reg.active?.postMessage({ cache: [location.href.split("#")[0], ...cache] });
    }).catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
