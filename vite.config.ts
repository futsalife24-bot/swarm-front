import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { generateChangelog } from "./scripts/automatic-changelog.mjs";
export default defineConfig({
  define: {
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
  build: { target: "es2022" },
});
