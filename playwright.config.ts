import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      channel: "chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "npm run build:pages && npm run preview -- --outDir dist-pages --base=/swarm-front/ --port 4186",
      url: "http://127.0.0.1:4186/swarm-front/",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5186",
      reuseExistingServer: true,
    },
    {
      command: "npm run server",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "npm run server:test",
      url: "http://127.0.0.1:8789/health",
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
