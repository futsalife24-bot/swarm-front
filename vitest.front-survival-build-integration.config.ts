import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/front-survival-build.integration.ts"],
    testTimeout: 35000,
    fileParallelism: false,
  },
});
