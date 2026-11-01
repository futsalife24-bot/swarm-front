import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["scripts/pleat-wall-fix.test.ts"], testTimeout: 600000 },
});
