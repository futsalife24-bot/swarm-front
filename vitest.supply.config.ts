import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/supply-*.test.ts",
      "tests/playtest-vault.test.ts",
      "tests/front-buddy-save.test.ts",
      "tests/front-growth-loop.test.ts",
      "tests/front-survival-progression.test.ts",
    ],
    fileParallelism: false,
  },
});
