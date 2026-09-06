import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/game.test.ts", "tests/p1.test.ts", "tests/layout.test.ts"],
    testTimeout: 30000,
  },
});
