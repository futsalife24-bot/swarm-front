import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: ["menu-ui.spec.ts", "armory-ui.spec.ts"],
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5326",
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5326 --strictPort",
    url: "http://127.0.0.1:5326",
    reuseExistingServer: true,
  },
});
