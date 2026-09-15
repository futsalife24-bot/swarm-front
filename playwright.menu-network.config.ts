import { defineConfig } from "@playwright/test";
import lobby from "./playwright.lobby.config";
export default defineConfig({
  ...lobby,
  timeout: 120000,
  testMatch: ["lobby.spec.ts", "menu-network.spec.ts"],
  use: { ...lobby.use, screenshot: "only-on-failure" },
});
