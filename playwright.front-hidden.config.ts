import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "front-hidden.spec.ts",
  timeout: 120000,
  workers: 1,
  use: {
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
});
