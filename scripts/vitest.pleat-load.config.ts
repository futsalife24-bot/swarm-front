import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/measure-pleat-load.test.ts",
      "scripts/calibrate-pleat-speed.test.ts",
      "scripts/compare-pleat-courses.test.ts",
    ],
    testTimeout: 600000,
  },
});
