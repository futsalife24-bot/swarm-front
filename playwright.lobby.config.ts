import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "lobby.spec.ts",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5312",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5312 --strictPort",
      url: "http://127.0.0.1:5312",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/wrangler/bin/wrangler.js dev --local --persist-to dist-validation/lobby/worker-state --config wrangler.test.jsonc --ip 127.0.0.1 --port 8912 --var ALLOWED_ORIGINS:http://127.0.0.1:5312",
      url: "http://127.0.0.1:8912/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
