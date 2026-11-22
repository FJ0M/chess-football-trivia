// Offline support. The page itself is fetched fresh when there's a connection (so a new
// version shows straight away) and comes from the cache when there isn't. Built files have
// hashed names and never change, so they come from the cache first. Stockfish, icons and the
// fonts are cached the first time they're used.
const CACHE = "cft-v1";
// Stockfish lives at a fixed path, so it has a cache of its own: change this name when public/stockfish
// is upgraded and installed copies fetch the new engine.
const ENGINE_CACHE = "cft-stockfish-17.1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  const scope = self.registration.scope;
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([scope, `${scope}manifest.webmanifest`]).catch(() => undefined)));
  self.skipWaiting();
});

// The page sends the files it loaded before this worker took over, so they're cached too.
self.addEventListener("message", (e) => {
  const urls = Array.isArray(e.data?.cache) ? e.data.cache : [];
  const scope = self.registration.scope;
  const wanted = urls.filter((u) => typeof u === "string" && (u.startsWith(scope) || FONT_HOSTS.some((h) => u.includes(`//${h}/`))));
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(wanted.map((u) => c.match(u, { ignoreVary: true }).then((hit) => hit ?? c.add(u).catch(() => undefined))))).then(prune));
});

// Built files from older versions are deleted, using this version's list of files (asset-list.json).
// Offline, or without the list, nothing is deleted.
async function prune() {
  const scope = self.registration.scope;
  let files;
  try {
    const res = await fetch(`${scope}asset-list.json`, { cache: "no-store" });
    if (!res.ok) return;
    files = new Set((await res.json()).files.map((f) => `${scope}${f}`));
  } catch { return; }
  if (!files.size) return;
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const url = req.url.split("?")[0];
    // (Stockfish used to share this cache; it has its own now.)
    if ((url.startsWith(`${scope}assets/`) && !files.has(url)) || url.startsWith(`${scope}stockfish/`)) await cache.delete(req);
  }
}

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ENGINE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreVary: true, ignoreSearch: false })) ?? (req.mode === "navigate" ? await cache.match(self.registration.scope) : undefined);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, name = CACHE) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req)); return; }
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (req.mode === "navigate" || path === "" || path === "index.html" || path === "manifest.webmanifest") { e.respondWith(networkFirst(req)); return; }
  if (path.startsWith("stockfish/")) { e.respondWith(cacheFirst(req, ENGINE_CACHE)); return; }
  if (path.startsWith("assets/") || path.startsWith("icons/")) { e.respondWith(cacheFirst(req)); return; }
});
