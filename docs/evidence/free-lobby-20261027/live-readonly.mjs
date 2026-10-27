import { createServer } from "node:http";
const base = "https://swarm-front.melosalife-24.workers.dev";
createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405).end();
    return;
  }
  try {
    const r = await fetch(base + req.url, { redirect: "follow" });
    res.writeHead(r.status, {
      "Content-Type":
        r.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.writeHead(502).end();
  }
}).listen(5186, "127.0.0.1", () =>
  console.log("公開配信の読取専用・隔離オリジン: 5186"),
);
