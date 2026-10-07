import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
// Rapid input, leaving mid-effect and reduced motion: no stale effect survives.
const origin = process.env.MENU_ORIGIN || "http://127.0.0.1:5347";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw Error("Fixtures require localhost");
const b = await chromium.launch(
  process.env.PW_EXECUTABLE
    ? { executablePath: process.env.PW_EXECUTABLE }
    : { channel: "chrome", args: ["--use-angle=d3d11"] },
);
const newPage = async (browser, opts) => {
  const p = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
    ...opts,
  });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  return p;
};
const seed = async (p) => {
  await p.goto(origin);
  await p.locator("#solo").waitFor();
  await p.evaluate(async () => {
    const m = await import("/src/client/progression-save.ts");
    const s = m.freshProgress("normal");
    Object.assign(s, {
      coins: 4000,
      powder: 130,
      points: 120,
      materials: 2,
      unlocked: ["hp", "aim", "move", "swap"],
      tutorials: ["growth", "accessories", "gear", "armory", "base"],
      encounters: { crawler: "solo", ant: "coop" },
    });
    s.accessories = [0, 1, 2].map((i) => ({
      id: "effect-" + i,
      kind: "pickup",
      rarity: 1,
      locked: false,
      testData: false,
    }));
    localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
    localStorage.setItem("swarm-front-player-name-v1", "演出検証");
  });
};
const results = [];
const fxCount = (p) =>
  p.evaluate(() => ({
    layers: document.querySelectorAll(
      ".menu-fx-layer:not(.menu-fx-terrain),.radar-fx-settle,.title-motion-accent",
    ).length,
    anims: document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          a.effect?.target?.closest?.(
            ".menu-fx-layer,.radar-fx-settle,.title-motion-accent,.media-playing-light",
          ),
      ).length,
  }));
