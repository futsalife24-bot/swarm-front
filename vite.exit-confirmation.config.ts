import { defineConfig } from "vite";

// Private validation only: no inherited dependency cache or outbound telemetry.
export default defineConfig({
  // Changelog generation is covered by the unmodified production build config.
  // Menu/exit tests do not need to walk the entire release history on startup.
  define: {
    __SWARM_BUILD__: JSON.stringify("303b7745ab6db05ac9d02c6985e35249eaada4cd"),
    __AUTO_CHANGELOG__: "[]",
  },
  cacheDir: "dist-validation/exit-confirmation/vite-cache",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    host: "127.0.0.1",
    port: 5378,
    strictPort: true,
    fs: { deny: ["**/.dev.vars*", "**/.env*", "**/*.{crt,pem}", "**/.git/**"] },
    watch: { ignored: ["**/dist-validation/**", "**/test-results/**"] },
    headers: {
      "Content-Security-Policy":
        "connect-src 'self' blob: http://127.0.0.1:8918 ws://127.0.0.1:8918 ws://127.0.0.1:5378; frame-src 'none'",
    },
  },
});
