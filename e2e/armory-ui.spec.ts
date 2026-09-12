import { test, expect } from "@playwright/test";
import { fresh, SAVE_KEY } from "../src/client/save";
import { STARTERS, type Weapon } from "../src/shared/defs";

test("armory stays readable and preserves selection, protection and atomic deletion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const seed = fresh();
    seed.inventory = STARTERS.flatMap((w) =>
      Array.from(
        { length: 8 },
        (_, i) =>
          ({
            ...w,
            id: i ? w.kind + "-" + i : w.id,
            rarity: i % 4,
            power: Number((1 + i * 0.04).toFixed(3)),
            rolls: {
              mag: 1.1,
              reload: Number((1.2 - i * 0.05).toFixed(3)),
              range: 1,
              rate: 1,
            },
          }) as Weapon,
      ),
    );
    seed.pendingWeapons = [
      { ...seed.inventory[0], id: "pending-1", rarity: 3 },
    ];
    seed.favorites = ["rifle-3"];
    await page.goto("/");
    await page.evaluate(
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
      { key: SAVE_KEY, seed },
    );
    await page.reload();
    await page.locator("#open-armory").click();
    await expect(page.locator(".armory-list article")).toHaveCount(25);
    await expect(
      page.locator('[data-armory-select="pending-1"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-armory-select="rifle-3"]').click();
    await expect(page.locator('[data-discard="rifle-3"]')).toBeDisabled();
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 640, height: 280 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const list = document.querySelector(".armory-list")!;
        const detail = document.querySelector(".armory-detail")!;
        const a = list.getBoundingClientRect(),
          b = detail.getBoundingClientRect();
        return {
          left: a.right,
          right: b.left,
          listWidth: list.clientWidth,
          listScroll: list.scrollWidth,
          detailWidth: detail.clientWidth,
          detailScroll: detail.scrollWidth,
          rowHeight: document
            .querySelector(".armory-row")!
            .getBoundingClientRect().height,
          columns: document.querySelector(".armory-row")!.children.length,
          visibleRows:
            a.height /
            document.querySelector(".armory-row")!.getBoundingClientRect()
              .height,
          bottom: Math.max(a.bottom, b.bottom),
          height: innerHeight,
        };
      });
      expect(layout.left).toBeLessThan(layout.right);
      expect(layout.listScroll).toBeLessThanOrEqual(layout.listWidth + 1);
      expect(layout.detailScroll).toBeLessThanOrEqual(layout.detailWidth + 1);
      expect(layout.visibleRows).toBeGreaterThan(1.6);
      expect(layout.rowHeight).toBeGreaterThanOrEqual(44);
      expect(layout.columns).toBe(7);
      expect(layout.bottom).toBeLessThanOrEqual(layout.height);
      await page.screenshot({
        path:
          "dist-validation/evidence/armory-after-" + viewport.width + ".png",
      });
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('[data-armory-select="rifle-2"]').click();
    await expect(page.locator(".armory-stats")).toContainText("-0.16");
    await expect(page.locator(".armory-stats .better")).not.toHaveCount(0);
    await page.locator('[data-favorite="rifle-2"]').click();
    await expect(page.locator('[data-discard="rifle-2"]')).toBeDisabled();
    await expect(
      page.locator('[data-armory-select="rifle-2"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-favorite="rifle-2"]').click();
    const saved = () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    const before = await saved();
    await page.locator('[data-discard="rifle-2"]').click();
    await page.locator("#dismantle-cancel").click();
    expect(await saved()).toEqual(before);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).restoreStorage = () =>
        (Storage.prototype.setItem = original);
      Storage.prototype.setItem = () => {
        throw Error("test quota");
      };
    });
    await page.locator('[data-discard="rifle-2"]').click();
    await page.locator("#dismantle-confirm").click();
    await expect(page.locator(".status")).toContainText("削除していません");
    expect(await saved()).toEqual(before);
    await page.evaluate(() => (window as any).restoreStorage());
    await page.locator('[data-discard="rifle-2"]').click();
    await page.locator("#dismantle-confirm").click();
    await expect(page.locator(".status")).toContainText("獲得しました");
    const after = await saved();
    expect(after.inventory.some((w: Weapon) => w.id === "rifle-2")).toBe(false);
    expect(after.inventory.some((w: Weapon) => w.id === "pending-1")).toBe(
      true,
    );
    await page.locator("#armory-filter").selectOption("pending");
    await expect(page.locator(".armory-list article")).toHaveCount(0);
    await expect(page.locator("[data-discard]")).toHaveCount(0);
    await page.locator("#armory-filter").selectOption("favorites");
    await expect(page.locator(".armory-list article")).toHaveCount(1);
    await page.reload();
    await page.locator("#open-armory").click();
    await page.locator("#armory-filter").selectOption("favorites");
    await expect(page.locator(".armory-list article")).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test("help preserves equipment and supports touch, Escape and keyboard", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 640, height: 280 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const seed = fresh();
    seed.inventory[0] = {
      ...seed.inventory[0],
      id: "help-rifle",
      rarity: 1,
      effect: "reserve",
    };
    seed.inventory[2] = { ...seed.inventory[2], rarity: 1, effect: "chain" };
    seed.equipped[0] = "help-rifle";
    seed.inventory[1] = { ...seed.inventory[1], rarity: 1, effect: "repel" };
    await page.evaluate(
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
      { key: SAVE_KEY, seed },
    );
    await page.reload();
    await page.locator("#open-armory").tap();
    await page.locator('[data-kind-help="rifle"]').tap();
    await expect(page.getByRole("dialog")).toContainText("中距離");
    await page.getByRole("button", { name: "閉じる", exact: true }).tap();
    await page.locator('[data-effect-help="reserve"]').tap();
    await expect(page.getByRole("dialog")).toContainText(
      "半分残っていれば25%短縮",
    );
    await page.screenshot({
      path: "dist-validation/evidence/weapon-help-mobile.png",
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator("#armory-gear").click();
    await expect(
      page.locator('[data-effect-help="quick"], .reload-help'),
    ).toHaveCount(0);
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      SAVE_KEY,
    );
    const help = page.locator('[data-effect-help="reserve"]').first();
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
    ).toBe(before);
    await page.screenshot({ path: "dist-validation/evidence/help-gear.png" });
    await page.locator("#gear-armory").click();
    await page
      .locator(`[data-armory-select="${seed.inventory[1].id}"]`)
      .click();
    await page.locator('[data-kind-help="shotgun"]').first().tap();
    await expect(page.getByRole("dialog")).toContainText("8発");
    await expect(page.getByRole("dialog")).toContainText("最大3体");
    await expect(page.getByRole("dialog")).toContainText("標準性能");
    await page.mouse.click(1, 1);
    for (const [effect, text] of [
      ["repel", "最大3m"],
      ["chain", "再誘爆はありません"],
    ]) {
      if (effect === "chain")
        await page
          .locator(`[data-armory-select="${seed.inventory[2].id}"]`)
          .click();
      await page.locator(`[data-effect-help="${effect}"]`).first().tap();
      await expect(page.getByRole("dialog")).toContainText(text);
      const bounds = await page.getByRole("dialog").evaluate((el) => ({
        top: el.getBoundingClientRect().top,
        title: el.querySelector("h2")!.getBoundingClientRect().top,
        close: el.querySelector("button")!.getBoundingClientRect().bottom,
        bottom: el.getBoundingClientRect().bottom,
      }));
      expect(bounds.title).toBeGreaterThanOrEqual(bounds.top);
      expect(bounds.close).toBeLessThanOrEqual(bounds.bottom);
      await page.screenshot({
        path: `dist-validation/evidence/help-${effect}.png`,
      });
      await page.getByRole("button", { name: "閉じる", exact: true }).tap();
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("bulk dismantling protects favorites, previews powder, and persists atomically", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 280 });
  await page.goto("/");
  const seed = fresh();
  seed.inventory.push(
    ...[0, 1, 2, 3].map(
      (rarity) => ({ ...STARTERS[0], id: `bulk-${rarity}`, rarity }) as Weapon,
    ),
  );
  seed.favorites = ["bulk-3"];
  seed.pendingWeapons = [{ ...STARTERS[0], id: "waiting", rarity: 2 }];
  await page.evaluate(
    ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
    { key: SAVE_KEY, seed },
  );
  await page.reload();
  await page.locator("#open-armory").click();
  const check = (id: string) => page.locator(`[data-dismantle-check="${id}"]`);
  await page.locator("#armory-organize").click();
  await expect(check("bulk-3")).toBeDisabled();
  await expect(check(seed.equipped[0])).toBeDisabled();
  await expect(page.locator("#armory-dismantle")).toBeDisabled();
  for (const id of ["bulk-0", "bulk-1", "waiting"]) await check(id).check();
  await expect(page.locator("#armory-dismantle")).toContainText(
    "3丁を分解（+14）",
  );
  for (const viewport of [
    { width: 640, height: 280 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (let rarity = 0; rarity < 4; rarity++) {
      await page.locator(`[data-armory-select="bulk-${rarity}"]`).click();
      await expect(page.locator(".armory-detail")).toHaveClass(
        new RegExp(`rarity${rarity}`),
      );
    }
    const layout = await page.evaluate(() => {
      const rect = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const title = rect(".armory-title"),
        filter = rect(".armory-toolbar"),
        nav = rect(".armory nav");
      const list = document.querySelector(".armory-list")!;
      return {
        titleRight: title.right,
        filterLeft: filter.left,
        filterRight: filter.right,
        navLeft: nav.left,
        overflow: list.scrollWidth - list.clientWidth,
        bottom: rect(".armory-workspace").bottom,
        height: innerHeight,
      };
    });
    if (viewport.height <= 600) {
      expect(layout.titleRight).toBeLessThanOrEqual(layout.filterLeft);
      expect(layout.filterRight).toBeLessThanOrEqual(layout.navLeft);
    }
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.bottom).toBeLessThanOrEqual(layout.height);
    await page.screenshot({
      path: `dist-validation/evidence/dismantle-${viewport.width}.png`,
    });
  }
  const saved = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  const before = await saved();
  await page.locator("#armory-dismantle").click();
  await page.locator("#dismantle-cancel").click();
  expect(await saved()).toEqual(before);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () =>
      (Storage.prototype.setItem = original);
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await page.locator("#armory-dismantle").click();
  await page.locator("#dismantle-confirm").click();
  await expect(page.locator(".status")).toContainText("削除していません");
  expect(await saved()).toEqual(before);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.locator("#armory-dismantle").click();
  await expect(page.locator("#dismantle-confirm")).toContainText("+14");
  await page.locator("#dismantle-confirm").click();
  await expect.poll(async () => (await saved()).powder).toBe(14);
  expect((await saved()).inventory.map((w: Weapon) => w.id)).not.toContain(
    "waiting",
  );
  await page.reload();
  await page.locator("#open-armory").click();
  await expect(page.locator(".armory-powder")).toContainText("14");
});
