import { test, expect } from "@playwright/test";
import { STARTERS } from "../src/shared/defs";
import { fresh, SAVE_KEY } from "../src/client/save";
import { localCreationKey } from "../tests/credentials";

test("full armoury preserves LR, offers real choices, and can finish when every candidate is protected", async ({
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
    await page.locator("#endpoint").fill("http://127.0.0.1:8789");
    await page
      .locator("#creation-key")
      .evaluate((el: HTMLInputElement, key) => {
        el.value = key;
      }, localCreationKey());
    await page.getByRole("button", { name: "ルームを作る" }).click();
    await expect(page.getByText("準備完了", { exact: true })).toBeVisible();
    const code = (await page.locator("#invite").inputValue()).split("#")[1];
    expect(
      (
        await request.post(
          `http://127.0.0.1:8789/fixtures/${code}/reward-overflow`,
        )
      ).ok(),
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
    const candidate = page.locator('[data-reward-discard="shotgun-2"]');
    await expect(candidate).toBeVisible();
    await expect(
      page.locator('[data-reward-discard="fixture-lr"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-reward-discard="starter-shotgun"]'),
    ).toHaveCount(0);
    const before = await saved();
    page.once("dialog", async (d) => {
      expect(d.message()).toContain("装填");
      expect(d.message()).toContain("連射");
      await d.dismiss();
    });
    await candidate.click();
    expect(await saved()).toEqual(before);
    // A failed write must neither delete the chosen item nor lose the pending LR.
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
    for (const viewport of [
      { width: 640, height: 280 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await candidate.locator("..").scrollIntoViewIfNeeded();
      const row = candidate.locator("..");
      await expect(row.locator("dl > div")).toHaveCount(6);
      const rowHeight = await row.evaluate(
        (el) => el.getBoundingClientRect().height,
      );
      const listHeight = await page
        .locator(".loot-list")
        .evaluate((el) => el.clientHeight);
      expect(rowHeight).toBeLessThanOrEqual(listHeight);

      const dims = await row.evaluate((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        x: el.getBoundingClientRect().right,
      }));
      expect(dims.scroll).toBeLessThanOrEqual(dims.width + 1);
      expect(dims.x).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: `dist-validation/evidence/reward-choice-${viewport.width}.png`,
      });
    }
    page.once("dialog", (d) => d.accept());
    await candidate.click();
    const after = await saved();
    expect(after.inventory.some((w: any) => w.id === "shotgun-2")).toBe(false);
    expect(
      after.inventory.some((w: any) => w.id === "shotgun-1" && w.rarity === 3),
    ).toBe(true);
    expect(
      after.inventory.some((w: any) => w.id === "fixture-lr" && w.rarity === 3),
    ).toBe(true);
    // Fill the family with this run's rewards until no old rocket can be offered.
    for (let i = 0; i < 8; i++) {
      const old = page.locator(
        `[data-reward-discard="${i ? `rocket-${i}` : "starter-rocket"}"]`,
      );
      if (!(await old.count())) break;
      page.once("dialog", (d) => d.accept());
      await old.click();
    }
    const decline = page.locator('[data-reward-decline="fixture-rocket-8"]');
    await expect(decline).toBeVisible();
    const beforeDecline = await saved();
    page.once("dialog", (d) => d.dismiss());
    await decline.click();
    expect(await saved()).toEqual(beforeDecline);
    // Declining only explicitly chosen leftovers provides an exit even at the cap.
    for (
      let i = 0;
      i < 10 && (await page.locator("[data-reward-decline]").count());
      i++
    ) {
      page.once("dialog", (d) => d.accept());
      await page.locator("[data-reward-decline]").first().click();
    }
    await expect(page.locator("[data-reward-decline]")).toHaveCount(0);
    await expect(page.locator("#retry-save")).toBeHidden();
    await page.locator("#regear").click();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    expect(
      (await saved()).inventory.some((w: any) => w.id === "fixture-lr"),
    ).toBe(true);
    await page.reload();
    expect(
      (await saved()).inventory.some((w: any) => w.id === "fixture-lr"),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
