import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "orientation-mock.spec.ts",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5197",
    actionTimeout: 10000,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    launchOptions: { channel: "chrome", args: ["--use-angle=d3d11"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --config vite.orientation-mock.config.ts",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
