import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { build as viteBuild } from "vite";
import { collectCurrentAssetPacks } from "../scripts/asset-download-catalog.mjs";
import {
  generateAssetDownloadManifest,
  assetDownloadManifestPlugin,
  ASSET_DOWNLOAD_MANIFEST,
  verifyAssetDownloadManifest,
} from "../scripts/asset-download-manifest.mjs";

const roots: string[] = [];
const digest = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
afterEach(() => {
  for (const root of roots.splice(0)) {
    const prefix = path.join(os.tmpdir(), "swarm-prefetch-manifest-");
    if (!path.resolve(root).startsWith(path.resolve(prefix)))
      throw Error("Unexpected test cleanup root");
    fs.rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "swarm-prefetch-manifest-"),
  );
  roots.push(root);
  fs.mkdirSync(path.join(root, "public/assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/manifest.webmanifest"), "{}");
  fs.writeFileSync(path.join(root, "public/assets/current.bin"), "live");
  const packs = [
    {
      id: "app",
      label: "本体",
      description: "現在版",
      urls: ["manifest.webmanifest"],
    },
    {
      id: "common",
      label: "共通",
      description: "必要素材",
      urls: ["assets/current.bin?rev=1"],
    },
  ];
  const bundle: Record<string, any> = {
    "index.html": { type: "asset", source: "<main>current</main>" },
    "front.html": { type: "asset", source: "<main>front</main>" },
    "assets/main-123.js": { type: "chunk", code: "export const active=1;" },
    "assets/lazy-456.js": { type: "chunk", code: "export const deferred=2;" },
    "assets/main-789.css": { type: "asset", source: "body{color:red}" },
    "assets/main-123.js.map": {
      type: "asset",
      source: "source map is not runtime",
    },
  };
  return { root, packs, bundle };
}
function glb(json: object) {
  let text = JSON.stringify(json);
  text += " ".repeat((4 - (Buffer.byteLength(text) % 4)) % 4);
  const data = Buffer.alloc(20 + Buffer.byteLength(text));
  data.writeUInt32LE(0x46546c67, 0);
  data.writeUInt32LE(2, 4);
  data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(Buffer.byteLength(text), 12);
  data.writeUInt32LE(0x4e4f534a, 16);
  data.write(text, 20);
  return data;
}

