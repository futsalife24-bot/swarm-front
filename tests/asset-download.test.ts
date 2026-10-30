import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  AssetDownloadStore,
  DOWNLOAD_CACHE,
  DOWNLOAD_HASH,
  assetUrl,
  selectedAssets,
  validateDownloadManifest,
  type DownloadAsset,
  type DownloadManifest,
} from "../src/client/asset-download";

const base = new URL("https://game.example/swarm-front/");
const asset = (url: string, body = "data"): DownloadAsset => ({
  url,
  bytes: Buffer.byteLength(body),
  sha256: createHash("sha256").update(body).digest("hex"),
});
const manifest = (assets: DownloadAsset[]): DownloadManifest => ({
  version: 1,
  revision: "a".repeat(64),
  packs: [
    { id: "app", label: "本体", description: "説明", assets: [] },
    { id: "common", label: "共通", description: "説明", assets },
  ],
});
class MemoryCache {
  entries = new Map<string, Response>();
  key(request: RequestInfo | URL) {
    return typeof request === "string"
      ? request
      : request instanceof URL
        ? request.href
        : request.url;
  }
  async match(request: RequestInfo | URL) {
    return this.entries.get(this.key(request))?.clone();
  }
  async put(request: RequestInfo | URL, response: Response) {
    this.entries.set(this.key(request), response.clone());
  }
}
function memory() {
  const buckets = new Map<string, MemoryCache>();
  return {
    buckets,
    storage: {
      open: async (key: string) => {
        if (!buckets.has(key)) buckets.set(key, new MemoryCache());
        return buckets.get(key)!;
      },
    } as unknown as CacheStorage,
  };
}
describe("事前保存の範囲と整合性", () => {
  it.each([
    "https://other.example/assets/file.glb",
    "../assets/file.glb",
    "/assets/file.glb",
    "assets/%2e%2e/api/file.glb",
    "api/save.json",
    "admin/index.html",
    ".dev.vars",
    "assets/file.glb#secret",
    "assets\\file.glb",
  ])("拒否するURL: %s", (url) => expect(() => assetUrl(url, base)).toThrow());
  it("base配下とversion queryを保ち、競合する同一URLの版を拒否する", () => {
    expect(assetUrl("assets/a.glb?v=123", base)).toBe(
      "https://game.example/swarm-front/assets/a.glb?v=123",
    );
    expect(() =>
      validateDownloadManifest(
        manifest([asset("assets/a.glb"), asset("assets/a.glb", "other")]),
        base,
      ),
    ).toThrow();
    expect(() =>
      validateDownloadManifest(
        manifest([{ ...asset("assets/a.glb"), bytes: 129 * 1024 ** 2 }]),
        base,
      ),
    ).toThrow();
  });
  it("重複排除し、HTML公開を依存データ保存の後へ送る", () => {
    const m = manifest([
      asset("index.html"),
      asset("assets/a.glb"),
      asset("front.html"),
      asset("assets/a.glb"),
    ]);
    expect(selectedAssets(m, new Set(["common"])).map((a) => a.url)).toEqual([
      "assets/a.glb",
      "index.html",
      "front.html",
    ]);
  });
  it("初回保存と差分更新: 同じ内容は再取得せず変更分だけ取得する", async () => {
    const mem = memory();
    let content = "data";
    const fetcher = vi.fn(
      async () =>
        new Response(content, {
          headers: { "content-type": "model/gltf-binary" },
        }),
    );
    const store = new AssetDownloadStore(
        base,
        mem.storage,
        fetcher as typeof fetch,
      ),
      signal = new AbortController().signal;
    const first = asset("assets/a.glb");
    await store.download([first], signal, () => {});
    await store.download([first], signal, () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    content = "updated";
    const second = asset(first.url, content);
    await store.download([second], signal, () => {});
    expect(fetcher).toHaveBeenCalledTimes(2);
    const saved = await (
      await mem.storage.open(DOWNLOAD_CACHE)
    ).match(assetUrl(second.url, base));
    expect(await saved!.text()).toBe(content);
    expect(saved!.headers.get(DOWNLOAD_HASH)).toBe(second.sha256);
    expect(fetcher.mock.calls[1]).toBeDefined();
  });
  it("中断後は完了ファイルを保持し、未完了分だけ再開する", async () => {
    const mem = memory(),
      abort = new AbortController();
    const fetcher = vi.fn(async () => new Response("data"));
    const store = new AssetDownloadStore(
      base,
      mem.storage,
      fetcher as typeof fetch,
    );
    const assets = [asset("assets/a.glb"), asset("assets/b.glb")];
    await expect(
      store.download(assets, abort.signal, (p) => {
        if (p.completed === 1) abort.abort();
      }),
    ).rejects.toThrow();
    expect(await store.saved(assets)).toEqual(new Set([assets[0].url]));
    await store.download(assets, new AbortController().signal, () => {});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await store.saved(assets)).size).toBe(2);
  });
  it.each(["bad!", "short", ""])(
    "壊れたレスポンスを完了扱いしない (%s)",
    async (body) => {
      const mem = memory(),
        store = new AssetDownloadStore(
          base,
          mem.storage,
          (async () => new Response(body)) as typeof fetch,
        );
      const a = asset("assets/a.glb");
      await expect(
        store.download([a], new AbortController().signal, () => {}),
      ).rejects.toThrow();
      expect((await store.saved([a])).size).toBe(0);
    },
  );
  it("古い遅延cacheは内容照合して再利用し、壊れた場合はネットから取る", async () => {
    const mem = memory(),
      old = await mem.storage.open("swarm-front-shell-v1");
    await old.put(assetUrl("assets/a.glb", base), new Response("data"));
    await old.put(assetUrl("assets/b.glb", base), new Response("bad!"));
    const fetcher = vi.fn(async () => new Response("data")),
      store = new AssetDownloadStore(
        base,
        mem.storage,
        fetcher as typeof fetch,
      );
    await store.download(
      [asset("assets/a.glb"), asset("assets/b.glb")],
      new AbortController().signal,
      () => {},
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("quota failureを完了にせず、既存のHTMLを置き換えない", async () => {
    const mem = memory(),
      cache = await mem.storage.open(DOWNLOAD_CACHE);
    await cache.put(assetUrl("index.html", base), new Response("old"));
    cache.put = async () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    const store = new AssetDownloadStore(
      base,
      mem.storage,
      (async () => new Response("data")) as typeof fetch,
    );
    const assets = selectedAssets(
      manifest([asset("index.html"), asset("assets/a.glb")]),
      new Set(["common"]),
    );
    await expect(
      store.download(assets, new AbortController().signal, () => {}),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(
      await (await cache.match(assetUrl("index.html", base)))!.text(),
    ).toBe("old");
  });
  it("一覧が取得不能なら検証済みの前回一覧を示すが、最新とはしない", async () => {
    const mem = memory();
    let offline = false;
    const store = new AssetDownloadStore(base, mem.storage, (async () => {
      if (offline) throw new TypeError("offline");
      return Response.json(manifest([asset("assets/a.glb")]));
    }) as typeof fetch);
    expect((await store.manifest(new AbortController().signal)).offline).toBe(
      false,
    );
    offline = true;
    expect((await store.manifest(new AbortController().signal)).offline).toBe(
      true,
    );
  });
});
