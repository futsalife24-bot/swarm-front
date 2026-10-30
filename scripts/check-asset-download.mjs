import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import {
  readFileSync,
  existsSync,
  statSync,
  createReadStream,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Production build, real service worker + CacheStorage, isolated temporary profile.
const root = path.resolve("dist"),
  out =
    process.env.SWARM_PWA_OUTPUT ?? "dist-validation/coop-comfort-20261030/pwa";
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(
  readFileSync(path.join(root, "asset-download-manifest.json"), "utf8"),
);
const origin = "http://127.0.0.1:5186",
  requests = [],
  errors = [];
const overrides = new Map(); // Isolated HTTP update test; never modifies dist.
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, origin),
    relative =
      decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  const file = path.resolve(root, relative);
  if (
    !file.startsWith(root + path.sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  requests.push(url.pathname + url.search);
  if (url.searchParams.has("__swarm_asset"))
    await new Promise((r) => setTimeout(r, 25));
  if (res.destroyed) return;
  res.setHeader(
    "content-type",
    mime[path.extname(file)] ?? "application/octet-stream",
  );
  res.setHeader(
    "content-length",
    overrides.get(url.pathname)?.length ?? statSync(file).size,
  );
  res.setHeader("cache-control", "no-store");
  if (overrides.has(url.pathname)) {
    res.end(overrides.get(url.pathname));
    return;
  }
  const stream = createReadStream(file);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(5186, "127.0.0.1", resolve);
});
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
});
let page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
const results = {
  revision: manifest.revision,
  started: new Date().toISOString(),
};
const settled = () =>
  page.locator(".split-shutter").waitFor({ state: "hidden" });
