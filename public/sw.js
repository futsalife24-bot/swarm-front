const CACHE = "swarm-front-shell-v1";
const scope = new URL(self.registration.scope);
const appUrl = new URL("./", scope);
const isAppAsset = (url) =>
  url.origin === scope.origin &&
  url.pathname.startsWith(scope.pathname) &&
  !url.pathname.startsWith(new URL("api/", scope).pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const index = await fetch(appUrl, { cache: "no-cache" });
      await cache.put(appUrl, index.clone());
      const html = await index.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], appUrl))
        .filter(isAppAsset);
      await Promise.all(
        assets.map(async (asset) => {
          const response = await fetch(asset, { cache: "no-cache" });
          if (response.ok) await cache.put(asset, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("swarm-front-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isAppAsset(new URL(request.url))) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) (await caches.open(CACHE)).put(appUrl, response.clone());
          return response;
        })
        .catch(async () => (await caches.match(appUrl)) ?? Response.error()),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then(async (response) => {
          if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
          return response;
        }),
    ),
  );
});
