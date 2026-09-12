import { test, expect, type Page } from "@playwright/test";
import { fresh, SAVE_KEY } from "../src/client/save";
import { STARTERS, type Weapon } from "../src/shared/defs";
const dir = "dist-validation/menu-ui";
function fullSave() {
  const seed = fresh();
  seed.inventory = STARTERS.flatMap((w) =>
    Array.from(
      { length: 8 },
      (_, i) =>
        ({
          ...w,
          id: i ? `${w.kind}-${i}` : w.id,
          rarity: i % 4,
          power: Number((1 + i * 0.03).toFixed(3)),
          effect:
            i % 4 === 0
              ? "none"
              : i % 3 === 0
                ? "reserve"
                : w.kind === "rifle"
                  ? "pierce"
                  : w.kind === "rocket"
                    ? "chain"
                    : "repel",
        }) as Weapon,
    ),
  );
  seed.pendingWeapons = [{ ...seed.inventory[2], id: "pending-1" }];
  seed.favorites = ["rifle-3"];
  return seed;
}
async function seeded(page: Page) {
  await page.clock.install();
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(seed));
    },
    { key: SAVE_KEY, seed: fullSave() },
  );
  await page.goto("/");
  await page.locator("#solo").waitFor();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 2000),
  );
}
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
async function reachable(page: Page, selector: string) {
  const data = await page.locator(selector).evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return {
      visible: r.width > 0 && r.height > 0,
      inside:
        r.x >= 0 &&
        r.y >= 0 &&
        r.right <= innerWidth + 1 &&
        r.bottom <= innerHeight + 1,
      hit: !!hit && (hit === e || e.contains(hit)),
    };
  });
  expect(data, selector).toEqual({ visible: true, inside: true, hit: true });
}
for (const [width, height] of [
  [640, 280],
  [844, 390],
  [915, 412],
  [1280, 582],
  [1100, 610],
  [1280, 720],
  [390, 844],
]) {
  test(`menus keep primary choices reachable at ${width}x${height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await seeded(page);
    if (width > height)
      for (const id of [
        "solo",
        "coop",
        "open-armory",
        "open-bestiary",
        "home-settings",
        "changelog",
      ])
        await reachable(page, `#${id}`);
    await page.locator("#solo").click();
    for (const s of [
      "#stage-select",
      '[data-pick="0"]',
      '[data-pick="1"]',
      "#launch",
      "#gear-armory",
    ])
      await reachable(page, s);
    const geometry = await page.locator(".gear-brief").evaluate((e) => ({
      width: e.clientWidth,
      horizontal: e.scrollWidth,
      vertical: e.scrollHeight,
      height: e.clientHeight,
    }));
    expect(geometry.horizontal).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.vertical).toBeLessThanOrEqual(geometry.height + 1);
    const slotBottom = await page
      .locator('[data-pick="1"]')
      .evaluate((e) => e.getBoundingClientRect().bottom);
    const workspaceBottom = await page
      .locator(".gear-workspace")
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect(slotBottom).toBeLessThanOrEqual(workspaceBottom + 1);
    expect(
      await page
        .locator(".weapon-list")
        .evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${dir}/verified-gear-${width}.png` });
    await page.locator("#gear-armory").click();
    expect(await page.locator(".armory-list article").count()).toBe(25);
    await expect(
      page.locator('[data-armory-select="pending-1"] .armory-row-effect'),
    ).toHaveText("貫通 ×3");
    for (const s of [
      "#armory-home",
      "#armory-gear",
      "#armory-organize",
      ".armory-effect [data-effect-help]",
      ".armory-detail-actions [data-favorite]",
    ])
      await reachable(page, s);
    for (const selector of [".armory-list", ".armory-detail"])
      expect(
        await page
          .locator(selector)
          .evaluate((e) => e.scrollWidth - e.clientWidth),
      ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${dir}/verified-armory-${width}.png` });
    await page.locator("#armory-organize").click();
    await page.locator('[data-dismantle-check="pending-1"]').check();
    await reachable(page, "#armory-dismantle");
    await page.screenshot({ path: `${dir}/verified-organize-${width}.png` });
    expect(errors).toEqual([]);
  });
}
test("equipment stays inside its frame with safe areas and enlarged text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await seeded(page);
  await page.locator("#solo").click();
  await page.locator('[data-pick="1"]').click();
  await page.addStyleTag({
    content:
      ":root { --safe-top: 100px; --safe-bottom: 40px; } .gear .gear-footer .status { font-size: 16px; }",
  });
  await page
    .locator(".gear-footer .status")
    .evaluate(
      (e) => (e.textContent = "作戦を離脱しました。未確定品は保存されません。"),
    );
  for (const selector of ['[data-pick="0"]', '[data-pick="1"]']) {
    await reachable(page, selector);
    const geometry = await page.locator(selector).evaluate((e) => {
      const r = e.getBoundingClientRect();
      const limit = document
        .querySelector(".gear-workspace")!
        .getBoundingClientRect();
      return {
        bottom: r.bottom,
        limit: limit.bottom,
        overflow: e.scrollHeight - e.clientHeight,
      };
    });
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.limit);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }
  await page.screenshot({
    path: "dist-validation/menu-design/gear-safe-area.png",
  });
});
test("equipment browsing preserves scroll/focus and effect help never equips", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await seeded(page);
  await page.locator("#solo").click();
  await page.locator('[data-equip="rocket-7"]').scrollIntoViewIfNeeded();
  const top = await page.locator(".weapon-list").evaluate((e) => e.scrollTop);
  await page.locator('[data-equip="rocket-7"]').focus();
  await page.keyboard.press("Enter");
  expect((await saved(page)).equipped[0]).toBe("rocket-7");
  expect(
    await page.locator(".weapon-list").evaluate((e) => e.scrollTop),
  ).toBeCloseTo(top, 0);
  await expect(page.locator('[data-equip="rocket-7"]')).toBeFocused();
  const before = await saved(page);
  await page.locator('[data-equip="rocket-7"] [data-effect-help]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("半径3.5m");
  expect(await saved(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-equip="rocket-7"] [data-effect-help]'),
  ).toBeFocused();
  await page.locator('[data-pick="1"]').click();
  expect(
    await page.locator(".weapon-list").evaluate((e) => e.scrollTop),
  ).toBeCloseTo(top, 0);
  await page.locator('[data-equip="rocket-7"]').click();
  expect(new Set((await saved(page)).equipped).size).toBe(2);
  await page.locator("#weapon-filter").selectOption("rifle");
  await expect(page.locator("#weapon-filter")).toBeFocused();
  expect(await page.locator(".weapon-list").evaluate((e) => e.scrollTop)).toBe(
    0,
  );
});
test("settings save, failure recovery, keyboard tabs, changelog and layout navigation", async ({
  page,
}) => {
  await seeded(page);
  await page.locator("#home-settings").click();
  await page.locator("#volume").fill("0.6");
  await expect(page.locator('output[for="volume"]')).toHaveText("60%");
  expect((await saved(page)).volume).toBe(0.6);
  await expect(page.locator(".settings-status")).toContainText("保存しました");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    (window as any).restoreMenuStorage = () =>
      (Storage.prototype.setItem = set);
    Storage.prototype.setItem = () => {
      throw Error("quota test");
    };
  });
  await page.locator("#volume").fill("0.9");
  await expect(page.locator(".settings-status")).toContainText(
    "保存できません",
  );
  await expect(page.locator("#volume")).toHaveValue("0.6");
  expect((await saved(page)).volume).toBe(0.6);
  await page.evaluate(() => (window as any).restoreMenuStorage());
  await page.locator("#tab-preferences").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tab-controls")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.locator("#layout-settings").click();
  await expect(page.locator(".layout-editor")).toBeVisible();
  await page.locator("#layout-cancel").click();
  await expect(page.locator("#home-settings")).toBeVisible();
  await page.locator("#changelog").click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-labelledby",
    "menu-dialog-title",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#changelog")).toBeFocused();
});
test("damaged save can still be exported from settings", async ({ page }) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, '{"broken":true}'),
    SAVE_KEY,
  );
  await page.goto("/");
  await page.locator("#home-settings").click();
  await page.locator("#tab-save").click();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").locator("#export").click();
  expect((await download).suggestedFilename()).toBe("swarm-front-save.json");
});
test("bestiary and room entry remain usable with modal exit and full enemy list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await seeded(page);
  await page.locator("#open-bestiary").click();
  await expect(page.locator("[data-enemy]")).toHaveCount(6);
  for (const enemy of [
    "ant",
    "spider",
    "crawler",
    "spitter",
    "hornet",
    "boss",
  ]) {
    await page.locator(`[data-enemy="${enemy}"]`).click();
    await expect(page.locator(".enemy-description")).toContainText("攻撃方法");
  }
  await page.locator('[data-worm="true"]').click();
  await reachable(page, "#report-close");
  await page.screenshot({ path: `${dir}/verified-bestiary.png` });
  await page.keyboard.press("Escape");
  await page.locator("#coop").click();
  await expect(page.locator(".room-entry")).toBeVisible();
  await reachable(page, "#launch");
  await reachable(page, "#home");
  await page.screenshot({ path: `${dir}/verified-coop-entry.png` });
});
