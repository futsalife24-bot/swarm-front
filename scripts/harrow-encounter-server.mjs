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
        server.middlewares.use("/__harrow-marker", (req, res, next) => {
          if (req.method !== "POST") return next();
          const name = req.headers["x-harrow-marker-name"];
          let metadata;
          try {
            if (typeof name !== "string" || !/^[a-z-]{1,48}$/.test(name))
              throw Error("Invalid marker name");
            metadata = JSON.parse(
              decodeURIComponent(req.headers["x-harrow-metadata"] ?? ""),
            );
          } catch {
            res.statusCode = 400;
            res.end("Invalid marker metadata");
            return;
          }
          let bytes = 0;
          const chunks = [];
          req.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 8000000) req.destroy();
            else chunks.push(chunk);
          });
          req.on("end", () => {
            const png = Buffer.concat(chunks);
            if (
              !png
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ) {
              res.statusCode = 400;
              res.end("PNG required");
              return;
            }
            const directory = "dist-validation/harrow-v8/marker-reaudit";
            mkdirSync(directory, { recursive: true });
            writeFileSync(`${directory}/${name}.png`, png);
            writeFileSync(
              `${directory}/${name}.json`,
              JSON.stringify(metadata, null, 2),
            );
            res.end("saved");
          });
        });
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
