import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/pleat-wall-acceptance.test.ts"],
    testTimeout: 600000,
  },
});
