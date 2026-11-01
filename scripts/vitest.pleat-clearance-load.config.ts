import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/measure-pleat-clearance.test.ts"],
    testTimeout: 600000,
  },
});
