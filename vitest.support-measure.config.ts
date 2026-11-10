import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/measure-support-stage3.test.ts"],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
