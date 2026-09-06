// Private LAN HTTPS only. Serve a production build, never Vite/source/secrets.
import https from "node:https";
import http from "node:http";
import { isIP } from "node:net";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const config = JSON.parse(readFileSync("dist-lan/config.json", "utf8"));
const host = config.address;
const creationKey = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
if (!creationKey) throw Error("Local room creation credential missing");
const privateV4 = (s) => {
  if (typeof s !== "string" || isIP(s) !== 4) return false;
  const [a, b] = s.split(".").map(Number);
  return (
    a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
  );
};
if (!privateV4(host) || config.port !== 5443)
  throw Error("Private LAN configuration required");
const origin = `https://${host}:5443`;
const root = path.resolve("dist-lan/site");
const assets = new Map();
function load(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) load(file);
    else if (entry.isFile() && /\.(html|js|css|svg|png|ico)$/.test(entry.name))
      assets.set(
        "/" + path.relative(root, file).replaceAll("\\", "/"),
        readFileSync(file),
      );
  }
}
load(root);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const reply = (res, status, message) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ error: message }));
};
function upstream(req) {
  const headers = {};
  for (const name of [
    "origin",
    "content-type",
    "x-room-creation-key",
    "upgrade",
    "connection",
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-protocol",
  ])
    if (req.headers[name]) headers[name] = req.headers[name];
  if (
    req.url === "/api/rooms" &&
    req.method === "POST" &&
    !headers["x-room-creation-key"]
  )
    headers["x-room-creation-key"] = creationKey;
  headers["cf-connecting-ip"] = req.socket.remoteAddress;
  return http.request({
    host: "127.0.0.1",
    port: 8787,
    path: req.url.slice(4),
    method: req.method,
    headers,
  });
}
const server = https.createServer(
  {
    key: readFileSync("dist-lan/server-key.pem"),
    cert: readFileSync("dist-lan/server-cert.pem"),
  },
  (req, res) => {
    if (req.headers.origin && req.headers.origin !== origin)
      return reply(res, 403, "Origin rejected");
    if (
      (req.url === "/api/rooms" && req.method === "POST") ||
      (req.url === "/api/health" && req.method === "GET")
    ) {
      if (Number(req.headers["content-length"] ?? 0) > 2048)
        return reply(res, 413, "Request too large");
      const proxy = upstream(req);
      proxy.on("response", (r) => {
        res.writeHead(r.statusCode, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        r.pipe(res);
      });
      proxy.on("error", () => {
        if (!res.headersSent) reply(res, 502, "Server unavailable");
        else res.destroy();
      });
      let bytes = 0;
      req.on("data", (b) => {
        bytes += b.length;
        if (bytes > 2048) {
          proxy.destroy();
          req.destroy();
        }
      });
      req.pipe(proxy);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method))
      return reply(res, 405, "Method not allowed");
    const pathname = new URL(req.url, origin).pathname;
    const key = pathname === "/" ? "/index.html" : pathname;
    const data = assets.get(key);
    if (!data) return reply(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": mime[path.extname(key)] ?? "application/octet-stream",
      "Content-Length": data.length,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  },
);
server.on("upgrade", (req, socket, head) => {
  if (
    req.headers.origin !== origin ||
    req.method !== "GET" ||
    !/^\/api\/rooms\/[a-f0-9]{32}$/.test(req.url)
  ) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  const proxy = upstream(req);
  proxy.on("upgrade", (res, remote, remoteHead) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        Object.entries(res.headers)
          .map(([k, v]) => `${k}: ${v}\r\n`)
          .join("") +
        "\r\n",
    );
    if (remoteHead.length) socket.write(remoteHead);
    if (head.length) remote.write(head);
    remote.pipe(socket);
    socket.pipe(remote);
    remote.on("error", () => socket.destroy());
    socket.on("error", () => remote.destroy());
    socket.on("close", () => remote.destroy());
  });
  proxy.on("response", (res) => {
    socket.end(
      `HTTP/1.1 ${res.statusCode} Rejected\r\nConnection: close\r\n\r\n`,
    );
    res.resume();
  });
  proxy.on("error", () => socket.destroy());
  proxy.end();
});
server.maxConnections = 100;
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(5443, host, () =>
  console.log(`LAN preview ready: ${origin}/?qa=1`),
);
