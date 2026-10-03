import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "front-hud.spec.ts",
  timeout: 140000,
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:5186",
    launchOptions: { channel: "chrome" },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5186 --strictPort",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
});
