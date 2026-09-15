import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: ["game-select.spec.ts", "training-scope.spec.ts"],
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 844, height: 390 },
    launchOptions: { channel: "chrome", args: ["--use-angle=d3d11"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
});
