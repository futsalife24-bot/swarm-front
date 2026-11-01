import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const out = "docs/evidence/pleat-wall-acceptance-20261101";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.setDefaultNavigationTimeout(120000);
try {
  for (const [scale, version, at, name] of [
    [3, "lightweight", 5.75, "lightweight-ground"],
    [3, "before", 3.05, "legacy-ground"],
    [2.25, "lightweight", 2.15, "lightweight-slab"],
    [2.25, "before", 3, "legacy-slab"],
  ]) {
    await page.goto(
      `http://127.0.0.1:5188/scripts/pleat-wall-review.html?scale=${scale}&version=${version}`,
    );
    await page.waitForFunction(() => window.review, undefined, {
      timeout: 120000,
    });
    for (let i = 0; i < Math.round(at / 0.05); i++)
      await page.evaluate((i) => window.review.draw(i), i);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(
      name,
      await page.evaluate(() => document.querySelector("#stats").textContent),
    );
  }
  writeFileSync(
    `${out}/visual-check.json`,
    JSON.stringify(
      {
        viewport: { width: 844, height: 390 },
        errors,
        scope:
          "PC Chromeで20Hz計測状態を再生。両版とも現行モデル描画。旧端末の足の再現や実機検証ではない。",
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
