import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "growth-loop.spec.ts",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5197",
    viewport: { width: 844, height: 390 },
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
  },
});
