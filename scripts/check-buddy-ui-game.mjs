import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const out = "dist-validation/buddy-ui-game";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const uiOnly = process.env.UI_ONLY === "1";
const results = [],
  errors = [];
let page;
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/buddy-seed", (r) =>
      r.fulfill({ contentType: "text/html", body: "<html></html>" }),
    );
    await page.goto(origin + "/buddy-seed");
    await page.evaluate(async () => {
      const { freshProgress, newSaveKey } =
        await import("/src/client/progression-save.ts");
      const { freshBuddyProgress } =
        await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } =
        await import("/src/shared/enemy-identity.ts");
      const s = freshProgress("normal");
      s.buddies = freshBuddyProgress();
      s.buddies.tickets = 3;
      s.encounters = Object.fromEntries(
        Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]),
      );
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "バディUI検証");
    });
    await page.route(/\/src\/client\/render\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst r=Renderer.prototype.render;Renderer.prototype.render=function(...a){if(a[0]){window.testWorld=a[0];window.testView=this;if(a[0].players[0])a[0].players[0].safe=999;}return r.apply(this,a)};",
      });
    });
    await page.goto(origin + "/", { timeout: 120000 });
    const tap = async (sel) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(sel).click();
    };
    const shot = async (name) => {
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
    };
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-base");
    await tap("#pt-base-buddy");
    await expect(page.locator('[data-bd="starter-confirm"]')).toBeDisabled();
    await shot("starter");
    await tap('[data-bd="starter-pick"][data-id="tatara"]');
    await tap('[data-bd="starter-confirm"]');
    await expect(page.locator("#bd-tab-recruit")).toBeVisible();
    const read = () =>
      page.evaluate(async () => {
        const { loadProgress } =
          await import("/src/client/progression-save.ts");
        return loadProgress("normal").buddies;
      });
    expect((await read()).selected).toBe("tatara");
    await tap("#bd-tab-recruit");
    await shot("recruit");
    await tap('[data-bd="draw"]');
    await expect(page.locator('[data-bd="result-close"]')).toBeVisible();
    let state = await read();
    expect(state.tickets).toBe(2);
    expect(state.draws).toHaveLength(1);
    await tap('[data-bd="result-close"]');
    await page.evaluate(async () => {
      const { newSaveKey } = await import("/src/client/progression-save.ts");
      const key = newSaveKey("normal");
      const orig = Storage.prototype.setItem;
      window.restoreSave = () => (Storage.prototype.setItem = orig);
      Storage.prototype.setItem = function (k, v) {
        if (k === key) throw Error("fixture:保存失敗");
        return orig.call(this, k, v);
      };
    });
    await tap('[data-bd="draw"]');
    await expect(page.locator('[data-bd="retry"]')).toBeVisible();
    expect((await read()).tickets).toBe(2);
    await shot("save-failure");
    await page.evaluate(() => window.restoreSave());
    await tap('[data-bd="retry"]');
    await expect(page.locator('[data-bd="result-close"]')).toBeVisible();
    state = await read();
    expect(state.tickets).toBe(1);
    expect(state.draws).toHaveLength(2);
    await tap('[data-bd="result-close"]');
    if (uiOnly) {
      results.push({
        width,
        height,
        starter: true,
        draws: 2,
        saveRetry: true,
        uiOnly: true,
      });
      await page.close();
      page = null;
      continue;
    }
    await tap("#pt-gear");
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await expect(page.locator("#buddy")).toBeVisible();
    await page.waitForFunction(
      () => !!window.testView.buddies.entries.get("solo")?.model,
    );
    const ready = await page.locator("#buddy").boundingBox();
    expect(ready.width).toBeGreaterThanOrEqual(44);
    await shot("hud-ready");
    await page.locator("#buddy").click();
    await page.waitForFunction(
      () => window.testWorld.buddies.entries.solo.lastSkillAt >= 0,
    );
    await expect(page.locator("#buddy")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await shot("hud-cooldown");
    await tap("#pause");
    await tap("#pt-retire");
    await tap("#pt-confirm");
    await page.waitForFunction(
      () => window.testView.buddies.entries.size === 0,
    );
    expect((await read()).owned.tatara.xp).toBe(0);
    results.push({
      width,
      height,
      starter: true,
      draws: 2,
      saveRetry: true,
      skillButton: true,
      retireXp: 0,
    });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (error) {
  errors.push(String(error));
  if (page)
    await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(
    out + (uiOnly ? "/menu-results.json" : "/results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
