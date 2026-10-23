import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import {
  mkdirSync,
  readFileSync,
  copyFileSync,
  statSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, extname, relative } from "node:path";
import { generateChangelog } from "./scripts/automatic-changelog.mjs";
import allowedPaths from "./scripts/orientation-mock-assets.json" with { type: "json" };

const root = fileURLToPath(new URL(".", import.meta.url));
const out = join(root, "dist-orientation-mock");
const allowedExtensions = new Set([
  ".glb",
  ".gltf",
  ".bin",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ogg",
  ".mp3",
  ".wav",
  ".mp4",
  ".webm",
  ".woff",
  ".woff2",
  ".ttf",
]);
export default defineConfig(({ command }) => ({
  appType: "mpa",
  publicDir: false,
  define: {
    __ORIENTATION_MOCK__: true,
    __AUTO_CHANGELOG__: JSON.stringify(
      command === "build" ? generateChangelog(root) : [],
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 5197,
    strictPort: true,
    fs: { deny: ["**/.dev.vars*", "**/.env*", "**/*.{crt,pem}", "**/.git/**"] },
  },
  preview: { host: "127.0.0.1", port: 5197, strictPort: true },
  build: {
    outDir: out,
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: join(root, "orientation-mock.html") },
  },
  plugins: [
    {
      name: "isolated-orientation-mock",
      generateBundle() {
        const modules = [...this.getModuleIds()].map((id) =>
          id.replaceAll("\\", "/"),
        );
        const forbidden = modules.filter((id) =>
          /\/src\/(?:bootstrap\.ts|main\.ts|client\/(?:analytics|app-install|cloud-save|cloud-sync|playtest-app|front-app|training-app|rebuild-app)\.ts)$/.test(
            id,
          ),
        );
        if (forbidden.length)
          this.error(`Forbidden mock dependencies: ${forbidden.join(", ")}`);
        mkdirSync(join(root, "dist-validation"), { recursive: true });
        writeFileSync(
          join(root, "dist-validation/orientation-module-graph.json"),
          JSON.stringify(
            {
              modules: modules
                .filter((id) => id.includes("/src/"))
                .map((id) => relative(root, id)),
              forbidden,
            },
            null,
            2,
          ),
        );
      },
      closeBundle() {
        const assets: { path: string; bytes: number }[] = [];
        const denied = readFileSync(join(root, "public/.assetsignore"), "utf8")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("#"));
        for (const path of allowedPaths) {
          if (
            (!/^(assets\/|rebuild\/upgrades\/)/.test(path) &&
              path !== "icon-swarm-v2-512.png") ||
            path.includes("..") ||
            path.includes("\\") ||
            denied.includes(path) ||
            !allowedExtensions.has(extname(path).toLowerCase())
          )
            throw new Error(`Unapproved mock asset: ${path}`);
          const source = join(root, "public", path);
          const bytes = statSync(source).size;
          if (bytes > 25 * 1024 * 1024)
            throw new Error(`Asset exceeds free static limit: ${source}`);
          const target = join(out, path);
          mkdirSync(join(target, ".."), { recursive: true });
          copyFileSync(source, target);
          assets.push({ path, bytes });
        }
        renameSync(join(out, "orientation-mock.html"), join(out, "index.html"));
        writeFileSync(
          join(out, "_headers"),
          "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n/index.html\n  Cache-Control: no-store\n",
        );
        writeFileSync(
          join(root, "dist-validation/orientation-assets.json"),
          JSON.stringify(
            {
              files: assets.length,
              bytes: assets.reduce((n, a) => n + a.bytes, 0),
              assets,
            },
            null,
            2,
          ),
        );
      },
    },
  ],
}));
