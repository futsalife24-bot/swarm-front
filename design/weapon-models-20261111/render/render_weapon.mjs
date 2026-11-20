// 画像を作る。repo ルートで実行する想定（node_modules は上位フォルダから探す）。
//   node design/weapon-models-20261111/render/render_weapon.mjs laser
//     → out/laser/views.png（多面＋札サイズ＋今との比較）
//   node design/weapon-models-20261111/render/render_weapon.mjs --silhouettes
//     → silhouettes/silhouettes.png（12丁のシルエット表）
import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const design = path.resolve(here, "..");
const repo = path.resolve(design, "../..");
// 今その武器が借りている形（src/shared/defs.ts の MODEL_OF の写し。比較表示だけに使う）。
const BORROWED = { smg: "rifle", slug: "shotgun", heavy: "rocket", sniper: "rifle", laser: "rifle",
  grenade: "rocket", sticky: "rocket", kick: "shotgun", medic: "rifle" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png" };

function findModules() {
  for (let dir = here; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "node_modules", "three"))) return path.join(dir, "node_modules");
    if (path.dirname(dir) === dir) throw new Error("node_modules/three が見つかりません（npm ci 済みの repo 内で実行する）");
  }
}
const roots = { nm: findModules(), d: design, repo };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/favicon.ico") return void res.writeHead(204).end();
  const [, key, ...rest] = url.pathname.split("/");
  const root = roots[key];
  const file = root && path.resolve(root, decodeURIComponent(rest.join("/")));
  if (!file || !file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const arg = process.argv[2];
if (!arg) throw new Error("usage: render_weapon.mjs <kind> | --silhouettes");
const silhouettes = arg === "--silhouettes";
const url = silhouettes
  ? `${base}/d/silhouettes/silhouettes.html`
  : `${base}/d/render/viewer.html?kind=${arg}${BORROWED[arg] ? `&borrowed=${BORROWED[arg]}` : ""}`;
const target = silhouettes ? path.join(design, "silhouettes", "silhouettes.png") : path.join(design, "out", arg, "views.png");

// GPU 描画（既存の検査スクリプトと同じ設定）を先に試し、WebGL を作れない時だけソフトウェア描画で再試行する。
const MODES = [["gpu", ["--use-angle=d3d11"]], ["software", ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]]];
let errors = [], used = "";
for (const [mode, args] of MODES) {
  errors = [];
  used = mode;
  const browser = await chromium.launch({ channel: "chrome", args });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(url);
    await page.waitForFunction("window.__done === true", null, { timeout: 30000 });
    await page.screenshot({ path: target, fullPage: true });
  } catch (e) {
    errors.push(String(e.message ?? e).split("\n")[0]);
  } finally {
    await browser.close();
  }
  if (!errors.length) break;
  console.error(`描画失敗（${mode}）:`, errors);
}
server.close();
if (errors.length) process.exit(1);
console.log("RENDER_COMPLETE", path.relative(repo, target), `描画=${used}`);
