import { chromium } from "playwright";
import { existsSync, createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
};
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(root + sep) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[extname(file)] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});
await new Promise((resolveListen, reject) =>
  server.listen(0, "127.0.0.1", resolveListen).on("error", reject),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/front.html`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  if (!(await page.locator("#solo").count())) {
    console.log(
      "画面本文:",
      (await page.locator("body").innerText()).slice(0, 1000),
    );
    console.log("画面エラー:", errors);
  }
  await page.getByRole("button", { name: "SWARM FRONT はじめる" }).click();
  await page.locator("#solo").click({ timeout: 30000 });
  await page.locator("[data-operation=survival]").click();
  await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
  try {
    await page.locator(".rebuild-card").first().click({ timeout: 120000 });
  } catch (error) {
    console.log(
      "出撃後の画面:",
      (await page.locator("body").innerText()).slice(0, 1400),
    );
    console.log("画面エラー:", errors);
    throw error;
  }
  await page.locator("#controls").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: "docs/evidence/pixel-impact-20261102/game-start.png",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "実ゲームのソロ出撃画面を表示、画面エラー0件（命中自体は未確認）",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolveClose) => server.close(resolveClose));
}
