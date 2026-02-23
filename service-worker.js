const CACHE_NAME = "baby-feeding-monitor-v1.0.0";

// Files to cache for offline use
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  // Music files (optional but recommended)
  "./assets/music/lullaby.mp3",
  "./assets/music/lullaby2.mp3",
  "./assets/music/lullaby3.mp3",

  // Icons (make sure these exist)
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache one by one so one missing file won't fail the whole install
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          // Ignore missing optional files, but log them
          console.warn("[SW] Failed to cache:", url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - For same-origin GET requests: cache-first, then network
// - For navigation requests: try network, fallback to cached index.html
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignore cross-origin requests (firebase/CDN/etc.) unless you want to handle them
  if (url.origin !== self.location.origin) return;

  // HTML navigation: network-first (so updates are fresh), fallback to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          return cached || caches.match("./");
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // Cache successful same-origin responses
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
