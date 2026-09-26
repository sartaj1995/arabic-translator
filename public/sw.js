/**
 * Service worker for Riyadh Talk.
 *
 * Hand-written rather than generated: the caching rules here are short and the
 * offline story (Phase 3's phrasebook) depends on knowing exactly what is
 * cached and what is not.
 *
 * Bump CACHE_VERSION whenever the precache list changes — the activate handler
 * deletes every cache that does not match, which is what evicts stale shells.
 */

const CACHE_VERSION = "v4";
const SHELL_CACHE = `riyadh-talk-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `riyadh-talk-assets-${CACHE_VERSION}`;

/** Enough to boot the app with no network. */
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  // Precached, not just runtime-cached: the phrasebook is the one thing that
  // has to work on a first offline launch.
  "/phrasebook.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic: one 404 would reject the whole install, so add
      // individually and tolerate misses.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      // Take over immediately rather than waiting for every tab to close.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable; everything else goes straight to the network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Translations must never be served stale, and must never be cached.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first so deploys land, cache as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match("/", { ignoreSearch: true });
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build output is immutable — cache-first is always safe here.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(ASSET_CACHE)).put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Everything else same-origin: serve cache immediately, refresh in the
  // background. Keeps icons and the phrasebook JSON instant and offline-safe.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then(async (res) => {
          if (res.ok) (await caches.open(ASSET_CACHE)).put(request, res.clone());
          return res;
        })
        .catch(() => null);

      return cached ?? (await network) ?? Response.error();
    })(),
  );
});
