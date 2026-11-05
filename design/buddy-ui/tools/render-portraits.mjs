// バディの立ち絵を書き出す（開発サーバーの起動後に実行）。
// 実行: node design/buddy-ui/tools/render-portraits.mjs [http://127.0.0.1:5191]
// 出力: public/assets/buddy/portraits/{id}.webp（320×320、透明背景）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const base = process.argv[2] || "http://127.0.0.1:5191";
const out = path.join(root, "public/assets/buddy/portraits");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`${base}/design/buddy-ui/tools/portraits.html`, {
  timeout: 240000,
});
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
for (const id of ["tatara", "yosuga", "tobari", "oriha"]) {
  const url = await page.evaluate((k) => window.__render(k), id);
  const file = path.join(out, `${id}.webp`);
  fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  console.log(file, fs.statSync(file).size);
}
await browser.close();
