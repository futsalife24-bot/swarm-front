import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5186,
    strictPort: true,
    fs: { deny: ["**/.dev.vars*", "**/.env*", "**/*.{crt,pem}", "**/.git/**"] },
  },
  build: { target: "es2022" },
});
