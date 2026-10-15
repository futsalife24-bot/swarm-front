import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

// Local recording receiver only. This route is never included in the Worker.
const output = "dist-validation/current-encounters-20261015";
const keys = new Set([
  "crawler",
  "ant",
  "spider",
  "spitter",
  "boss",
  "hornet",
  "worm",
  "calyx",
  "harrow",
]);
const origin = "http://127.0.0.1:5202";
mkdirSync(output, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 5202, strictPort: true, hmr: false },
  plugins: [
    {
      name: "current-encounter-receiver",
      configureServer(server) {
        server.middlewares.use("/__current-film", (req, res) => {
          const key = req.headers["x-encounter-key"];
          if (
            req.method !== "POST" ||
            req.headers.origin !== origin ||
            !keys.has(key)
          ) {
            res.writeHead(400).end("Invalid local recording");
            return;
          }
          let metadata;
          try {
            metadata = JSON.parse(
              decodeURIComponent(req.headers["x-encounter-metadata"] ?? ""),
            );
            if (
              metadata.worldFrozen !== true ||
              !Array.isArray(metadata.errors) ||
              metadata.errors.length ||
              !Array.isArray(metadata.assets) ||
              !metadata.assets.length
            )
              throw Error("Incomplete recording evidence");
            for (const asset of metadata.assets) {
              const url = new URL(asset.url, origin);
              if (
                url.origin !== origin ||
                !/^\/assets\/enemies\/[a-z0-9_]+\.glb$/.test(url.pathname) ||
                !/^[a-f0-9]{64}$/.test(asset.sha256)
              )
                throw Error("Invalid model evidence");
            }
          } catch {
            res.writeHead(400).end("Invalid recording metadata");
            return;
          }
          let size = 0;
          const chunks = [];
          req.on("data", (chunk) => {
            size += chunk.length;
            if (size > 80000000) req.destroy();
            else chunks.push(chunk);
          });
          req.on("end", () => {
            const bytes = Buffer.concat(chunks);
            if (
              bytes.length < 32 ||
              bytes.toString("ascii", 0, 4) !== "DKIF" ||
              bytes.toString("ascii", 8, 12) !== "VP90"
            ) {
              res
                .writeHead(400)
                .end(`Expected VP9 IVF (${bytes.length} bytes)`);
              return;
            }
            writeFileSync(`${output}/${key}.ivf`, bytes);
            writeFileSync(
              `${output}/${key}.json`,
              JSON.stringify(
                { ...metadata, key, bytes: bytes.length },
                null,
                2,
              ) + "\n",
            );
            res
              .writeHead(200, { "Content-Type": "application/json" })
              .end(JSON.stringify({ saved: true, key, bytes: bytes.length }));
          });
        });
      },
    },
  ],
});
await server.listen();
console.log(`${origin}/scripts/current-encounters.html`);
