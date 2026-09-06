import config from "./playwright.config";
export default {
  ...config,
  testMatch: ["mobile-ui.spec.ts", "smoke.spec.ts"],
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5186",
      reuseExistingServer: true,
    },
  ],
};
