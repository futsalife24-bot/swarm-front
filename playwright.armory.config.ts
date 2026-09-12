import { defineConfig } from "@playwright/test";

process.env.SWARM_TEST_ENDPOINT = "http://127.0.0.1:8889";
export default defineConfig({
  testDir: "e2e",
  testMatch: ["reward-choice.spec.ts", "coop-result.spec.ts"],
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5286",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 5286",
      url: "http://127.0.0.1:5286",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8889 --var ALLOWED_ORIGINS:http://127.0.0.1:5286",
      url: "http://127.0.0.1:8889/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
