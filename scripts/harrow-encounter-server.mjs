import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const server = await createServer({
  server: { host: "127.0.0.1", port: 5200, strictPort: true, hmr: false },
  plugins: [
    {
      name: "harrow-film-receiver",
      transform(code, id) {
        // The isolated recording origin must load current Vite modules, not
        // retain development URLs in the production offline asset cache.
        if (
          id
            .split("?")[0]
            .replaceAll("\\", "/")
            .endsWith("/src/client/app-install.ts")
        )
          return {
            code: code.replace(
              'if ("serviceWorker" in navigator)',
              "if (false)",
            ),
            map: null,
          };
        if (
          !id
            .split("?")[0]
            .replaceAll("\\", "/")
            .endsWith("/src/client/playtest-app.ts")
        )
          return;
        // This receiver is a local recording server, never part of the build.
        return {
          code:
            code +
            "\n" +
            readFileSync("scripts/harrow-encounter-live.js", "utf8"),
          map: null,
        };
      },
      configureServer(server) {
        server.middlewares.use("/__harrow-film", (req, res, next) => {
          if (req.method !== "POST") return next();
          let metadata;
          try {
            metadata = JSON.parse(req.headers["x-harrow-metadata"] ?? "");
            if (
              metadata.version !== "v8" ||
              !/^[a-f0-9]{64}$/.test(metadata.glbSha256)
            )
              throw Error("Invalid recording metadata");
          } catch {
            res.statusCode = 400;
            res.end("Invalid recording metadata");
            return;
          }
          let bytes = 0;
          const chunks = [];
          req.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 80000000) req.destroy();
            else chunks.push(chunk);
          });
          req.on("end", () => {
            mkdirSync("dist-validation/harrow/film-v8", { recursive: true });
            writeFileSync(
              "dist-validation/harrow/film-v8/harrow.webm",
              Buffer.concat(chunks),
            );
            writeFileSync(
              "dist-validation/harrow/film-v8/recording.json",
              JSON.stringify(metadata, null, 2),
            );
            res.end("saved");
          });
        });
      },
    },
  ],
});
await server.listen();
console.log("http://127.0.0.1:5200/scripts/harrow-encounter.html");
