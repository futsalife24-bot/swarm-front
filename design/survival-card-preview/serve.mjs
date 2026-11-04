// 依存なしの静的サーバー。リポジトリのルートを配信し、プレビューと既存のカード画像（public/rebuild/upgrades）を読む。
// 実行（リポジトリのルートで）: node design/survival-card-preview/serve.mjs [ポート]  → http://127.0.0.1:5190/design/survival-card-preview/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const port = Number(process.argv[2] || process.env.PORT || 5190);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
// 配信はプレビューと既存のカード画像だけに限る。
const allowed = ["design/survival-card-preview/", "public/rebuild/upgrades/"];
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (rel === "") rel = "design/survival-card-preview/";
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, rel);
    // 「..」を解決した後の位置で許可範囲を判定する。
    const resolved = path.relative(root, file).split(path.sep).join("/");
    if (
      !file.startsWith(root + path.sep) ||
      !allowed.some((p) => resolved.startsWith(p))
    ) {
      res.writeHead(404).end();
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": types[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    });
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`http://127.0.0.1:${port}/design/survival-card-preview/`),
  );
