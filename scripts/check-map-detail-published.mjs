import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const url =
  process.env.MAP_TEST_URL || "https://swarm-front.melosalife-24.workers.dev";
const dir = process.env.MAP_CHECK_DIR || "dist-validation/map-detail/published";
mkdirSync(dir, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [],
  errors = [],
  qualityChecks = [];
try {
  // Fetch outside the DevTools response cache, which evicts the largest GLBs.
  for (let index = 0; index < 6; index++) {
    const asset = await fetch(new URL(`/assets/maps/map_${index}_v1.glb`, url));
    if (
      !asset.ok ||
      hash(Buffer.from(await asset.arrayBuffer())) !==
        hash(readFileSync(`public/assets/maps/map_${index}_v1.glb`))
    )
      throw new Error(`map ${index}: deployed GLB differs`);
  }
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    // Explicit allowlist: game assets plus the existing public CAPTCHA bootstrap.
    // No form submission, account session, POST body, analytics or arbitrary host.
    await page.route("**/*", async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      const local = u.origin === new URL(url).origin;
      const captcha =
        u.origin === "https://challenges.cloudflare.com" &&
        u.pathname === "/turnstile/v0/api.js" &&
        r.method() === "GET" &&
        !r.postData();
      if (local || captcha) await route.continue();
      else await route.abort("blockedbyclient");
    });
    page.on("requestfailed", (r) => {
      const u = new URL(r.url());
      errors.push(
        `request ${u.origin}${u.pathname}: ${r.failure()?.errorText}`,
      );
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(url);
    await page.locator("#home-settings").click();
    await page.locator("#quality").selectOption("0.65");
    await page.reload();
    await page.locator("#home-settings").click();
    assert.equal(await page.locator("#quality").inputValue(), "0.65");
    await page.locator("#quality").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${dir}/quality-home-${viewport.width}.png`,
    });
    await page.locator("#quality").selectOption("1");
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
      if (!(await page.locator("#hud").innerText()).includes(`ST ${stage}`))
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
      if (index === 1) {
        const standardWidth = await page
          .locator("#world")
          .evaluate((el) => el.width);
        await page.locator("#pause").click();
        assert.equal(await page.locator("#pause-quality").inputValue(), "1");
        const lightLoad = page.waitForResponse((r) =>
          r.url().endsWith("/maps/map_1_v1.glb"),
        );
        await page.locator("#pause-quality").selectOption("0.65");
        await (await lightLoad).finished();
        await page.waitForTimeout(2000);
        const lightWidth = await page
          .locator("#world")
          .evaluate((el) => el.width);
        assert.ok(Math.abs(lightWidth / standardWidth - 0.65) < 0.005);
        assert.equal(
          await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("swarm-front-save-v1")).quality,
          ),
          0.65,
        );
        await page.locator("#pause-quality").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${dir}/quality-pause-${viewport.width}.png`,
        });
        const standardLoad = page.waitForResponse((r) =>
          r.url().endsWith("/maps/map_1_v1.glb"),
        );
        await page.locator("#pause-quality").selectOption("1");
        await (await standardLoad).finished();
        await page.locator("#pause-resume").click();
        assert.equal(
          await page.locator("#world").evaluate((el) => el.width),
          standardWidth,
        );
        qualityChecks.push({
          width: viewport.width,
          savedAfterReload: true,
          switchedBothWays: true,
          standardWidth,
          lightWidth,
        });
      }
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
  const healthResponse = await fetch(new URL("/api/health", url));
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  writeFileSync(
    `${dir}/checks.json`,
    JSON.stringify(
      { url, results, qualityChecks, health, assets, errors },
      null,
      2,
    ),
  );
  if (errors.length || results.some((r) => r.horizontalOverflow))
    throw new Error(JSON.stringify({ errors, results }));
  console.log(
    `PASS: 6 maps × 2 screen sizes; GLB/JS/CSS match; no page errors. ${dir}`,
  );
} finally {
  await browser.close();
}
