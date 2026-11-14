import { mergeConfig } from "vite";
import config from "../vite.config.ts";
export default mergeConfig(config, {
  cacheDir: "output/voice-probe-cache",
  optimizeDeps: { noDiscovery: true, include: [] },
});
