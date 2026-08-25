const CACHE_NAME = "cat-fight-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./src/game.js",
  "./manifest.webmanifest",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg",
  "./assets/cats/sunny-tabby.svg",
  "./assets/cats/misty-shorthair.svg",
  "./assets/cats/midnight-shadow.svg",
  "./assets/cats/peaches-calico.svg",
  "./assets/cats/snowball-puff.svg",
  "./assets/cats/cocoa-stripe.svg",
  "./assets/cats/lilac-whiskers.svg",
  "./assets/cats/muffin-white-tabby.svg",
  "./assets/cats/lilith-black-longhair.svg",
  "./assets/cats/minty-paws.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const isNavigation = event.request.mode === "navigate";
      try {
        const response = await fetch(event.request);
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (isNavigation) {
          return caches.match("./index.html");
        }
        return new Response("Offline asset unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});
