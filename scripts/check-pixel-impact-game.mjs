import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = resolve("dist");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost") return route.abort();
    const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + sep) || !existsSync(file))
      return route.fulfill({ status: 404, body: "" });
    await route.fulfill({ path: file });
  });
  await page.goto("http://localhost/front.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (!(await page.locator("#solo").count())) {
    console.log("画面本文:", (await page.locator("body").innerText()).slice(0, 1000));
    console.log("画面エラー:", errors);
  }
  await page.getByRole("button", { name: "SWARM FRONT はじめる" }).click();
  await page.locator("#solo").click({ timeout: 30000 });
  await page.locator("[data-operation=survival]").click();
  await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
  try {
    await page.locator(".rebuild-card").first().click({ timeout: 20000 });
  } catch (error) {
    console.log("出撃後の画面:", (await page.locator("body").innerText()).slice(0, 1400));
    console.log("画面エラー:", errors);
    throw error;
  }
  await page.locator("#controls").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "docs/evidence/pixel-impact-20261102/game-start.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("実ゲームのソロ出撃画面を表示、画面エラー0件（命中自体は未確認）");
} finally {
  await browser.close();
}
