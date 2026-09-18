/* =============================================================================
   service-worker.js  -  OFFLINE SUPPORT

   WHAT IS A SERVICE WORKER?
   -------------------------
   A small script the browser keeps running in the background, separate from
   the page. Once installed it sits between the app and the network and can
   answer requests itself - which is what makes a website work offline and
   installable like a normal app (a "PWA", Progressive Web App).

   WHY IT MATTERS FOR THIS PROJECT
   -------------------------------
   Yaounde has real connectivity gaps, and data costs money. A traveller
   standing in front of the Reunification Monument should still be able to
   read its history after losing signal. This file makes that possible.

   WHAT WENT WRONG BEFORE, AND THE FIX
   ----------------------------------
   The previous version was CACHE-FIRST for the whole app shell, including
   index.html. That is great for offline speed but it has a nasty failure
   mode: after a rebuild, the browser kept serving the OLD index.html (and
   the old JS bundle it points at) straight from the cache, so new code
   never appeared until someone manually cleared site data. The cache
   version was meant to be bumped on every deploy to force it out; that step
   is easy to forget.

   This version fixes it properly:

   1. NAVIGATIONS (loading a page) are NETWORK-FIRST. You always get the
      current index.html when you're online; the cached copy is only a
      fallback for when you're offline. A rebuild is picked up on the next
      online load, with nothing to clear by hand.

   2. API calls are NETWORK-FIRST too - fresh data when possible, last-known
      copy when offline.

   3. Static assets (the hashed JS/CSS, icons, fonts) are
      STALE-WHILE-REVALIDATE: serve the cached copy instantly for speed, but
      fetch a fresh one in the background so the next load is up to date.
      The JS/CSS filenames contain a content hash, so a new build produces
      new filenames and old ones simply age out with the cache.

   4. The cache name is versioned and old versions are deleted on activate,
      so upgrading this file cleans up after the previous one.
============================================================================= */

// Bump this whenever this file changes, so the browser retires the old cache.
const CACHE_NAME = "globetrotter-v2";

// The bare minimum needed to open the app with no network at all.
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/icons.svg", "/manifest.webmanifest"];

// Requests to our own API. These must always try the network first so the
// app shows live data (the global chat, for one, polls constantly).
const API_PATH = /^\/(destinations|favorites|itineraries|recommendations|auth|routing|chat|metrics|health)\b/;

// INSTALL: runs once, when this version of the worker is first registered.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Don't let one missing file abort the whole precache.
      .then((cache) => Promise.allSettled(APP_SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: this version takes over. Bin every cache that isn't ours.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Save a copy of a good response for next time. Only 200-ish, same-origin.
function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

// FETCH: runs for every request the page makes.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET. Never replay logins, saves or deletes from a cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Leave other origins alone (map tiles, fonts, OpenRouteService via the
  // page, Overpass). The browser handles those fine on its own.
  if (url.origin !== self.location.origin) return;

  // ---- 1. Page loads: NETWORK FIRST -------------------------------------
  // This is the line that makes a rebuild actually show up.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/index.html")))
    );
    return;
  }

  // ---- 2. Our API: NETWORK FIRST --------------------------------------
  if (API_PATH.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(() => caches.match(request)) // offline: last good copy
    );
    return;
  }

  // ---- 3. Everything else (assets): STALE WHILE REVALIDATE -------------
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(() => undefined);
      // Cached copy now if we have one; otherwise wait for the network.
      return cached || network;
    })
  );
});
