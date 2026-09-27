import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["scripts/measure-balance*.test.ts"], testTimeout: 900000 } });
