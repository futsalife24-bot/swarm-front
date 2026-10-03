import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config";

// Review-only prototype build. The normal production entry remains unchanged.
export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: "dist-rebuild",
      rollupOptions: {
        input: fileURLToPath(new URL("./rebuild-p1a.html", import.meta.url)),
      },
    },
  }),
);
