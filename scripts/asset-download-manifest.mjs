import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { collectCurrentAssetPacks } from "./asset-download-catalog.mjs";

export const ASSET_DOWNLOAD_MANIFEST = "asset-download-manifest.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function relativeUrl(url) {
  if (
    typeof url !== "string" ||
    !url.length ||
    url.startsWith("/") ||
    url.includes("\\") ||
    url.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(url)
  )
    throw new Error(`Invalid asset URL: ${url}`);
  const pathname = decodeURIComponent(url.split("?")[0]);
  if (
    pathname.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(`Invalid asset path: ${url}`);
  return pathname;
}
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
function glbDependencies(data, url) {
  if (!url.split("?")[0].endsWith(".glb")) return [];
  if (
    data.length < 20 ||
    data.readUInt32LE(0) !== 0x46546c67 ||
    data.readUInt32LE(4) !== 2 ||
    data.readUInt32LE(8) !== data.length ||
    data.readUInt32LE(16) !== 0x4e4f534a
  )
    throw new Error(`Invalid runtime GLB: ${url}`);
  const length = data.readUInt32LE(12);
  if (length > data.length - 20)
    throw new Error(`Truncated runtime GLB: ${url}`);
  const json = JSON.parse(
    data
      .subarray(20, 20 + length)
      .toString("utf8")
      .trim(),
  );
  return [...(json.buffers ?? []), ...(json.images ?? [])].flatMap(
    ({ uri }) => {
      if (!uri || uri.startsWith("data:")) return [];
      const resolved = new URL(uri, `https://runtime-assets.invalid/${url}`);
      if (resolved.origin !== "https://runtime-assets.invalid" || resolved.hash)
        throw new Error(`External runtime GLB dependency: ${url}`);
      const relative = resolved.pathname.slice(1) + resolved.search;
      if (
        !/\.(?:bin|png|jpe?g|webp|avif|ktx2?|basis|gltf|glb)(?:\?|$)/i.test(
          relative,
        )
      )
        throw new Error(`Unsupported GLB dependency: ${relative}`);
      return [relative];
    },
  );
}

/** Deterministic generation only: reads inputs, returns data, writes no files. */
export function generateAssetDownloadManifest({
  root = process.cwd(),
  bundle,
  assetRoot,
  development = false,
  packs = collectCurrentAssetPacks(root),
} = {}) {
  const publicRoot = fs.realpathSync(assetRoot ?? path.join(root, "public"));
  const inspected = new Map();
  const inspect = (url) => {
    if (inspected.has(url)) return inspected.get(url);
    const pathname = relativeUrl(url);
    const file = path.resolve(publicRoot, pathname);
    if (!inside(publicRoot, file))
      throw new Error(`Asset escapes public root: ${url}`);
    let real, data;
    try {
      real = fs.realpathSync(file);
      if (!inside(publicRoot, real))
        throw new Error("symlink escapes public root");
      data = fs.readFileSync(real);
    } catch (error) {
      throw new Error(`Missing or unreadable runtime asset: ${url}`, {
        cause: error,
      });
    }
    const result = {
      row: { url, bytes: data.length, sha256: sha256(data) },
      dependencies: glbDependencies(data, url),
    };
    inspected.set(url, result);
    return result;
  };
  const shell = new Map();
  if (!development) {
    if (!bundle || !bundle["index.html"] || !bundle["front.html"])
      throw new Error(
        "Current build must emit index.html and front.html before asset manifest generation",
      );
    for (const [name, output] of Object.entries(bundle)) {
      if (name === ASSET_DOWNLOAD_MANIFEST || name.endsWith(".map")) continue;
      relativeUrl(name);
      const data = output.type === "chunk" ? output.code : output.source;
      if (typeof data !== "string" && !(data instanceof Uint8Array))
        throw new Error(`Missing current bundle bytes: ${name}`);
      const buffer =
        typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
      shell.set(name, {
        url: name,
        bytes: buffer.length,
        sha256: sha256(buffer),
      });
    }
  }
  const ids = new Set();
  const result = packs.map(({ id, label, description, optional, urls }) => {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id))
      throw new Error(`Invalid or duplicate pack ID: ${id}`);
    ids.add(id);
    const assets = new Map();
    if (!(development && id === "app")) {
      const queue = [...urls];
      while (queue.length) {
        const url = queue.shift();
        if (assets.has(url)) continue;
        if (assets.size >= 10000)
          throw new Error(`Too many runtime dependencies: ${id}`);
        const { row, dependencies } = inspect(url);
        assets.set(url, row);
        queue.push(...dependencies);
      }
      if (id === "app")
        for (const [url, row] of shell) {
          if (assets.has(url))
            throw new Error(`Bundle/public URL collision: ${url}`);
          assets.set(url, row);
        }
    }
    return {
      id,
      label,
      description:
        development && id === "app"
          ? "開発サーバー本体は事前保存対象外です。buildで現行HTML/JS/CSSを生成します。"
          : description,
      ...(optional === undefined ? {} : { optional }),
      assets: [...assets.values()].sort((a, b) =>
        a.url.localeCompare(b.url, "en"),
      ),
    };
  });
  if (!ids.has("app") || !ids.has("common"))
    throw new Error("app/common packs are required");
  const content = { version: 1, packs: result };
  return {
    version: 1,
    revision: sha256(JSON.stringify(content)),
    packs: result,
  };
}

