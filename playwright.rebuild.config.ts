import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "rebuild-p1a.spec.ts",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 844, height: 390 },
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : { channel: "chrome" }),
      args:
        process.env.SWARM_SOFTWARE_GL === "1"
          ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
          : [],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
});
