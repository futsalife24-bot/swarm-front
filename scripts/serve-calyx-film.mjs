import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
const server = await createServer({
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
  plugins: [
    {
      name: "calyx-film-receiver",
      configureServer(server) {
        server.middlewares.use("/__calyx-film", (req, res, next) => {
          if (req.method !== "POST") return next();
          let n = 0,
            chunks = [];
          req.on("data", (b) => {
            n += b.length;
            if (n > 40000000) req.destroy();
            else chunks.push(b);
          });
          req.on("end", () => {
            mkdirSync("dist-validation/calyx-film", { recursive: true });
            writeFileSync(
              "dist-validation/calyx-film/calyx.webm",
              Buffer.concat(chunks),
            );
            res.end("saved");
          });
        });
      },
    },
  ],
});
await server.listen();
console.log("http://127.0.0.1:5198/scripts/calyx-encounter.html");
