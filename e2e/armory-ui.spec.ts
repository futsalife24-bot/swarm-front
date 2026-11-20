import { test, expect } from "@playwright/test";
import { freshProgress, newSaveKey } from "../src/client/progression-save";
import { STARTERS } from "../src/shared/defs";
import { makeWeapon } from "../src/shared/progression";
import { openArmory } from "./navigation";

const PROGRESS_KEY = newSaveKey("normal");
const live = (selector: string) => `body.playtest > main#ui ${selector}`;


test("armory stays readable and preserves protection and atomic deletion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const seed = freshProgress("normal");
    seed.inventory = STARTERS.flatMap((weapon, weaponIndex) =>
      Array.from({ length: 8 }, (_, index) =>
        makeWeapon(
          `${weapon.kind}-${weaponIndex * 8 + index}`,
          weapon.kind,
          index % 4,
          { power: index, reload: -index, range: 0, rate: 0 },
          false,
          weaponIndex * 8 + index,
        ),
      ),
    );
    seed.soldiers[0].equipped = ["rifle-0", "shotgun-8"];
    seed.pending = [
      makeWeapon(
        "pending-1",
        "rifle",
        3,
        { power: 3, reload: -3, range: 0, rate: 0 },
        false,
        27,
        "reserve",
      ),
    ];
    seed.serial = 28;
    seed.locks = ["rifle-3"];
    await page.goto("/");
    await page.evaluate(
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
      { key: PROGRESS_KEY, seed },
    );
    await page.reload();
    await openArmory(page);

    const rows = page.locator(live(".pt-weapon-row[data-row]"));
    await expect(rows).toHaveCount(25);
    await expect(page.locator(live('[data-detail="pending-1"]'))).toHaveAttribute(
      "aria-label",
      /超過・整理待ち/,
    );
    await expect(page.getByRole("checkbox", { name: "AR-9 リーフを解体対象に選択" }).nth(3)).toBeDisabled();

    for (const viewport of [
      { width: 844, height: 390 },
      { width: 640, height: 280 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const list = document.querySelector(".pt-weapon-list")!;
        const row = document.querySelector(".pt-weapon-row[data-row]")!;
        const stats = row.querySelector(".pt-stat-inner")!;
        const rectangle = list.getBoundingClientRect();
        const rowRectangle = row.getBoundingClientRect();
        return {
          listWidth: list.clientWidth,
          listScroll: list.scrollWidth,
          statWidth: stats.clientWidth,
          statScroll: stats.scrollWidth,
          columns: stats.children.length,
          rowHeight: rowRectangle.height,
          visibleRows: rectangle.height / rowRectangle.height,
          bottom: rectangle.bottom,
          height: innerHeight,
        };
      });
      expect(layout.listScroll).toBeLessThanOrEqual(layout.listWidth + 1);
      expect(layout.statScroll).toBeLessThanOrEqual(layout.statWidth + 1);
      expect(layout.columns).toBe(6);
      expect(layout.rowHeight).toBe(30);
      expect(layout.visibleRows).toBeGreaterThan(1.6);
      expect(layout.bottom).toBeLessThanOrEqual(layout.height);
    }

    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator(live('.pt-weapon-list [data-detail="rifle-2"]')).tap();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("AR-9 リーフ");
    await expect(detail.locator(".pt-var-good")).not.toHaveCount(0);
    await detail.getByRole("button", { name: "戻る" }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.locator(live('.pt-weapon-list [data-lock="rifle-2"]')).tap();
    await expect(page.getByRole("checkbox", { name: "AR-9 リーフを解体対象に選択" }).nth(2)).toBeDisabled();
    await page.locator(live('.pt-weapon-list [data-lock="rifle-2"]')).tap();
    await page.getByRole("dialog").getByRole("button", { name: "確定" }).tap();
    await expect(page.getByRole("checkbox", { name: "AR-9 リーフを解体対象に選択" }).nth(2)).toBeEnabled();

    const saved = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        PROGRESS_KEY,
      );
    await page.getByRole("checkbox", { name: "AR-9 リーフを解体対象に選択" }).nth(2).check();
    await page.locator(live(".pt-bulk-menu")).last().locator("summary").tap();
    await page.getByRole("button", { name: /選択を解体/ }).tap();
    await page.getByRole("dialog").getByRole("button", { name: "キャンセル" }).tap();
    const before = await saved();
    expect(
      before.inventory.some((weapon: { id: string }) => weapon.id === "rifle-2"),
    ).toBe(true);

    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).restoreStorage = () =>
        (Storage.prototype.setItem = original);
      Storage.prototype.setItem = () => {
        throw Error("test quota");
      };
    });
    await page.getByRole("button", { name: /選択を解体/ }).tap();
    await page.getByRole("dialog").getByRole("button", { name: "確定" }).tap();
    await expect(page.getByRole("dialog")).toContainText("保存を再試行");
    expect(await saved()).toEqual(before);
    await page.evaluate(() => (window as any).restoreStorage());
    await page.getByRole("dialog").getByRole("button", { name: "保存を再試行" }).tap();
    const after = await saved();
    expect(
      after.inventory.some((weapon: Weapon) => weapon.id === "rifle-2"),
    ).toBe(false);
    expect(
      after.inventory.some((weapon: Weapon) => weapon.id === "pending-1"),
    ).toBe(true);
    expect(after.pendingWeapons).toEqual([]);

    await page.locator(live(".pt-view-menu")).last().locator("summary").tap();
    await page
      .locator(live('[data-list-choice="favorites"][data-value="only"]'))
      .tap();
    await expect(rows).toHaveCount(1);
    await page.reload();
    await openArmory(page, "tap");
    await page.locator(live(".pt-view-menu")).last().locator("summary").tap();
    await page
      .locator(live('[data-list-choice="favorites"][data-value="only"]'))
      .tap();
    await expect(rows).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test("weapon help preserves equipment and supports touch, close and keyboard", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 640, height: 280 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const tap = async (selector: string) => {
      const target = page.locator(`body.playtest > main#ui ${selector}:visible`).first();
      await target.scrollIntoViewIfNeeded();
      await target.tap();
    };
    await page.goto("/");
    const seed = freshProgress("normal");
    seed.inventory[0] = makeWeapon(
      "help-rifle",
      "rifle",
      1,
      { power: 0, reload: 0, range: 0, rate: 0 },
      false,
      0,
      "reserve",
    );
    seed.inventory[1] = makeWeapon(
      "help-shotgun",
      "shotgun",
      1,
      { power: 0, reload: 0, range: 0, rate: 0 },
      false,
      1,
      "repel",
    );
    seed.inventory[2] = makeWeapon(
      "help-rocket",
      "rocket",
      1,
      { power: 0, reload: 0, range: 0, rate: 0 },
      false,
      2,
      "chain",
    );
    seed.soldiers[0].equipped = ["help-rifle", "help-shotgun"];
    await page.evaluate(
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
      { key: PROGRESS_KEY, seed },
    );
    await page.reload();
    await openArmory(page);

    await tap('[data-effect-help="reserve"]');
    await expect(page.getByRole("dialog")).toContainText(
      "半分残っていれば25%短縮",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "閉じる" })
      .tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const saved = () =>
      page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY);
    const before = await saved();
    await tap("[data-menu-toggle]");
    await tap('[data-menu-destination="gear"]');
    const gearHelp = page.locator(live('[data-effect-help="reserve"]')).first();
    await gearHelp.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(gearHelp).toBeFocused();
    expect(await saved()).toBe(before);

    await tap("[data-menu-toggle]");
    await tap('[data-menu-destination="armory"]');
    for (const [effect, text] of [
      ["repel", "最大3m"],
      ["chain", "再誘爆はありません"],
    ] as const) {
      const help = page.locator(live(`[data-effect-help="${effect}"]`)).first();
      await tap(`[data-effect-help="${effect}"]`);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(text);
      const bounds = await dialog.evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        title: element.querySelector("h2")!.getBoundingClientRect().top,
        close: element.querySelector("button")!.getBoundingClientRect().bottom,
        bottom: element.getBoundingClientRect().bottom,
      }));
      expect(bounds.title).toBeGreaterThanOrEqual(bounds.top);
      expect(bounds.close).toBeLessThanOrEqual(bounds.bottom);
      await page.mouse.click(1, 1);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(help).toBeFocused();
    }
    expect(await saved()).toBe(before);
  } finally {
    await context.close();
  }
});

