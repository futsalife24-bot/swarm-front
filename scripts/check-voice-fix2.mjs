import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5200/";
const out = "docs/evidence/voice-fix2-20261115";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
await context.route("**/api/**", async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname !== "127.0.0.1") return route.continue();
  const response = await context.request.fetch(
    "http://127.0.0.1:8796" + u.pathname + u.search,
    {
      method: route.request().method(),
      headers: {
        ...route.request().headers(),
        origin: "http://127.0.0.1:5200",
      },
      data: route.request().postDataBuffer() ?? undefined,
    },
  );
  await route.fulfill({ response });
});
const page = await context.newPage();
const result = { base, errors: [], checks: [] };
page.on("pageerror", (e) => result.errors.push(e.message));
async function home() {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByText("TAP START", { exact: true }).click();
  await page.locator("css:light=#home-settings").waitFor();
  await page.waitForTimeout(900);
}
async function voice() {
  await page.locator("css:light=#home-settings").click();
  await page.waitForTimeout(800);
  const b = page.getByRole("button", { name: "管制AIボイス", exact: true });
  await b.click();
  await page.waitForTimeout(400);
  if (!(await page.locator("css:light=.cv-dialog").count())) await b.click();
  await page.locator('css:light=.cv-row[data-voice="hiromi"]').waitFor();
  await page.waitForTimeout(1000);
}
try {
  await home();
  await page.evaluate(() =>
    localStorage.setItem("swarm-front-player-name-v1", "字幕確認"),
  );
  await voice();
  assert.equal(
    await page.locator('css:light=[data-cv-action="delete"]').count(),
    0,
  );
  assert.equal(
    await page
      .locator('css:light=[data-voice="hiromi"] [data-cv-action="preview"]')
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.locator('css:light=[data-voice="yoko"] input').isDisabled(),
    true,
  );
  assert.equal(
    await page
      .locator('css:light=[data-voice="yoko"] [data-cv-action="preview"]')
      .isDisabled(),
    true,
  );
  for (const width of [844, 568]) {
    await page.setViewportSize({ width, height: width === 568 ? 320 : 390 });
    await page.screenshot({ path: `${out}/settings-${width}.png` });
    const geom = await page
      .locator("css:light=.cv-dialog")
      .evaluate((d) => ({
        width: d.clientWidth,
        scroll: d.querySelector(".menu-dialog-body").scrollWidth,
        body: d.querySelector(".menu-dialog-body").clientWidth,
      }));
    assert.ok(geom.scroll <= geom.body + 1, JSON.stringify(geom));
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page
    .getByRole("combobox", { name: "管制AIの字幕", exact: true })
    .selectOption("always");
  await page.locator("css:light=.cv-dialog .dialog-close").click();
  await page.locator("css:light=dialog[open] .dialog-close:visible").click();
  await home();
  await page.locator('css:light=.control-caption[data-line="title"]').waitFor();
  await page.screenshot({ path: `${out}/title-missing.png` });
  console.log("STEP");
  result.checks.push("未DLタイトル字幕");
  await voice();
  await page
    .locator('css:light=[data-voice="hiromi"] [data-cv-action="download"]')
    .click();
  await page
    .locator('css:light=[data-voice="hiromi"][data-state="ready"]')
    .waitFor({ timeout: 30000 });
  await page
    .locator('css:light=[data-voice="hiromi"] [data-cv-action="preview"]')
    .click();
  await page
    .getByText("ヒロミのサンプルを再生しています。", { exact: true })
    .waitFor();
  console.log("STEP");
  result.checks.push("パックDL・試聴");
  await page.locator('css:light=[data-voice="none"] input').check();
  assert.equal(
    await page
      .locator('css:light=[data-voice="none"]')
      .getAttribute("data-selected"),
    "true",
  );
  await page
    .getByRole("combobox", { name: "管制AIの字幕", exact: true })
    .selectOption("missing");
  await page.locator("css:light=.cv-dialog .dialog-close").click();
  await page.locator("css:light=dialog[open] .dialog-close:visible").click();
  await home();
  await page.locator('css:light=.control-caption[data-line="title"]').waitFor();
  await page.screenshot({ path: `${out}/title-muted.png` });
  console.log("STEP");
  result.checks.push("保存済みボイスなし＋音声なし時字幕");
  await page.locator("css:light=#home-tutorial").click();
  await page.waitForTimeout(600);
  await page.locator("css:light=#tutorial-training").click();
  const f = page.frameLocator("iframe.training-frame");
  await f.locator("css:light=#training-start").click();
  await f.locator("css:light=.control-caption").waitFor();
  await page.screenshot({ path: `${out}/training-muted.png` });
  console.log("STEP");
  result.checks.push("基礎訓練iframe字幕");
  await home();
  await page.locator("css:light=#solo").click();
  await page.waitForTimeout(600);
  console.log(
    "SOLO",
    await page.locator("css:light=button:visible").allTextContents(),
  );
  console.log(
    "AFTERNAME",
    await page.locator("css:light=button:visible").allTextContents(),
  );
  await page.locator('css:light=[data-operation="advance"]').click();
  await page.waitForTimeout(1000);
  console.log(
    "ADVANCE",
    await page.locator("css:light=button:visible").allTextContents(),
  );
  if (
    await page.getByRole("button", { name: "確定", exact: true }).isVisible()
  ) {
    await page.getByRole("button", { name: "確定", exact: true }).click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: out + "/guide-muted.png" });
  await page.locator("css:light=#pt-offer-later").click();
  await page.waitForTimeout(1000);
  console.log(
    "GEAR",
    await page.locator("css:light=button:visible").allTextContents(),
  );
  await writeFile(
    "dist-validation/voice-browser-state.json",
    JSON.stringify(await context.storageState(), null, 2),
  );
} catch (e) {
  await writeFile(
    "dist-validation/voice-browser-state.json",
    JSON.stringify(await context.storageState(), null, 2),
  );
  await page.screenshot({ path: out + "/failure.png" });
  console.log(
    "FAILSTATE",
    await page.evaluate(() => ({
      captions: [...document.querySelectorAll(".control-caption")].map(
        (n) => n.outerHTML,
      ),
      settings: localStorage.getItem("swarm-front-control-captions-v1"),
      url: location.href,
    })),
  );
  throw e;
} finally {
  await writeFile(`${out}/ui-result.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result));
