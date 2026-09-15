import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "stages.spec.ts",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5317",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5317 --strictPort",
      url: "http://127.0.0.1:5317",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8917 --var ALLOWED_ORIGINS:http://127.0.0.1:5317",
      url: "http://127.0.0.1:8917/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
