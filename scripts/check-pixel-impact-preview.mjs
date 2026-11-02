import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 640 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const preview = resolve("output/pixel-impact-preview/comparison.html");
  await page.goto(pathToFileURL(preview).href, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.previewReady === true, {
    timeout: 30000,
  });
  await page.evaluate(() => window.previewFrame());
  await page.waitForTimeout(200);
  await mkdir("docs/evidence/pixel-impact-20261102", { recursive: true });
  await page.screenshot({
    path: "docs/evidence/pixel-impact-20261102/comparison.png",
  });
  await page.evaluate(() => window.previewClear());
  await page.waitForTimeout(100);
  const baseline = await page.evaluate(() => window.previewCalls);
  await page.evaluate(() => window.previewStress(20));
  await page.waitForTimeout(100);
  const stressed = await page.evaluate(() => window.previewCalls);
  if (stressed - baseline !== 20)
    throw new Error(`描画回数の差が想定外: ${baseline} -> ${stressed}`);
  await page.evaluate(() => window.previewFrame());
  await page.evaluate(() => window.previewWall(true));
  await page.waitForTimeout(100);
  const wallWith = await page.screenshot();
  await page.evaluate(() => window.previewClear());
  await page.waitForTimeout(100);
  const wallWithout = await page.screenshot();
  const a = await sharp(wallWith).raw().toBuffer();
  const b = await sharp(wallWithout).raw().toBuffer();
  if (!a.equals(b)) throw new Error("遮蔽物の奥で着弾が見えています");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `比較画面: エラー0件、遮蔽物の奥は非表示、描画回数 ${baseline} -> ${stressed} (20同時)`,
  );
} finally {
  await browser.close();
}
