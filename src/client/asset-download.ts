/** Explicit, resumable asset storage. Never reads or writes player saves. */
export const DOWNLOAD_CACHE = "swarm-front-preload-v1";
export const DOWNLOAD_META_CACHE = "swarm-front-preload-meta-v1";
export const DOWNLOAD_HASH = "x-swarm-asset-sha256";
const MAX_FILE_BYTES = 128 * 1024 * 1024;
export interface DownloadAsset {
  url: string;
  bytes: number;
  sha256: string;
}
export interface DownloadPack {
  id: string;
  label: string;
  description: string;
  optional?: boolean;
  assets: DownloadAsset[];
}
export interface DownloadManifest {
  version: 1;
  revision: string;
  packs: DownloadPack[];
}
export interface DownloadProgress {
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

function invalid(): never {
  throw new Error(
    "保存対象の情報が不正です。オンラインで画面を開き直してください。",
  );
}
export function assetUrl(path: string, base: URL) {
  if (
    typeof path !== "string" ||
    path.length > 500 ||
    /[\\#%]/.test(path) ||
    path.startsWith("/") ||
    path.split(/[/?]/).includes("..")
  )
    invalid();
  const url = new URL(path, base);
  const relative = url.pathname.slice(base.pathname.length);
  if (
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname) ||
    url.username ||
    url.password ||
    !/^(?:assets\/[\w./-]+\.(?:js|css|glb|png|webp|jpg|jpeg|wav|mp3|mp4|ttf|woff2?)|rebuild\/upgrades\/[\w-]+\.png|icon-swarm-[\w-]+\.png|index\.html|front\.html|manifest\.webmanifest)$/.test(
      relative,
    )
  )
    invalid();
  return url.href;
}
export function validateDownloadManifest(
  value: unknown,
  base: URL,
): DownloadManifest {
  const m = value as DownloadManifest;
  if (
    !m ||
    m.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(m.revision) ||
    !Array.isArray(m.packs) ||
    m.packs.length < 2 ||
    m.packs.length > 32
  )
    invalid();
  const ids = new Set<string>(),
    files = new Map<string, string>();
  let count = 0,
    bytes = 0;
  for (const p of m.packs) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !/^[a-z0-9-]{1,50}$/.test(p.id) ||
      ids.has(p.id) ||
      typeof p.label !== "string" ||
      p.label.length > 80 ||
      typeof p.description !== "string" ||
      p.description.length > 300 ||
      !Array.isArray(p.assets) ||
      (p.optional !== undefined && typeof p.optional !== "boolean")
    )
      invalid();
    ids.add(p.id);
    for (const a of p.assets) {
      if (
        !a ||
        !Number.isSafeInteger(a.bytes) ||
        a.bytes < 0 ||
        a.bytes > MAX_FILE_BYTES ||
        !/^[a-f0-9]{64}$/.test(a.sha256)
      )
        invalid();
      const url = assetUrl(a.url, base),
        identity = `${a.bytes}:${a.sha256}`;
      if (files.has(url) && files.get(url) !== identity) invalid();
      files.set(url, identity);
      if (++count > 2000 || (bytes += a.bytes) > 2 * 1024 ** 3) invalid();
    }
  }
  if (!ids.has("app") || !ids.has("common")) invalid();
  return m;
}
export function selectedAssets(
  manifest: DownloadManifest,
  ids: ReadonlySet<string>,
) {
  const unique = new Map<string, DownloadAsset>();
  for (const p of manifest.packs)
    if (ids.has(p.id)) for (const a of p.assets) unique.set(a.url, a);
  // Publish an offline entry point only after its supporting files are stored.
  return [...unique.values()].sort(
    (a, b) => Number(/\.html$/.test(a.url)) - Number(/\.html$/.test(b.url)),
  );
}
export function formatDownloadBytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
export class AssetDownloadStore {
  constructor(
    readonly base: URL,
    private readonly storage: CacheStorage = caches,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}
  async manifest(signal: AbortSignal) {
    const url = new URL("asset-download-manifest.json", this.base).href;
    const cache = await this.storage.open(DOWNLOAD_META_CACHE);
    try {
      const response = await this.fetcher(url, { cache: "reload", signal });
      if (!response.ok)
        throw new Error(
          "保存対象を取得できませんでした。通信を確認して開き直してください。",
        );
      const text = await response.text();
      if (text.length > 1_000_000) invalid();
      const manifest = validateDownloadManifest(JSON.parse(text), this.base);
      await cache.put(
        url,
        new Response(text, { headers: { "content-type": "application/json" } }),
      );
      return { manifest, offline: false };
    } catch (error) {
      if (signal.aborted) throw error;
      const cached = await cache.match(url);
      if (!cached) throw error;
      return {
        manifest: validateDownloadManifest(await cached.json(), this.base),
        offline: true,
      };
    }
  }
  async saved(assets: DownloadAsset[]) {
    const cache = await this.storage.open(DOWNLOAD_CACHE),
      result = new Set<string>();
    for (const a of assets) {
      const r = await cache.match(assetUrl(a.url, this.base));
      if (
        r?.headers.get(DOWNLOAD_HASH) === a.sha256 &&
        r.headers.get("content-length") === String(a.bytes)
      )
        result.add(a.url);
    }
    return result;
  }
  private async verified(
    response: Response,
    a: DownloadAsset,
    signal: AbortSignal,
  ) {
    if (response.status !== 200 || !response.body)
      throw new Error(
        "データを取得できませんでした。通信を確認して再開してください。",
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > a.bytes)
          throw new Error(
            "データの版が切り替わりました。画面を開き直して再開してください。",
          );
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    signal.throwIfAborted();
    if (size !== a.bytes)
      throw new Error("データが途中で途切れました。もう一度再開してください。");
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", body)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== a.sha256)
      throw new Error(
        "データの版が一致しません。オンラインで画面を開き直してください。",
      );
    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("vary");
    headers.set("content-length", String(size));
    headers.set(DOWNLOAD_HASH, digest);
    return new Response(body, { headers });
  }
  async download(
    assets: DownloadAsset[],
    signal: AbortSignal,
    report: (p: DownloadProgress) => void,
  ) {
    const cache = await this.storage.open(DOWNLOAD_CACHE);
    const saved = await this.saved(assets);
    let completed = 0,
      bytes = 0;
    const update = () =>
      report({
        completed,
        total: assets.length,
        bytes,
        totalBytes: assets.reduce((sum, a) => sum + a.bytes, 0),
      });
    update();
    for (const a of assets) {
      signal.throwIfAborted();
      const key = assetUrl(a.url, this.base);
      if (!saved.has(a.url)) {
        let response: Response | undefined;
        // Reuse the existing lazy cache only after checking the actual bytes.
        const old = await (
          await this.storage.open("swarm-front-shell-v1")
        ).match(key);
        if (old) {
          try {
            response = await this.verified(old, a, signal);
          } catch {
            signal.throwIfAborted();
          }
        }
        if (!response) {
          const requestUrl = new URL(key);
          // An older controlling SW ignores Request.cache. This also avoids its stale entry.
          requestUrl.searchParams.set("__swarm_asset", a.sha256);
          const fetched = await this.fetcher(requestUrl, {
            cache: "reload",
            signal,
            credentials: "same-origin",
          });
          response = await this.verified(fetched, a, signal);
        }
        signal.throwIfAborted();
        await cache.put(key, response);
      }
      completed++;
      bytes += a.bytes;
      update();
    }
  }
}
