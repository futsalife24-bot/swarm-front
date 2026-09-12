import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "armory-ui.spec.ts",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5298",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5298 --strictPort",
    url: "http://127.0.0.1:5298",
    reuseExistingServer: false,
  },
});
