const endpoint = process.env.SWARM_TEST_ENDPOINT ?? "http://127.0.0.1:8789";
import { test, expect } from "@playwright/test";
import { STARTERS } from "../src/shared/defs";
import { fresh, SAVE_KEY } from "../src/client/save";
import { localCreationKey } from "../tests/credentials";

test("result banks overflow, favorites survive home and reload, and armory deletion is atomic", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const seed = fresh();
    seed.inventory = STARTERS.flatMap((w) =>
      Array.from({ length: 8 }, (_, i) => ({
        ...w,
        id: i ? `${w.kind}-${i}` : w.id,
        rarity: w.kind === "shotgun" && i === 1 ? 3 : 0,
      })),
    );
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
      { key: SAVE_KEY, seed },
    );
    await page.reload();
    await page.getByRole("button", { name: "協力プレイ" }).click();
    await page.locator(".coop-advanced summary").click();
    await page.locator("#endpoint").fill(endpoint);
    await page
      .locator("#creation-key")
      .evaluate((el: HTMLInputElement, key) => {
        el.value = key;
      }, localCreationKey());
    await page.getByRole("button", { name: "ルームを作る" }).click();
    await expect(page.getByText("準備完了", { exact: true })).toBeVisible();
    const code = (await page.locator("#invite").inputValue()).split("#")[1];
    expect(
      (await request.post(`${endpoint}/fixtures/${code}/reward-overflow`)).ok(),
    ).toBe(true);
    await expect(page.locator("#hud")).toBeVisible();
    const box = (await page.locator("#fire").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(
      page.getByRole("heading", { name: "MISSION CLEAR" }),
    ).toBeVisible();
    await page.mouse.up();
    const saved = () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);

    await expect(
      page.locator(
        "[data-discard], [data-reward-discard], [data-reward-decline]",
      ),
    ).toHaveCount(0);
    const favorite = page.locator('[data-favorite="fixture-lr"]');
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    const before = await saved();
    expect(before.pendingWeapons.some((w: any) => w.id === "fixture-lr")).toBe(
      true,
    );
    for (const viewport of [
      { width: 640, height: 280 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator(".loot-table .weapon-head")).toHaveCount(1);
      const rowHeight = await page
        .locator(".loot-table .weapon-row")
        .first()
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(rowHeight).toBeLessThanOrEqual(32);
      const layout = await page.evaluate(() => {
        const loot = document
          .querySelector(".result-loot")!
          .getBoundingClientRect();
        const summary = document
          .querySelector(".result-summary")!
          .getBoundingClientRect();
        const list = document.querySelector(".loot-list")!;
        list.scrollTop = list.scrollHeight;
        return {
          leftRight: summary.right,
          rightLeft: loot.left,
          top: list.scrollTop,
          width: list.clientWidth,
          scrollWidth: list.scrollWidth,
          headerTop: document
            .querySelector(".loot-table .weapon-head")!
            .getBoundingClientRect().top,
          listTop: list.getBoundingClientRect().top,
        };
      });
      expect(layout.leftRight).toBeLessThan(layout.rightLeft);
      expect(layout.top).toBeGreaterThan(0);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
      expect(Math.abs(layout.headerTop - layout.listTop)).toBeLessThanOrEqual(
        1,
      );
      await expect(page.locator(".stats")).toBeVisible();
      await page.screenshot({
        path: "dist-validation/evidence/result-" + viewport.width + ".png",
      });
    }
    await page.locator("#regear").click();
    await page.locator("#open-armory").click();
    await expect(
      page.getByRole("heading", { name: "武器庫", exact: true }),
    ).toBeVisible();
    await page.reload();
    // A previous co-op session can reopen preparation on reload.
    if (await page.locator("#gear-armory").count())
      await page.locator("#gear-armory").click();
    else await page.locator("#open-armory").click();
    await expect(page.locator('[data-discard="fixture-lr"]')).toBeDisabled();
    await page.locator('[data-armory-select="shotgun-2"]').click();
    const candidate = page.locator('[data-discard="shotgun-2"]');
    page.once("dialog", (d) => d.dismiss());
    await candidate.click();
    expect(await saved()).toEqual(before);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).restoreStorage = () => {
        Storage.prototype.setItem = original;
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === "swarm-front-save-v1") throw new Error("test quota");
        original.call(this, key, value);
      };
    });
    page.once("dialog", (d) => d.accept());
    await candidate.click();
    await expect(page.locator(".status")).toContainText("削除していません");
    expect(await saved()).toEqual(before);
    await page.evaluate(() => (window as any).restoreStorage());
    page.once("dialog", (d) => d.accept());
    await candidate.click();
    const after = await saved();
    expect(after.inventory.some((w: any) => w.id === "shotgun-2")).toBe(false);
    expect(after.inventory.some((w: any) => w.id === "fixture-lr")).toBe(true);
    expect(after.favorites).toContain("fixture-lr");
    await page.locator("#armory-filter").selectOption("favorites");
    await expect(page.locator(".armory-list article")).toHaveCount(1);
    await page.screenshot({
      path: "dist-validation/evidence/armory-favorite.png",
    });
  } finally {
    await context.close();
  }
});
