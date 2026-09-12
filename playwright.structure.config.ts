import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "structure-v2.spec.ts",
  workers: 1,
  timeout: 60000,
  use: {
    serviceWorkers: "block",
    baseURL: "http://127.0.0.1:5329",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5329 --strictPort",
      url: "http://127.0.0.1:5329",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/wrangler/bin/wrangler.js dev --local --persist-to dist-validation/structure-v2/worker-state --config wrangler.test.jsonc --ip 127.0.0.1 --port 8929 --var ALLOWED_ORIGINS:http://127.0.0.1:5329",
      url: "http://127.0.0.1:8929/health",
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
