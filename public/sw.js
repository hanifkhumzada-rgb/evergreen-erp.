// Bumped to v2 to force-evict every cache entry poisoned by the bug fixed
// below (see the fetch handler comment) — this alone clears the corrupted
// chunks that were causing "Something went wrong" indefinitely, in every
// tab on this origin, until this deploy.
const CACHE_NAME = "evergreen-shell-v2";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// This app is live-data-only: only the static app shell (icons, manifest, built
// JS/CSS chunks) is ever cached here. Page navigations, RSC payloads, server
// actions, and Supabase calls are always left to the network untouched.
//
// This handler used to cache ANY response for a shell asset — including a
// truncated/failed fetch on a flaky connection, or a 404 for a chunk a since-
// replaced deployment removed — with no expiry, ever (CACHE_NAME was static,
// so the activate handler above never evicted it across deployments). Once a
// chunk's response got poisoned that way, that exact URL stayed broken
// forever for every tab on this origin — installed PWA or a plain browser
// tab alike, since the Cache API is shared per-origin, not per-tab — and
// often survived later deployments too, because a shared/vendor chunk whose
// content didn't change keeps the same content-hashed URL build to build.
// That is what was producing "Something went wrong" on unrelated pages: this
// service worker replaying a corrupted chunk it had cached once, not a live
// server or network problem — which is also why it never showed up in
// server logs and wasn't touched by fixing server-action error handling.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShellAsset = SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/");
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache a complete, successful, same-origin response. Anything
        // else (a dropped-connection failure, a 404 for a retired chunk, a
        // redirect/opaque response) must be left to be retried on the next
        // request, never pinned into the cache permanently.
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
