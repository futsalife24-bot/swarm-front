import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const url = "https://swarm-front.melosalife-24.workers.dev";
const dir = "dist-validation/enemies";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const response = await page.goto(url);
  if (response.status() !== 200) throw new Error("Page unavailable");
  const script = await page.locator('script[type="module"]').getAttribute("src");
  if (!script.includes("index-BrgXD9un.js")) throw new Error("Unexpected deployed bundle");
  await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
  const options = await page.locator("#stage-select option").allTextContents();
  if (options.length !== 10) throw new Error("Missing stages");
  await page.locator("#stage-select").selectOption("10");
  await page.screenshot({ path: `${dir}/live-select.png` });
  await page.locator("#launch").click();
  await page.locator("#hud").getByText("ST 10 · WAVE 1 / 3", { exact: true }).waitFor();
  await page.screenshot({ path: `${dir}/live-map10.png` });
  const health = await page.request.get(`${url}/api/health`);
  const body = await health.json();
  if (health.status() !== 200 || body.ok !== true || errors.length) throw new Error("Live validation failed");
  const result = { url, verifiedAt: new Date().toISOString(), pageStatus: response.status(), script, stages: options, stage10Launched: true, healthStatus: health.status(), healthOk: body.ok, errors };
  writeFileSync(`${dir}/live.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }

