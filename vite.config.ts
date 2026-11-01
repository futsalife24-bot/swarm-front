import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { generateChangelog } from "./scripts/automatic-changelog.mjs";
import { assetDownloadManifestPlugin } from "./scripts/asset-download-manifest.mjs";
export default defineConfig({
  plugins: [assetDownloadManifestPlugin()],
  define: {
    __SWARM_BUILD__: JSON.stringify(
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    ),
    __AUTO_CHANGELOG__: JSON.stringify(
      generateChangelog(fileURLToPath(new URL(".", import.meta.url))),
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 5186,
    strictPort: true,
    fs: { deny: ["**/.dev.vars*", "**/.env*", "**/*.{crt,pem}", "**/.git/**"] },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        legacy: fileURLToPath(new URL("./index.html", import.meta.url)),
        front: fileURLToPath(new URL("./front.html", import.meta.url)),
      },
    },
  },
});
