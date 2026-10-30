const CACHE = "swarm-front-shell-v1";
const PRELOAD = "swarm-front-preload-v1";
const scope = new URL(self.registration.scope);
const appUrl = new URL("./", scope);
const adminUrl = new URL("admin/", scope);
const adminPath = new URL("admin", scope).pathname;
const briefingUrl = new URL("briefing/", scope);
const briefingPath = new URL("briefing", scope).pathname;
const isAppAsset = (url) =>
  url.origin === scope.origin &&
  url.pathname.startsWith(scope.pathname) &&
  url.pathname !== adminPath &&
  !url.pathname.startsWith(adminUrl.pathname) &&
  url.pathname !== briefingPath &&
  url.pathname !== new URL("rebuild-p1a.html", scope).pathname &&
  url.pathname !== new URL("rebuild-p1a", scope).pathname &&
  url.pathname !== new URL("rebuild-p1a/", scope).pathname &&
  !url.pathname.startsWith(briefingUrl.pathname) &&
  !url.pathname.startsWith(new URL("api/", scope).pathname);

const navigationKey = (url) => {
  const path = url.pathname.slice(scope.pathname.length);
  if (["", "index.html"].includes(path))
    return new URL("index.html", scope).href;
  if (["front", "front/", "front.html"].includes(path))
    return new URL("front.html", scope).href;
  return url.href;
};
const cachedAsset = async (key) =>
  (await (await caches.open(PRELOAD)).match(key)) ??
  (await (await caches.open(CACHE)).match(key));

// Media requests use Range even offline. Serve a bounded single byte range
// from a complete cached file; never store a partial response as a full asset.
async function cachedRange(request, response) {
  const range = request.headers.get("range");
  if (!range) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return fetch(request);
  const body = await response.arrayBuffer(),
    length = body.byteLength;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (start > end || start >= length)
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${length}` },
    });
  const headers = new Headers(response.headers);
  headers.set("content-range", `bytes ${start}-${end}/${length}`);
  headers.set("content-length", String(end - start + 1));
  headers.set("accept-ranges", "bytes");
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

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
          .filter(
            (key) => key.startsWith("swarm-front-shell-") && key !== CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !isAppAsset(url)) return;
  // Explicit downloads must verify fresh server bytes, including an updated
  // file that retained its URL. Their caller owns the verified cache write.
  if (
    (request.cache === "reload" && request.mode !== "navigate") ||
    url.searchParams.has("__swarm_asset") ||
    url.pathname === new URL("sw.js", scope).pathname
  )
    return;
  // The installed app must be able to discover updated display/orientation
  // settings; an indefinitely cached manifest keeps the old window mode.
  if (
    request.mode === "navigate" ||
    url.pathname === new URL("manifest.webmanifest", scope).pathname ||
    url.pathname === new URL("asset-download-manifest.json", scope).pathname
  ) {
    const cacheKey = request.mode === "navigate" ? navigationKey(url) : request;
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            try {
              await (await caches.open(CACHE)).put(cacheKey, response.clone());
            } catch {
              /* Storage failure must not block navigation. */
            }
          }
          return response;
        })
        .catch(
          async () =>
            (await cachedAsset(cacheKey)) ??
            (cacheKey === new URL("index.html", scope).href
              ? await (await caches.open(CACHE)).match(appUrl)
              : undefined) ??
            Response.error(),
        ),
    );
    return;
  }
  event.respondWith(
    cachedAsset(request).then((cached) =>
      cached
        ? cachedRange(request, cached)
        : fetch(request).then(async (response) => {
            // Streaming audio may return 206; Cache API rejects partial responses.
            if (response.status === 200) {
              try {
                await (await caches.open(CACHE)).put(request, response.clone());
              } catch {
                // Quota/storage failures must not block an available audio stream.
              }
            }
            return response;
          }),
    ),
  );
});
