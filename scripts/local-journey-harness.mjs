// Browser-facing origin stays on Vite; only /api and /admin are proxied to a
// freshly started local Worker. No production endpoint is contacted.
import { createRequire } from "node:module";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { createServer as createViteServer } from "vite";

const require = createRequire(import.meta.url);
const wrangler = join(
  dirname(require.resolve("wrangler/package.json")),
  "bin/wrangler.js",
);

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const proxyToWorker = (workerOrigin) => {
  let queue = Promise.resolve();
  return (req, res, next) => {
  if (!/^\/(api|admin)(\/|$)/.test(req.url ?? "")) {
    next();
    return;
  }
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const send = async () => {
      const headers = { ...req.headers };
      delete headers["content-length"];
      delete headers["connection"];
      headers.host = new URL(workerOrigin).host;
      headers.origin = workerOrigin;
      const response = await fetch(`${workerOrigin}${req.url}`, {
        method: req.method,
        headers,
        body:
          req.method === "GET" || req.method === "HEAD" || !chunks.length
            ? undefined
            : Buffer.concat(chunks),
      });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (
          key !== "content-length" &&
          key !== "content-encoding" &&
          key !== "transfer-encoding"
        )
          res.setHeader(key, value);
      });
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
    };
    queue = queue.then(send).catch((error) => {
      res.statusCode = 502;
      res.end(`local Worker proxy failed: ${error}`);
    });
  });
  };
};

export async function startLocalJourneyHarness(label) {
  const [appPort, workerPort] = [await freePort(), await freePort()];
  const origin = `http://127.0.0.1:${appPort}`;
  const workerOrigin = `http://127.0.0.1:${workerPort}`;
  const persistTo = `dist-validation/first-ten-minutes/local-worker-${label}-${process.pid}-${Date.now()}`;
  const configHome = join(process.cwd(), "dist-validation/first-ten-minutes/local-wrangler-config");
  const cacheHome = join(process.cwd(), "dist-validation/first-ten-minutes/local-wrangler-cache");
  fs.mkdirSync(configHome, { recursive: true });
  fs.mkdirSync(cacheHome, { recursive: true });
  const worker = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(workerPort),
      "--persist-to",
      persistTo,
      "--config",
      "wrangler.production.jsonc",
    ],
    {
      stdio: "ignore",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        XDG_CACHE_HOME: cacheHome,
        WRANGLER_CACHE_DIR: cacheHome,
      },
    },
  );
  let vite;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 160; attempt++) {
      if (worker.exitCode !== null)
        throw Error(`local Worker exited with ${worker.exitCode}`);
      try {
        const response = await fetch(`${workerOrigin}/api/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Worker is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw Error("local Worker startup timed out");
    vite = await createViteServer({
      server: {
        host: "127.0.0.1",
        port: appPort,
        strictPort: true,
        fs: {
          deny: ["**/.dev.vars*", "**/.env*", "**/*.{crt,pem}", "**/.git/**"],
        },
      },
      plugins: [
        {
          name: "local-journey-worker-proxy",
          configureServer(server) {
            server.middlewares.use(proxyToWorker(workerOrigin));
          },
        },
      ],
    });
    await vite.listen();
    return {
      origin,
      workerOrigin,
      async close() {
        await vite.close();
        worker.kill();
      },
    };
  } catch (error) {
    if (vite) await vite.close();
    worker.kill();
    throw error;
  }
}
