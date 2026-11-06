import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const out = process.env.OUT ?? "dist-validation/advance-pause-ui/before";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5198";
const revised = process.env.REVISED === "1";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const errors = [],
  results = [];
let page;
const capture = async (options) => {
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.waitForTimeout(300); // menuDialogの240ms entranceを撮影しない
  await page.screenshot(options);
};
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
    [568, 320],
  ]) {
    console.log(`viewport ${width}x${height}: seed`);
    page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/pause-seed", (r) =>
      r.fulfill({ contentType: "text/html", body: "<html></html>" }),
    );
    await page.goto(origin + "/pause-seed");
    await page.evaluate(async () => {
      const { freshProgress, newSaveKey } =
        await import("/src/client/progression-save.ts");
      const { freshBuddyProgress, chooseStarterBuddy } =
        await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } =
        await import("/src/shared/enemy-identity.ts");
      const s = freshProgress("normal");
      s.buddies = chooseStarterBuddy(freshBuddyProgress(), "yosuga");
      s.encounters = Object.fromEntries(
        Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]),
      );
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "停止画面検証");
    });
    // 製品rendererをそのまま呼び、worldを観測。画面操作までの死亡防止のみfixture。
    await page.route(/\/src\/client\/render.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst qaRender=Renderer.prototype.render;Renderer.prototype.render=function(...a){if(a[0]){window.qaWorld=a[0];if(!window.qaAllowDown && a[0].players[0])a[0].players[0].safe=999;}return qaRender.apply(this,a)};",
      });
    });
    await page.goto(origin + "/", { timeout: 120000 });
    console.log(`viewport ${width}: title loaded`);
    const tap = async (sel) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(sel).click();
    };
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    await expect(page.locator("#controls")).toBeVisible();
    await page.waitForFunction(() => window.qaWorld?.phase === "battle");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await capture({ path: `${out}/battle-${width}.png` });
    console.log(`viewport ${width}: battle`);
    await tap("#pause");
    await expect(page.locator("#pt-resume")).toBeVisible();
    await capture({ path: `${out}/pause-${width}.png` });
    const stopped = await page.evaluate(() => window.qaWorld.time);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.qaWorld.time)).toBe(stopped);
    if (revised) {
      await expect(page.locator(".ap-buddy-name")).toHaveText("ヨスガ");
      await expect(page.locator(".ap-skill-text")).toContainText("持ち主");
      await tap("#pt-retire");
      await tap("#pt-cancel");
      await expect(page.locator("#pt-resume")).toBeVisible();
      expect(await page.evaluate(() => window.qaWorld.time)).toBe(stopped);
      await tap("#pt-pause-layout");
      await expect(page.locator("#settings-save .ap-pause")).toBeVisible();
      await tap("#pt-resume");
      await tap("#pause");
      await expect(page.locator(".ap-buddy-name")).toHaveText("ヨスガ");
      await tap("#pt-pause-layout");
      await tap("#pt-layout");
      await tap("#layout-cancel");
      await expect(page.locator(".ap-buddy-name")).toHaveText("ヨスガ");
      await page.waitForFunction(
        () =>
          !document
            .querySelector("dialog")
            ?.getAnimations()
            .some((a) => a.playState === "running"),
      );
      const geometry = await page.locator("#pause").boundingBox();
      expect(geometry.width).toBeGreaterThanOrEqual(44);
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      for (const selector of ["#pt-resume", "#pt-pause-layout", "#pt-retire"]) {
        const r = await page.locator(selector).boundingBox();
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width);
        expect(r.y + r.height).toBeLessThanOrEqual(height);
      }
      // 欠損は複製Worldから表示関数へ渡す。チェックポイントに不正データを保存しない。
      for (const state of ["none", "unknown", "missing"]) {
        await page.evaluate(async (state) => {
          const { getAdvanceBuddyView } =
            await import("/src/client/buddy-presentation.ts");
          const { advanceBuddyMarkup } =
            await import("/src/client/advance-pause-ui.ts");
          const fixture = structuredClone(window.qaWorld);
          const entries = fixture.buddies.entries;
          const original = entries.solo;
          if (state === "none") delete entries.solo;
          else
            entries.solo = {
              ...original,
              ...(state === "unknown"
                ? { buddyId: "unknown" }
                : {
                    level: NaN,
                    skillReadyAt: undefined,
                    healUntil: undefined,
                  }),
            };
          document.querySelector("dialog[open] .ap-buddy").outerHTML =
            advanceBuddyMarkup(getAdvanceBuddyView(fixture, "solo"));
        }, state);
        await expect
          .poll(() =>
            page.evaluate(() =>
              document
                .querySelector("dialog[open] .ap-buddy")
                ?.getAttribute("data-status"),
            ),
          )
          .toBe(
            state === "none"
              ? "none"
              : state === "unknown"
                ? "unavailable"
                : "present",
          );
        expect(
          await page.evaluate(
            () => document.querySelector("dialog[open] .ap-buddy")?.textContent,
          ),
        ).not.toMatch(/NaN|undefined|Infinity/);
        await capture({ path: `${out}/pause-${state}-${width}.png` });
      }
    }
    await tap("#pt-resume");
    await page.waitForFunction((t) => window.qaWorld.time > t, stopped);
    await page.evaluate(() => {
      window.qaAllowDown = true;
      window.qaWorld.players[0].safe = 0;
      window.qaWorld.players[0].hp = 0;
    });
    await expect(page.locator("#pt-defeat")).toBeVisible();
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    await capture({ path: `${out}/down-${width}.png` });
    await tap("#pt-defeat");
    await page.waitForFunction(() => document.body.dataset.screen === "result");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await capture({ path: `${out}/result-${width}.png` });
    console.log(`viewport ${width}: complete`);
    results.push({
      width,
      height,
      stopResume: true,
      downToResult: true,
      settingsReturnAndRetireCancel: revised,
    });
    await page.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (e) {
  errors.push(String(e));
  if (page)
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        errors,
        fixture:
          "save seed, renderer observation, safe until forced hp0; real solo game, no WS",
      },
      null,
      2,
    ),
  );
  await browser.close();
}
