import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/orientation-mock.test.ts",
      "tests/layout.test.ts",
      "tests/training.test.ts",
    ],
    fileParallelism: false,
  },
});
