import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export default mergeConfig(
  base,
  defineConfig({
    server: { port: 5198 },
    plugins: [
      {
        name: "local-soldier-proof",
        configureServer(server) {
          server.middlewares.use("/__soldier-proof", async (req, res) => {
            if (
              req.method !== "POST" ||
              req.headers.origin !== "http://127.0.0.1:5198"
            ) {
              res.statusCode = 403;
              res.end();
              return;
            }
            const match =
              /^\/([0-2]|play)-([0-9]{13})\/(\d{4}\.jpg|metrics\.json|capture\.webm)$/.exec(
                req.url || "",
              );
            if (
              !match ||
              (match[3].endsWith(".jpg") &&
                Number(match[3].slice(0, 4)) >= 1000)
            ) {
              res.statusCode = 400;
              res.end();
              return;
            }
            try {
              const parts: Buffer[] = [];
              let size = 0;
              for await (const chunk of req) {
                size += chunk.length;
                if (
                  size > (match[3] === "capture.webm" ? 60_000_000 : 2_000_000)
                )
                  throw new Error("size");
                parts.push(chunk);
              }
              const dir = resolve(
                "test-results/soldier-capture",
                `${match[1]}-${match[2]}`,
              );
              await mkdir(dir, { recursive: true });
              await writeFile(resolve(dir, match[3]), Buffer.concat(parts), {
                flag: "wx",
              });
              res.end("saved");
            } catch {
              res.statusCode = 409;
              res.end("save failed");
            }
          });
        },
      },
    ],
  }),
);
