import { mergeConfig } from "vite";
import base from "./vite.config.ts";
export default mergeConfig(base, {
  cacheDir: ".vite-lag",
  optimizeDeps: { entries: ["front.html"] },
  server: { port: 5317, hmr: false },
});