describe("事前保存manifestの生成", () => {
  it("現行bundleの全chunk/CSSと両HTMLを含み、古いbuild・原本・mapを拾わない", () => {
    const input = fixture();
    fs.mkdirSync(path.join(input.root, "dist/assets"), { recursive: true });
    fs.writeFileSync(path.join(input.root, "dist/assets/stale.js"), "old");
    fs.writeFileSync(
      path.join(input.root, "public/assets/source.blend"),
      "source",
    );
    const before = JSON.stringify(input.bundle);
    const manifest = generateAssetDownloadManifest(input);
    const app = manifest.packs.find((p: any) => p.id === "app")!;
    expect(app.assets.map((a: any) => a.url)).toEqual(
      expect.arrayContaining([
        "index.html",
        "front.html",
        "assets/main-123.js",
        "assets/lazy-456.js",
        "assets/main-789.css",
      ]),
    );
    expect(app.assets.some((a: any) => /stale|blend|\.map$/.test(a.url))).toBe(
      false,
    );
    const main = app.assets.find((a: any) => a.url === "assets/main-123.js")!;
    expect(main.bytes).toBe(Buffer.byteLength(input.bundle[main.url].code));
    expect(main.sha256).toBe(digest(input.bundle[main.url].code));
    expect(JSON.stringify(input.bundle)).toBe(before);
  });
  it("同一入力は同じrevisionで、同長の素材変更でもhash/revisionが変わる", () => {
    const input = fixture();
    const first = generateAssetDownloadManifest(input);
    expect(generateAssetDownloadManifest(input)).toEqual(first);
    fs.writeFileSync(
      path.join(input.root, "public/assets/current.bin"),
      "next",
    );
    const changed = generateAssetDownloadManifest(input);
    expect(changed.revision).not.toBe(first.revision);
    expect(changed.packs[1].assets[0].bytes).toBe(
      first.packs[1].assets[0].bytes,
    );
    expect(changed.packs[1].assets[0].sha256).not.toBe(
      first.packs[1].assets[0].sha256,
    );
  });
  it("URLのqueryを保持し、実bytesとSHAは実ファイルから得る", () => {
    const input = fixture();
    const row = generateAssetDownloadManifest(input).packs[1].assets[0];
    expect(row).toEqual({
      url: "assets/current.bin?rev=1",
      bytes: 4,
      sha256: digest("live"),
    });
  });
  it("欠損を無視せず失敗し、両HTMLのないbuildも生成しない", () => {
    const input = fixture();
    delete input.bundle["front.html"];
    expect(() => generateAssetDownloadManifest(input)).toThrow(
      /index.html and front.html/,
    );
    fs.unlinkSync(path.join(input.root, "public/assets/current.bin"));
    expect(() =>
      generateAssetDownloadManifest({ ...input, development: true }),
    ).toThrow(/Missing or unreadable runtime asset/);
  });
  it.each([
    "../secret",
    "%2e%2e/secret",
    "https://example.com/file",
    "/absolute",
    "assets\\current.bin",
  ])("対象外パス%sを拒否する", (url) => {
    const input = fixture();
    input.packs[1].urls = [url];
    expect(() => generateAssetDownloadManifest(input)).toThrow(/Invalid asset/);
  });
  it("GLBが参照する外部buffer/textureも同じpackに含める", () => {
    const input = fixture();
    fs.writeFileSync(
      path.join(input.root, "public/assets/live.glb"),
      glb({
        asset: { version: "2.0" },
        buffers: [{ uri: "current.bin", byteLength: 4 }],
        images: [{ uri: "color.png" }],
      }),
    );
    fs.writeFileSync(path.join(input.root, "public/assets/color.png"), "image");
    input.packs[1].urls = ["assets/live.glb"];
    expect(
      generateAssetDownloadManifest(input).packs[1].assets.map(
        (a: any) => a.url,
      ),
    ).toEqual(["assets/color.png", "assets/current.bin", "assets/live.glb"]);
    fs.unlinkSync(path.join(input.root, "public/assets/color.png"));
    expect(() => generateAssetDownloadManifest(input)).toThrow(/color.png/);
  });
  it("remote依存を持つGLBを黙って完全保存扱いしない", () => {
    const input = fixture();
    fs.writeFileSync(
      path.join(input.root, "public/assets/live.glb"),
      glb({
        asset: { version: "2.0" },
        buffers: [{ uri: "https://example.com/data.bin" }],
      }),
    );
    input.packs[1].urls = ["assets/live.glb"];
    expect(() => generateAssetDownloadManifest(input)).toThrow(
      /External runtime GLB dependency/,
    );
  });
  it("開発server本体を誤ったraw HTML hashで保存済みにしない", () => {
    const input = fixture();
    const manifest = generateAssetDownloadManifest({
      ...input,
      development: true,
    });
    expect(manifest.packs[0].assets).toEqual([]);
    expect(manifest.packs[0].description).toContain(
      "開発サーバー本体は事前保存対象外",
    );
    expect(manifest.packs[1].assets[0].sha256).toBe(digest("live"));
  });
  it("現行実参照を使い、不要な旧版・旧モード・任意mediaを共通へ混ぜない", () => {
    const packs = collectCurrentAssetPacks(process.cwd());
    expect(packs.map((p: any) => p.id)).toEqual([
      "app",
      "common",
      "map-0",
      "map-1",
      "map-2",
      "map-3",
      "map-4",
      "map-5",
      "map-survival-0",
      "bgm",
      "movies",
    ]);
    const common = packs.find((p: any) => p.id === "common")!.urls;
    expect(
      common.some((url: string) => /swarm-soldier\.glb\?v=[a-f0-9]+/.test(url)),
    ).toBe(true);
    expect(common).toContain(
      "assets/enemies/foundry_zero_mechanical_legs_v2.glb",
    );
    expect(
      common.some((url: string) =>
        /standard_trooper|progression-v1|armory_v2|\.blend|\.mp[34]/.test(url),
      ),
    ).toBe(false);
    expect(packs.filter((p: any) => p.optional).map((p: any) => p.id)).toEqual([
      "bgm",
      "movies",
    ]);
    expect(packs[0].urls).toContain("icon-swarm-v2-512.png");
    expect(packs.find((p: any) => p.id === "map-survival-0")!.urls).toEqual([
      "assets/maps/defense_0_v2.glb",
    ]);
  });
  it("generateBundleは名前だけ予約し、writeなしの不完全manifestを成功扱いしない", () => {
    const plugin = assetDownloadManifestPlugin();
    plugin.configResolved({ root: process.cwd() });
    const bundle = fixture().bundle;
    const emitted: any[] = [];
    const context = { emitFile: (value: any) => emitted.push(value) };
    plugin.generateBundle.call(context, {}, bundle, true);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe(ASSET_DOWNLOAD_MANIFEST);
    expect(JSON.parse(emitted[0].source).revision).toBe("pending-build");
    expect(() =>
      plugin.generateBundle.call(context, {}, bundle, false),
    ).toThrow(/requires a written build/);
  });
  it("実Viteのpreload・後続generate・diskだけの変更後も全現物bytes/SHAが一致する", async () => {
    const { root, packs } = fixture();
    fs.writeFileSync(
      path.join(root, "index.html"),
      '<script type="module" src="/entry.js"></script>',
    );
    fs.writeFileSync(
      path.join(root, "front.html"),
      '<script type="module" src="/front.js"></script>',
    );
    fs.writeFileSync(
      path.join(root, "entry.js"),
      'document.body.addEventListener("click",()=>import("./lazy.js").then(m=>m.run()));',
    );
    fs.writeFileSync(
      path.join(root, "front.js"),
      'document.body.dataset.mode="front";',
    );
    fs.writeFileSync(
      path.join(root, "lazy.js"),
      'import "./lazy.css";export function run(){document.body.dataset.lazy="loaded";}',
    );
    fs.writeFileSync(
      path.join(root, "lazy.css"),
      "body{background:rebeccapurple}",
    );
    const output = path.join(root, "output");
    await viteBuild({
      root,
      configFile: false,
      envFile: false,
      base: "/swarm-test/",
      logLevel: "silent",
      plugins: [
        assetDownloadManifestPlugin({ packs }),
        {
          name: "test-late-generate-rewrite",
          enforce: "post",
          generateBundle: {
            order: "post",
            handler(_options: any, bundle: any) {
              for (const entry of Object.values(bundle) as any[])
                if (entry.type === "chunk")
                  entry.code += "\n/*late generate rewrite*/";
            },
          },
        },
        {
          name: "test-disk-only-rewrite",
          enforce: "post",
          writeBundle: {
            order: "pre",
            handler(options: any, bundle: any) {
              for (const [name, entry] of Object.entries(bundle) as [
                string,
                any,
              ][])
                if (entry.type === "chunk")
                  fs.appendFileSync(
                    path.join(options.dir, name),
                    "\n/*late disk-only rewrite*/",
                  );
            },
          },
        },
      ],
      build: {
        outDir: output,
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
          input: {
            legacy: path.join(root, "index.html"),
            front: path.join(root, "front.html"),
          },
        },
      },
    });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(output, ASSET_DOWNLOAD_MANIFEST), "utf8"),
    );
    expect(manifest.revision).toMatch(/^[a-f0-9]{64}$/);
    const rows = manifest.packs.flatMap((pack: any) => pack.assets);
    for (const asset of rows) {
      const actual = fs.readFileSync(
        path.join(output, asset.url.split("?")[0]),
      );
      expect(actual.length, asset.url).toBe(asset.bytes);
      expect(digest(actual), asset.url).toBe(asset.sha256);
      expect(asset.url.startsWith("/")).toBe(false);
    }
    expect(verifyAssetDownloadManifest(output).checked).toBe(rows.length);
    expect(fs.readFileSync(path.join(output, "index.html"), "utf8")).toContain(
      "/swarm-test/assets/",
    );
    const scripts = rows.filter((row: any) => row.url.endsWith(".js"));
    const code = scripts.map((row: any) =>
      fs.readFileSync(path.join(output, row.url), "utf8"),
    );
    expect(code.some((text: string) => text.includes("__vite__mapDeps"))).toBe(
      true,
    );
    expect(
      code.every(
        (text: string) =>
          text.includes("late generate rewrite") &&
          text.includes("late disk-only rewrite"),
      ),
    ).toBe(true);
    fs.appendFileSync(
      path.join(output, scripts[0].url),
      "\n/*unexpected final change*/",
    );
    expect(() => verifyAssetDownloadManifest(output)).toThrow(
      /Final asset bytes\/hash mismatch/,
    );
  });
  it("BASE付きdev endpointで同schemaを返し、HEAD/別URLを処理する", () => {
    const plugin = assetDownloadManifestPlugin();
    plugin.configResolved({ root: process.cwd() });
    let middleware: any;
    const watcher = new EventEmitter(),
      httpServer = new EventEmitter();
    plugin.configureServer({
      config: { base: "/swarm/" },
      watcher,
      httpServer,
      middlewares: {
        use: (handler: any) => {
          middleware = handler;
        },
      },
    });
    const respond = (url: string, method = "GET") => {
      const headers: Record<string, string> = {};
      let body: string | undefined,
        passed = false;
      const response: any = {
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
        end: (value?: string) => {
          body = value;
        },
      };
      middleware({ url, method }, response, () => {
        passed = true;
      });
      return { headers, body, passed, status: response.statusCode };
    };
    const response = respond("/swarm/asset-download-manifest.json?v=1");
    expect(response.status).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(JSON.parse(response.body!).version).toBe(1);
    expect(
      respond("/swarm/asset-download-manifest.json", "HEAD").body,
    ).toBeUndefined();
    expect(respond("/elsewhere").passed).toBe(true);
    httpServer.emit("close");
    expect(watcher.listenerCount("change")).toBe(0);
  });
});
