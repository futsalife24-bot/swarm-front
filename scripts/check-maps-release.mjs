import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const url = process.env.MAP_TEST_URL || "http://127.0.0.1:5318";
const dir =
  process.env.MAP_CHECK_DIR ||
  "dist-validation/maps-blender/production-preview";
mkdirSync(dir, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [],
  errors = [];
try {
  // Fetch outside the DevTools response cache, which evicts the largest GLBs.
  for(let index=0;index<6;index++) {
    const asset=await fetch(new URL(`/assets/maps/map_${index}_v1.glb`,url));
    if(!asset.ok || hash(Buffer.from(await asset.arrayBuffer()))!==hash(readFileSync(`public/assets/maps/map_${index}_v1.glb`)))throw new Error(`map ${index}: deployed GLB differs`);
  }
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const [stage, index] of [
      [1, 0],
      [5, 1],
      [20, 2],
      [2, 3],
      [13, 4],
      [10, 5],
    ]) {
      await page.goto(url);
      await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
      await page.locator("#stage-select").selectOption(String(stage));
      const response = page.waitForResponse((r) =>
        r.url().endsWith(`/maps/map_${index}_v1.glb`),
      );
      await page.locator("#launch").click();
      const glb = await response;
      if (!glb.ok()) throw new Error(`map ${index}: GLB request failed`);
      await glb.finished();
      await page.waitForTimeout(3000);
      if (
        !(await page.locator("#hud").innerText()).includes(
          `ST ${stage}`,
        )
      )
        throw new Error(`stage ${stage} HUD missing`);
      await page.screenshot({
        path: `${dir}/${viewport.width}-map-${index}.png`,
      });
      results.push({
        stage,
        index,
        width: viewport.width,
        glb: "sha256-match",
        horizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
    }
    await page.close();
  }
  const html = await (await fetch(url)).text();
  const assets = [
    ...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g),
  ].map((m) => m[1]);
  for (const asset of assets)
    if (
      hash(
        Buffer.from(await (await fetch(new URL(asset, url))).arrayBuffer()),
      ) !== hash(readFileSync(`dist${asset}`))
    )
      throw new Error(`release asset differs: ${asset}`);
  if (!assets.some((a) => a.endsWith(".js")))
    throw new Error("No release JS found");
  writeFileSync(
    `${dir}/checks.json`,
    JSON.stringify({ url, results, assets, errors }, null, 2),
  );
  if (errors.length || results.some((r) => r.horizontalOverflow))
    throw new Error(JSON.stringify({ errors, results }));
  console.log(
    `PASS: 6 maps × 2 screen sizes; GLB/JS/CSS match; no page errors. ${dir}`,
  );
} finally {
  await browser.close();
}
