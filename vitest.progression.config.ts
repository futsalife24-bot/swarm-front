import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/rewarded-ad.test.ts"], testTimeout: 30000 },
});