/** Audit actual final files, including public copies, not mutable chunk objects. */
export function verifyAssetDownloadManifest(outputDir) {
  const directory = fs.realpathSync(outputDir);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, ASSET_DOWNLOAD_MANIFEST), "utf8"),
  );
  if (
    manifest.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.revision) ||
    !Array.isArray(manifest.packs)
  )
    throw new Error("Final asset manifest is incomplete");
  let checked = 0;
  const failures = [];
  for (const pack of manifest.packs)
    for (const asset of pack.assets) {
      try {
        const file = fs.realpathSync(
          path.resolve(directory, relativeUrl(asset.url)),
        );
        if (!inside(directory, file)) throw new Error("output path escape");
        const bytes = fs.readFileSync(file);
        checked++;
        if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256)
          failures.push(asset.url);
      } catch {
        failures.push(asset.url);
      }
    }
  if (failures.length)
    throw new Error(
      `Final asset bytes/hash mismatch (${failures.length}): ${failures.slice(0, 5).join(", ")}`,
    );
  return { checked, revision: manifest.revision };
}
function bundleFromWrittenFiles(directory, bundle) {
  return Object.fromEntries(
    Object.keys(bundle)
      .filter(
        (name) => name !== ASSET_DOWNLOAD_MANIFEST && !name.endsWith(".map"),
      )
      .map((name) => {
        const file = fs.realpathSync(
          path.resolve(directory, relativeUrl(name)),
        );
        if (!inside(directory, file))
          throw new Error(`Bundle output path escape: ${name}`);
        return [name, { type: "asset", source: fs.readFileSync(file) }];
      }),
  );
}
function writeManifest(directory, manifest) {
  const destination = path.join(directory, ASSET_DOWNLOAD_MANIFEST);
  const temporary = path.join(
    directory,
    `.${ASSET_DOWNLOAD_MANIFEST}.${process.pid}.tmp`,
  );
  fs.writeFileSync(temporary, JSON.stringify(manifest, null, 2) + "\n");
  try {
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Build output plus dev middleware share the same versioned manifest schema. */
export function assetDownloadManifestPlugin({ packs } = {}) {
  let root = process.cwd(),
    configuredOutput = path.resolve(root, "dist");
  const written = new Map();
  return {
    name: "swarm-current-asset-download-manifest",
    enforce: "post",
    configResolved(config) {
      root = config.root;
      configuredOutput = path.resolve(root, config.build?.outDir ?? "dist");
    },
    buildStart() {
      written.clear();
    },
    generateBundle(_options, _bundle, isWrite) {
      if (isWrite === false)
        throw new Error(
          "Asset download manifest requires a written build for final-byte verification",
        );
      // Reserve the output name. Vite's later preload analysis still rewrites JS.
      // An incomplete placeholder is never a valid downloadable manifest.
      this.emitFile({
        type: "asset",
        fileName: ASSET_DOWNLOAD_MANIFEST,
        source:
          JSON.stringify({ version: 1, revision: "pending-build", packs: [] }) +
          "\n",
      });
    },
    writeBundle: {
      order: "post",
      sequential: true,
      handler(options, bundle) {
        const directory = fs.realpathSync(
          options.dir
            ? path.resolve(root, options.dir)
            : options.file
              ? path.dirname(path.resolve(root, options.file))
              : configuredOutput,
        );
        const outputs = { ...written.get(directory), ...bundle };
        const diskBundle = bundleFromWrittenFiles(directory, outputs);
        const manifest = generateAssetDownloadManifest({
          root,
          assetRoot: directory,
          bundle: diskBundle,
          ...(packs ? { packs } : {}),
        });
        writeManifest(directory, manifest);
        if (bundle[ASSET_DOWNLOAD_MANIFEST])
          bundle[ASSET_DOWNLOAD_MANIFEST].source =
            JSON.stringify(manifest, null, 2) + "\n";
        written.set(directory, outputs);
        verifyAssetDownloadManifest(directory);
      },
    },
    closeBundle: {
      order: "post",
      sequential: true,
      handler(error) {
        if (error) return;
        // A later writer must fail the build, never leave a silently stale hash.
        for (const directory of written.keys())
          verifyAssetDownloadManifest(directory);
      },
    },
    configureServer(server) {
      let cached;
      const invalidate = () => {
        cached = undefined;
      };
      const events = ["change", "add", "unlink"];
      for (const event of events) server.watcher.on(event, invalidate);
      server.httpServer?.once("close", () => {
        for (const event of events) server.watcher.off(event, invalidate);
      });
      const base =
        server.config.base === "./"
          ? "/"
          : new URL(server.config.base, "http://localhost").pathname;
      const endpoint = `${base.endsWith("/") ? base : base + "/"}${ASSET_DOWNLOAD_MANIFEST}`;
      server.middlewares.use((request, response, next) => {
        if (
          !["GET", "HEAD"].includes(request.method ?? "GET") ||
          request.url?.split("?")[0] !== endpoint
        )
          return next();
        try {
          cached ??= JSON.stringify(
            generateAssetDownloadManifest({
              root,
              development: true,
              ...(packs ? { packs } : {}),
            }),
          );
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(request.method === "HEAD" ? undefined : cached);
        } catch (error) {
          cached = undefined;
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(
            JSON.stringify({ error: String(error.message ?? error) }),
          );
        }
      });
    },
  };
}
