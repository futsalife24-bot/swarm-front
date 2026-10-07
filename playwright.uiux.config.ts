import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: ["front-hud.spec.ts", "front-feedback.spec.ts"],
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 844, height: 390 },
    actionTimeout: 15000,
    launchOptions: { channel: "chrome", args: ["--use-angle=d3d11"] },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5186",
      reuseExistingServer: true,
    },
    {
      command: "npm run server:test",
      url: "http://127.0.0.1:8789/health",
      reuseExistingServer: true,
    },
  ],
});
