import { defineConfig } from "@playwright/test";
import structure from "./playwright.structure.config";
export default defineConfig({
  ...structure,
  webServer: (structure.webServer as any[]).map((server, index) =>
    index === 0 ? { ...server, reuseExistingServer: true } : server,
  ),
});
