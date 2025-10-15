// SABA Service Worker by Malik Softwebs

const CACHE_NAME = "saba-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://i.ibb.co/KxHVdzfx/file-00000000b61061fb9d0784839d8d1309.png"
];

// Install and cache essential files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate and remove old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});

// Handle push notifications
self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  const title = data.title || "SABA";
  const body = data.body || "New notification from Malik Softwebs";
  const icon = "https://i.ibb.co/KxHVdzfx/file-00000000b61061fb9d0784839d8d1309.png";

  event.waitUntil(
    self.registration.showNotification(title, { body, icon })
  );
});