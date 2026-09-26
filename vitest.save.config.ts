import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/save-regression.test.ts",
      "tests/shared-armory.test.ts",
      "tests/armory.test.ts",
      "tests/game.test.ts",
      "tests/p1.test.ts",
      "tests/training.test.ts",
      "tests/playtest.test.ts",
      "tests/playtest-checkpoint.test.ts",
      "tests/playtest-boundaries.test.ts",
      "tests/playtest-economy.test.ts",
    ],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
