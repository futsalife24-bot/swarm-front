import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/standard-trooper.test.ts",
      "tests/hound-motion.test.ts",
      "tests/structure-motion.test.ts",
      "tests/maps.test.ts",
      "tests/structure-v2.test.ts",
      "tests/enemies.test.ts",
      "tests/stages.test.ts",
      "tests/armory.test.ts",
      "tests/game.test.ts",
      "tests/p1.test.ts",
      "tests/layout.test.ts",
      "tests/render.test.ts",
      "tests/rescue.test.ts",
      "tests/hornet.test.ts",
    ],
    testTimeout: 30000,
  },
});