test("bulk dismantling protects favorites, previews powder, and persists atomically", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 280 });
  await page.goto("/");
  const seed = freshProgress("normal");
  seed.inventory.push(
    ...[0, 1, 2, 3].map((rarity) =>
      makeWeapon(
        `bulk-${rarity}`,
        "rifle",
        rarity,
        { power: rarity, reload: -rarity, range: 0, rate: 0 },
        false,
        3 + rarity,
      ),
    ),
  );
  seed.locks = ["bulk-3"];
  seed.pending = [
    makeWeapon(
      "waiting",
      "rifle",
      2,
      { power: 2, reload: -2, range: 0, rate: 0 },
      false,
      7,
    ),
  ];
  seed.serial = 8;
  await page.evaluate(
    ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
    { key: PROGRESS_KEY, seed },
  );
  await page.reload();
  await openArmory(page);
  const check = (id: string) =>
    page.locator(live(`[data-check="${id}"]`)).first();
  await expect(check("bulk-3")).toBeDisabled();
  await expect(check(seed.soldiers[0].equipped[0])).toBeDisabled();
  await page.locator(live(".pt-bulk-menu")).last().locator("summary").click();
  await expect(page.getByRole("button", { name: "選択を解体 (0)" })).toBeVisible();
  for (const id of ["bulk-0", "bulk-1", "waiting"]) await check(id).check();
  await expect(page.getByRole("button", { name: "選択を解体 (3)" })).toBeVisible();

  for (const viewport of [
    { width: 640, height: 280 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (let rarity = 0; rarity < 4; rarity++) {
      const row = page
        .locator(live('[data-row="bulk-' + rarity + '"]'))
        .first();
      await expect(row).toHaveCSS("--weapon-tier", /.+/);
      await row.locator("[data-detail]").click();
      await expect(page.getByRole("dialog")).toContainText("AR-9 リーフ");
      await page.getByRole("dialog").locator("[data-menu-back]").click();
    }
    const layout = await page.evaluate(() => {
      const list = document.querySelector(".pt-weapon-list")!;
      const workspace = document.querySelector(".pt-screen")!;
      return {
        overflow: list.scrollWidth - list.clientWidth,
        bottom: workspace.getBoundingClientRect().bottom,
        height: innerHeight,
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.bottom).toBeLessThanOrEqual(layout.height);
  }

  const saved = () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      PROGRESS_KEY,
    );
  const before = await saved();
  await page.getByRole("button", { name: /選択を解体/ }).click();
  await expect(page.getByRole("dialog")).toContainText("3丁 → +6");
  await page.getByRole("dialog").getByRole("button", { name: "キャンセル" }).click();
  expect(await saved()).toEqual(before);

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () =>
      (Storage.prototype.setItem = original);
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await page.getByRole("button", { name: /選択を解体/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確定" }).click();
  await expect(page.getByRole("dialog")).toContainText("保存を再試行");
  expect(await saved()).toEqual(before);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole("dialog").getByRole("button", { name: "再試行" }).click();
  await expect.poll(async () => (await saved()).powder).toBe(6);
  expect(
    (await saved()).inventory.map((weapon: Weapon) => weapon.id),
  ).not.toContain("waiting");
  await page.reload();
  await openArmory(page);
  await expect(page.locator(live('[data-resource-help="powder"]'))).toHaveAttribute(
    "aria-label",
    /所持6/,
  );
});
