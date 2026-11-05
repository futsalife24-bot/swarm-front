import { chromium, expect } from "@playwright/test";
import fs from "node:fs";

const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const out = "dist-validation/buddy-growth-ui";
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [],
  browserMessages = [];
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
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
    page.on("pageerror", (e) => errors.push({ width, message: e.message }));
    page.on("console", (e) => {
      if (["error", "warning"].includes(e.type()))
        browserMessages.push({
          width,
          type: e.type(),
          message: e.text().slice(0, 400),
        });
    });
    await page.route("**/buddy-growth-seed", (route) =>
      route.fulfill({ contentType: "text/html", body: "<html></html>" }),
    );
    await page.goto(origin + "/buddy-growth-seed");
    await page.evaluate(async () => {
      const { freshProgress, newSaveKey } =
        await import("/src/client/progression-save.ts");
      const { freshBuddyProgress, chooseStarterBuddy, buddyXpForLevel } =
        await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } =
        await import("/src/shared/enemy-identity.ts");
      const save = freshProgress("normal");
      save.buddies = chooseStarterBuddy(freshBuddyProgress(), "tatara");
      save.buddies.owned.tatara.xp = buddyXpForLevel(10);
      save.buddies.owned.yosuga = { xp: 0, breakthrough: 0 };
      save.buddies.fragments = 3;
      save.encounters = Object.fromEntries(
        Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]),
      );
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(save));
      localStorage.setItem("swarm-front-player-name-v1", "バディ育成UI検証");
    });
    const tap = async (selector) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(selector).click();
    };
    const enter = async () => {
      await tap(".title-entry-start");
      await tap("#solo");
      await tap('[data-operation="advance"]');
      await page.waitForFunction(() =>
        document.querySelector("#pt-confirm,#pt-base"),
      );
      if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
      await tap("#pt-base");
      await tap("#pt-base-buddy");
    };
    const shot = async (name) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
    };
    const read = () =>
      page.evaluate(async () => {
        const { loadProgress } =
          await import("/src/client/progression-save.ts");
        const { getBuddyUiState } =
          await import("/src/client/buddy-presentation.ts");
        const save = loadProgress("normal");
        return {
          progress: save.buddies,
          owned: getBuddyUiState(save).owned,
          revision: save.revision,
        };
      });
    await page.goto(origin + "/", { timeout: 120000 });
    await enter();
    const initial = await read();
    expect(initial.owned.tatara.level).toBe(10);
    expect(initial.owned.tatara.levelCap).toBe(10);
    expect(initial.progress.fragments).toBe(3);
    await expect(
      page.locator('[data-bd="breakthrough"][data-id="tatara"]'),
    ).toBeEnabled();
    await shot("before-breakthrough");
    await tap('[data-bd="breakthrough"][data-id="tatara"]');
    await expect(page.locator(".bd-toast")).toContainText("10 → 20");
    const after = await read();
    expect(after.owned.tatara.level).toBe(10);
    expect(after.owned.tatara.levelCap).toBe(20);
    expect(after.progress.owned.tatara.breakthrough).toBe(1);
    expect(after.progress.fragments).toBe(0);
    await expect(
      page.locator('[data-bd="breakthrough"][data-id="tatara"]'),
    ).toBeDisabled();
    await expect(page.locator(".bd-reason")).toContainText("Lv20");
    await shot("after-breakthrough");
    await tap('[data-bd="focus"][data-id="yosuga"]');
    await tap('[data-bd="equip"][data-id="yosuga"]');
    await expect(page.locator(".bd-detail-title .is-escort")).toHaveText(
      "同行中",
    );
    expect((await read()).progress.selected).toBe("yosuga");
    await shot("yosuga-equipped");
    await page.reload({ timeout: 120000 });
    await enter();
    const reloaded = await read();
    expect(reloaded.progress).toEqual({
      ...after.progress,
      selected: "yosuga",
    });
    await expect(page.locator("#bd-detail-name")).toContainText("ヨスガ");
    await expect(page.locator(".bd-detail-title .is-escort")).toHaveText(
      "同行中",
    );
    await tap('[data-bd="focus"][data-id="tatara"]');
    await expect(
      page.locator('[data-bd="breakthrough"][data-id="tatara"]'),
    ).toBeDisabled();
    await shot("reloaded-growth");
    const result = {
      width,
      height,
      fixture:
        "隔離保存：タタラLv10・突破素材3・ヨスガ所持。報酬獲得過程は対象外。",
      before: initial,
      after,
      reloaded,
      breakthroughUi: true,
      disabledSecondBreakthrough: true,
      equipUi: true,
      reloadPreserved: true,
    };
    results.push(result);
    console.log(
      JSON.stringify({
        width,
        height,
        breakthroughUi: true,
        disabledSecondBreakthrough: true,
        equipUi: true,
        reloadPreserved: true,
      }),
    );
    await page.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (error) {
  errors.push({ message: String(error) });
  if (page)
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { browser: browser.version(), origin, results, errors, browserMessages },
      null,
      2,
    ),
  );
  await browser.close();
}
