import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/playtest-vault.test.ts",
      "tests/front-growth-loop.test.ts",
      "tests/front-campaign-receipt.test.ts",
      "tests/shared-armory.test.ts",
      "tests/save-regression.test.ts",
    ],
    pool: "threads",
    fileParallelism: false,
    testTimeout: 30000,
  },
});
