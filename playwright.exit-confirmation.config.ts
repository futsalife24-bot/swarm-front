import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "exit-confirmation.spec.ts",
  workers: 1,
  timeout: 120000,
  reporter: [
    ["list"],
    ["json", { outputFile: "dist-validation/exit-confirmation/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5378",
    viewport: { width: 844, height: 390 },
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "node node_modules/vite/bin/vite.js --config vite.exit-confirmation.config.ts",
      url: "http://127.0.0.1:5378",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        "node node_modules/wrangler/bin/wrangler.js dev --local --persist-to dist-validation/exit-confirmation/worker-state --config wrangler.test.jsonc --ip 127.0.0.1 --port 8918 --var ALLOWED_ORIGINS:http://127.0.0.1:5378",
      url: "http://127.0.0.1:8918/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