async function openMenu() {
  if (await page.locator(".title-entry-start").isVisible()) {
    if (
      (await page
        .locator(".title-entry-start")
        .getAttribute("aria-disabled")) !== "true"
    )
      await page.locator(".title-entry-start").click();
    await page.locator(".title-entry-start").waitFor({ state: "hidden" });
  }
  await page.locator("#home-settings").click();
  await settled();
  const button = page.locator("[data-download-menu]");
  if (!(await button.isVisible())) {
    const tab = page.getByRole("tab", { name: /保存/ });
    if (await tab.count()) await tab.click();
  }
  await button.click();
  await settled();
  await page.waitForFunction(
    () => document.querySelectorAll(".download-pack").length >= 10,
  );
}
try {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator("#home-settings").waitFor({ timeout: 60000 });
  if (await page.locator(".title-entry-start").isVisible()) {
    await page.locator(".title-entry-start").click();
    await page.locator(".title-entry-start").waitFor({ state: "hidden" });
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const before = await page.evaluate(() => ({ ...localStorage }));
  await openMenu();
  console.log("保存画面を表示");
  await page.locator('[data-pack="map-survival-0"]').check();
  for (const width of [844, 640]) {
    await page.setViewportSize({
      width,
      height: width === 390 ? 844 : width === 640 ? 360 : 390,
    });
    await page.locator(".download-dialog .menu-dialog-body").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `${out}/menu-${width}.png` });
    const overflow = await page.locator(".download-dialog").evaluate((d) => {
      const r = d.getBoundingClientRect();
      const body = d.querySelector(".menu-dialog-body");
      return {
        width: r.width,
        right: r.right,
        bottom: r.bottom,
        window: [innerWidth, innerHeight],
        horizontal: body.scrollWidth > body.clientWidth + 1,
      };
    });
    assert.equal(overflow.horizontal, false, JSON.stringify(overflow));
    assert.ok(
      overflow.right <= width + 1 &&
        overflow.bottom <=
          (width === 390 ? 844 : width === 640 ? 360 : 390) + 1,
    );
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("[data-download]").click();
  await page.waitForFunction(
    () => document.querySelector(".download-controls progress").value > 0,
  );
  await page.locator("[data-pause]").click();
  await page
    .getByText("一時停止しました。完了したファイルから再開できます。", {
      exact: true,
    })
    .waitFor();
  results.pausedFiles = await page.evaluate(
    async () =>
      (await (await caches.open("swarm-front-preload-v1")).keys()).length,
  );
  assert.ok(results.pausedFiles > 0);
  console.log("中断を確認", results.pausedFiles);
  await page.locator("[data-download]").click();
  await page.waitForFunction(() =>
    document.querySelector(".download-status").textContent.startsWith("保存 "),
  );
  await page.waitForFunction(
    () => document.querySelector("[data-pause]").hidden,
    undefined,
    { timeout: 120000 },
  );
  assert.equal(
    await page.locator(".download-status").textContent(),
    "選んだデータを保存しました。次回から再利用します。",
  );
  results.savedFiles = await page.evaluate(
    async () =>
      (await (await caches.open("swarm-front-preload-v1")).keys()).length,
  );
  results.selectedFiles = new Set(
    manifest.packs
      .filter((p) => ["app", "common", "map-survival-0"].includes(p.id))
      .flatMap((p) => p.assets.map((a) => a.url)),
  ).size;
  assert.equal(results.savedFiles, results.selectedFiles);
  console.log("選択データを保存", results.savedFiles);
  assert.deepEqual(
    await page.evaluate(() => ({ ...localStorage })),
    before,
    "Asset download changed local save/settings",
  );
  await page.screenshot({ path: `${out}/saved-844.png` });
  await page.locator(".download-dialog .dialog-close").click();
  await settled();
  await page.locator("dialog[open] .dialog-close").click();
  await settled();
  const downloadCount = requests.filter((url) =>
    url.includes("__swarm_asset"),
  ).length;
  await openMenu();
  await page.locator('[data-pack="map-survival-0"]').check();
  assert.equal(await page.locator("[data-download]").isDisabled(), true);
  assert.equal(
    requests.filter((url) => url.includes("__swarm_asset")).length,
    downloadCount,
  );
  results.secondVisitDownloads = 0;
  // A same-URL asset update must bypass both the SW and HTTP caches and fetch
  // only the changed file. A trailing PNG byte is harmless but changes its hash.
  const updated = structuredClone(manifest);
  const changed = updated.packs
    .find((p) => p.id === "common")
    .assets.find((a) => a.url === "assets/ui/weapon-locked.png");
  assert.ok(changed);
  const changedBody = Buffer.concat([
    readFileSync(path.join(root, changed.url)),
    Buffer.from([0]),
  ]);
  changed.bytes = changedBody.length;
  changed.sha256 = createHash("sha256").update(changedBody).digest("hex");
  updated.revision = createHash("sha256")
    .update(JSON.stringify({ version: updated.version, packs: updated.packs }))
    .digest("hex");
  overrides.set("/" + changed.url, changedBody);
  overrides.set(
    "/asset-download-manifest.json",
    Buffer.from(JSON.stringify(updated)),
  );
  await page.locator(".download-dialog .dialog-close").click();
  await settled();
  await page.locator("dialog[open] .dialog-close").click();
  await settled();
  await openMenu();
  const beforeUpdate = requests.filter((url) =>
    url.includes("__swarm_asset"),
  ).length;
  await page.locator("[data-download]").click();
  await page
    .getByText("選んだデータを保存しました。次回から再利用します。", {
      exact: true,
    })
    .waitFor({ timeout: 30000 });
  results.sameUrlUpdateDownloads =
    requests.filter((url) => url.includes("__swarm_asset")).length -
    beforeUpdate;
  assert.equal(results.sameUrlUpdateDownloads, 1);
  results.sameUrlUpdateHash = await page.evaluate(
    async (url) =>
      (
        await (await caches.open("swarm-front-preload-v1")).match(url)
      ).headers.get("x-swarm-asset-sha256"),
    new URL(changed.url, origin).href,
  );
  assert.equal(results.sameUrlUpdateHash, changed.sha256);
  await context.setOffline(true);
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator("#home-settings").waitFor({ timeout: 30000 });
  results.rootOffline = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#home-settings").waitFor({ timeout: 30000 });
  results.rootOfflineReload = true;
  const wav = manifest.packs
    .find((p) => p.id === "common")
    .assets.find((a) => a.url.endsWith(".wav"));
  results.offlineRange = await page.evaluate(async (url) => {
    const r = await fetch(url, { headers: { Range: "bytes=10-29" } });
    return {
      status: r.status,
      bytes: (await r.arrayBuffer()).byteLength,
      range: r.headers.get("content-range"),
    };
  }, new URL(wav.url, origin).href);
  assert.equal(results.offlineRange.status, 206);
  assert.equal(results.offlineRange.bytes, 20);
  await page.goto(`${origin}/front.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#home-settings").waitFor({ timeout: 30000 });
  results.frontOffline = true;
  console.log("通信なしで両入口を起動");
  await openMenu();
  assert.equal(await page.locator("[data-download]").isDisabled(), true);
  results.frontSettingsEntry = true;
  await page.locator(".download-dialog .dialog-close").click();
  await settled();
  await page.locator("#front-settings-back").click();
  await settled();
  if (await page.locator(".title-entry-start").isVisible()) {
    await page.locator(".title-entry-start").click();
    await page.locator(".title-entry-start").waitFor({ state: "hidden" });
  }
  await page.locator("#solo").click();
  await settled();
  await page.locator('[data-operation="survival"]').click();
  await settled();
  await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
  await page.locator(".rebuild-card").first().waitFor({ timeout: 65000 });
  await page.locator(".rebuild-card").first().click();
  await page.locator("#controls").waitFor({ state: "visible", timeout: 10000 });
  results.survivalOfflineStarted = true;
  await page.screenshot({ path: `${out}/offline-survival.png` });
  results.pageErrors = errors;
  assert.equal(errors.length, 0);
  results.pass = true;
  console.log(JSON.stringify(results));
} catch (error) {
  results.pass = false;
  results.error = String(error);
  results.pageErrors = errors;
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  writeFileSync(
    `${out}/failure-body.txt`,
    await page
      .locator("body")
      .innerText()
      .catch(() => ""),
  );
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  writeFileSync(`${out}/requests.json`, JSON.stringify(requests, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