const settle = async (p, ms = 3000) => {
  await p.waitForFunction(
    () =>
      document.querySelectorAll(
        ".menu-fx-layer:not(.menu-fx-terrain),.radar-fx-settle,.title-motion-accent",
      ).length === 0,
    {},
    { timeout: ms },
  );
};
for (const rm of ["no-preference", "reduce"]) {
  const p = await newPage(b, { reducedMotion: rm });
  const r = { reducedMotion: rm };
  let maxLayers = 0;
  await p.exposeFunction("__max", (n) => {
    maxLayers = Math.max(maxLayers, n);
  });
  await p.addInitScript(() =>
    new MutationObserver(() =>
      window.__max?.(
        document.querySelectorAll(".menu-fx-layer:not(.menu-fx-terrain)")
          .length,
      ),
    ).observe(document, { childList: true, subtree: true }),
  );
  await seed(p);
  await p.reload();
  await p.locator("#solo").waitFor();
  // Title: decide then immediately return; no accent or pressed state survives.
  await p.locator("#solo").click();
  await p.locator("#pt-home").click();
  await p.locator("#solo").waitFor();
  await p.waitForTimeout(400);
  r.titleQuickBack = await p.evaluate(() => ({
    accents: document.querySelectorAll(".title-motion-accent").length,
    pressed: document.querySelectorAll(".title-pressed").length,
  }));
  assert.deepEqual(r.titleQuickBack, { accents: 0, pressed: 0 });
  // Rapid equipment changes: three rows without waiting.
  await p.locator("#solo").click();
  for (const id of [
    "v2-starter-rocket",
    "v2-starter-rifle",
    "v2-starter-rocket",
  ])
    await p.locator(`[data-row="${id}"] [data-detail]`).click({ delay: 0 });
  const equipNow = await fxCount(p);
  r.rapidEquipMaxSlotTrace = await p.locator(".menu-fx-trace").count();
  assert.ok(r.rapidEquipMaxSlotTrace <= 1);
  await settle(p);
  r.rapidEquipEnd = await fxCount(p);
  r.rapidEquipSaved = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3"))
        .soldiers[0].equipped[0],
  );
  assert.equal(r.rapidEquipSaved, "v2-starter-rocket");
  // Stage changes in a row: only the last silhouette remains.
  for (const i of [1, 0, 1])
    await p.evaluate((i) => {
      const s = document.querySelector("#pt-stage");
      s.value = s.options[i].value;
      s.dispatchEvent(new Event("change"));
    }, i);
  r.terrainLayers = await p.locator(".menu-fx-terrain").count();
  assert.equal(r.terrainLayers, 1);
  // Rapid crafting.
  await p.locator("#pt-base").click();
  await p.locator("#pt-base-accessories").click();
  for (let i = 0; i < 3; i++) await p.locator("#pt-craft").click({ delay: 0 });
  await settle(p);
  r.rapidCraftEnd = await fxCount(p);
  r.rapidCraftPowder = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")).powder,
  );
  // Leave mid-effect: craft then go to base immediately.
  await p.locator("#pt-craft").click();
  await p.locator("#pt-base").click();
  await p.waitForTimeout(100);
  r.leaveMidCraft = await fxCount(p);
  assert.deepEqual(r.leaveMidCraft, { layers: 0, anims: 0 });
  // Growth commit then leave immediately.
  await p.locator("#pt-base-growth").click();
  await p.locator(".radar-hp").click();
  await p.locator('[data-growth-skill="hp"][data-growth-level="1"]').click();
  await p.locator("#pt-allocate").click();
  await p.locator("#pt-confirm").click();
  await p.locator("#pt-home").click();
  await p.waitForTimeout(100);
  r.leaveMidGrowth = await fxCount(p);
  assert.deepEqual(r.leaveMidGrowth, { layers: 0, anims: 0 });
  // Tutorial tabs: rapid switching keeps at most one annotation.
  await p.locator("#home-tutorial").click();
  for (const i of [1, 2, 0, 2, 1])
    await p.locator(`#tutorial-tab-${i}`).click({ delay: 0 });
  r.guideLayers = await p.locator(".menu-fx-guide").count();
  assert.ok(r.guideLayers <= 1);
  await p.locator(".dialog-close").click();
  await settle(p);
  // Settings: slider dragged through several values keeps one check.
  await p.locator("#home-settings").click();
  for (const v of ["0.2", "0.4", "0.6", "0.8", "0.5"])
    await p.locator('[data-preference="volume"]').fill(v);
  r.settingsChecks = await p.locator(".menu-fx-check").count();
  assert.ok(r.settingsChecks <= 1);
  r.settingsVolume = await p.locator('[data-preference="volume"]').inputValue();
  // Close settings mid-check.
  await p.locator(".dialog-close").click();
  await p.waitForTimeout(150);
  r.closeMidCheck = await fxCount(p);
  assert.deepEqual(r.closeMidCheck, { layers: 0, anims: 0 });
  // Report: rapid enemy switching leaves at most one analysis veil.
  await p.locator("#open-bestiary").click();
  await p
    .locator('.enemy-viewport[data-asset="ready"]')
    .waitFor({ timeout: 60000 });
  const enemies = p.locator("[data-enemy]");
  for (const i of [4, 0, 4, 1, 4]) await enemies.nth(i).click({ delay: 0 });
  r.mosaicMax = await p.locator(".menu-fx-mosaic").count();
  assert.ok(r.mosaicMax <= 1);
  await p.locator("#report-close").click();
  await p.waitForTimeout(150);
  r.reportClosed = await fxCount(p);
  assert.deepEqual(r.reportClosed, { layers: 0, anims: 0 });
  r.maxSimultaneousLayers = maxLayers;
  if (rm === "reduce") assert.equal(maxLayers, 0);
  r.errors = p.errors;
  assert.deepEqual(p.errors, []);
  results.push(r);
  await p.close();
}
fs.mkdirSync("dist-validation/menu-effects", { recursive: true });
fs.writeFileSync(
  "dist-validation/menu-effects/rapid.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
await b.close();
