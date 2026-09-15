import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Local fixture only. Never use this known password/config for deployment.
const base = process.argv[2] || "http://127.0.0.1:5361";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const out = "dist-validation/admin-routes";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
const snapshot = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => /swarm-front.*(progression|save)/.test(k))
        .sort()
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  );
async function picker(page, id, value) {
  const index = await page
    .locator("#" + id)
    .evaluate((s, v) => [...s.options].findIndex((o) => o.value === v), value);
  assert.ok(index >= 0);
  await page.locator(`[data-game-select-for="${id}"]`).click();
  await page.locator(`dialog[open] [data-option-index="${index}"]`).click();
  assert.equal(await page.locator("#" + id).inputValue(), value);
}
try {
  for (const entry of ["", "?playtest=1"]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const row = { entry: entry || "/", errors };
    results.push(row);
    try {
      await page.goto(base + "/" + entry);
      await page.locator("#solo").waitFor();
      if (await page.locator("#landscape-start").isVisible())
        await page.locator("#landscape-start").click();
      assert.equal(new URL(page.url()).searchParams.has("playtest"), false);
      assert.equal(await page.locator("#pt-developer-exit").count(), 0);
      await page.locator("#solo").click();
      await page.locator("#player-name").fill("通常隊員");
      await page.locator("#player-name-form button[type=submit]").click();
      await page.locator("#pt-confirm").click();
      await page.locator("#pt-home").click();
      await page.evaluate(() =>
        localStorage.setItem(
          "swarm-front-progression-v2-test",
          "protected-test-sentinel",
        ),
      );
      const before = await snapshot(page);
      assert.equal(
        JSON.parse(before["swarm-front-progression-v2-normal"]).mode,
        "normal",
      );
      const normalBefore = JSON.parse(
        before["swarm-front-progression-v2-normal"],
      );
      assert.equal(normalBefore.armoryMigration, 1);
      assert.ok(normalBefore.revision >= 1);
      await page.locator("#home-settings").click();
      await page.locator("#pt-developer-entry").click();
      await page.locator("#developer-password").fill("wrong-password");
      await page.locator("#developer-login-submit").click();
      await page
        .locator("#developer-login-note")
        .filter({ hasText: "パスワードが違います" })
        .waitFor();
      assert.equal(
        (
          await (
            await context.request.get(base + "/api/developer/session")
          ).json()
        ).authenticated,
        false,
      );
      await page
        .locator("#developer-password")
        .fill("test-only-random-developer-password");
      await page.locator("#developer-login-submit").click();
      await page.locator("#pt-developer-exit").waitFor();
      assert.equal(new URL(page.url()).search, "?developer=1");
      assert.ok(
        (await context.cookies()).find((c) => c.name === "swarm_developer")
          ?.httpOnly,
      );
      assert.deepEqual(await snapshot(page), before);
      await page.locator("#solo").click();
      await picker(page, "pt-stage", "20");
      assert.equal(await page.locator("#pt-start").isEnabled(), true);
      await picker(page, "pt-filter", "rifle");
      await page.locator('[data-lock="developer-rifle-0"]').click();
      assert.equal(
        await page
          .locator('[data-lock="developer-rifle-0"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .locator('[data-row="developer-rifle-0"] [data-detail]')
        .click();
      assert.equal(
        await page.locator('[data-pinned="developer-rifle-0"]').count(),
        1,
      );
      assert.deepEqual(await snapshot(page), before);
      await page.locator("#pt-settings").click();
      await page.locator("#edit-player-name").click();
      await page.locator("#player-name").fill("管理検証隊員");
      await page.locator("#player-name-form button[type=submit]").click();
      await page.locator("#pt-layout").click();
      await page.locator("#layout-reset").click();
      await page.locator("#layout-scope-count").selectOption("2");
      await page.locator("#layout-save").click();
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("swarm-front-controls-v1"))
              .secondScope,
        ),
        true,
      );
      assert.deepEqual(await snapshot(page), before);
      await page.reload();
      await page.locator("#solo").click();
      assert.equal(
        await page
          .locator('[data-lock="developer-rifle-0"]')
          .getAttribute("aria-pressed"),
        "false",
      );
      await page.locator("#pt-home").click();
      await page.screenshot({
        path: `${out}/${entry ? "legacy-link" : "root"}-admin.png`,
      });
      await page.locator("#pt-developer-exit").click();
      await page.waitForURL((url) => url.search === "");
      await page.locator("#solo").waitFor();
      assert.equal(new URL(page.url()).search, "");
      assert.deepEqual(await snapshot(page), before);
      assert.equal(
        (
          await (
            await context.request.get(base + "/api/developer/session")
          ).json()
        ).authenticated,
        false,
      );
      const normalAfter = JSON.parse(
        (await snapshot(page))["swarm-front-progression-v2-normal"],
      );
      assert.deepEqual(normalAfter.inventory, normalBefore.inventory);
      assert.deepEqual(normalAfter.soldiers, normalBefore.soldiers);
      assert.ok(
        normalAfter.inventory.every((w) => !w.id.startsWith("developer-")),
      );
      await page.locator("#home-settings").click();
      await page.locator("#edit-player-name").click();
      assert.equal(
        await page.locator("#player-name").inputValue(),
        "管理検証隊員",
      );
      await page.goto(base + "/");
      await page.locator("#home-settings").click();
      await page.locator("#pt-layout").click();
      assert.equal(await page.locator("#layout-scope-count").inputValue(), "2");
      await page.goto(base + "/?developer=1");
      await page.locator("#developer-login").waitFor();
      assert.equal(await page.locator("#pt-developer-exit").count(), 0);
      assert.deepEqual(await snapshot(page), before);
      await page.locator("#developer-login .dialog-close").click();
      await page.goto(base + "/?coop=1");
      await page.locator(".room-entry #launch").waitFor();
      assert.equal(await page.locator("#pt-growth").count(), 0);
      assert.deepEqual(await snapshot(page), before);
      assert.deepEqual(errors, []);
      Object.assign(row, {
        normalSaveValid: true,
        legacyRedirect: true,
        wrongDenied: true,
        authenticated: true,
        unlockedStage20: true,
        picker: true,
        nameEdit: true,
        scope2: true,
        adminReloadReset: true,
        savesPreserved: true,
        normalInventoryAndEquipmentUnchanged: true,
        adminWeaponsNotPersisted: true,
        nameAndLayoutSharedWithNormal: true,
        logoutRevoked: true,
        directDenied: true,
        coopRoute: true,
      });
      console.log("PASS", entry || "/");
    } catch (error) {
      row.error = error.stack;
      row.body = await page.locator("body").innerText();
      await page.screenshot({ path: `${out}/failure.png` });
      throw error;
    } finally {
      await context.close();
    }
  }
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const assets = [
    "index.html",
    ...fs
      .readdirSync("dist/assets")
      .filter((p) => /\.(js|css)$/.test(p))
      .map((p) => "assets/" + p),
  ];
  for (const path of assets) {
    const response = await fetch(base + "/" + path);
    assert.equal(response.status, 200);
    assert.equal(
      sha(Buffer.from(await response.arrayBuffer())),
      sha(fs.readFileSync("dist/" + path)),
    );
  }
  results.push({ productionAssetHashes: assets.length });
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
