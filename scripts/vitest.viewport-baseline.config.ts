import { defineConfig } from "vitest/config";
import { execFileSync } from "node:child_process";

// Negative control only: load the base implementation without touching the tree.
export default defineConfig({
  plugins: [
    {
      name: "viewport-base-negative-control",
      enforce: "pre",
      transform(_source, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/client/battle-loading.ts"))
          return;
        return execFileSync(
          "git",
          ["show", "bce1d032:src/client/battle-loading.ts"],
          { encoding: "utf8" },
        );
      },
    },
  ],
  test: { include: ["tests/front-viewport.test.ts"] },
});
