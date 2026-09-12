import { defineConfig } from "@playwright/test";
import lobby from "./playwright.lobby.config";
export default defineConfig({
  ...lobby,
  timeout: 120000,
  testMatch: ["stage-clear-coop.spec.ts", "stage-clear.spec.ts"],
  use: { ...lobby.use, baseURL: "http://127.0.0.1:5326" },
  webServer: [
    {
      command: "npm run dev -- --port 5326 --strictPort",
      url: "http://127.0.0.1:5326",
    },
    {
      command: "node node_modules/wrangler/bin/wrangler.js dev --local --persist-to dist-validation/stage-clear/worker-state --config wrangler.test.jsonc --ip 127.0.0.1 --port 8926 --var ALLOWED_ORIGINS:http://127.0.0.1:5326",
      url: "http://127.0.0.1:8926/health",
      timeout: 120000,
    },
  ],
});
