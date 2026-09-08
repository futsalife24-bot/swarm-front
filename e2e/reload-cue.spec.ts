import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 640, height: 280 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
]) {
  test(`reload feedback stays near aim at ${viewport.width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await page.getByRole("button", { name: "ソロで出撃準備" }).tap();
      await page.getByRole("button", { name: "ソロ出撃" }).tap();
      const cue = page.locator(".reload-cue");
      const cdp = await context.newCDPSession(page);
      const fire = async () => {
        const box = (await page.locator("#fire").boundingBox())!;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
          ],
        });
        await page.waitForTimeout(200);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      };
      const state = () =>
        page.evaluate(() => (window as any).__swarm.world.players[0]);
      await expect(page.locator("#hud")).toBeVisible();
      await expect(cue).toHaveCount(0);
      const initial = await state();
      await fire();
      await expect
        .poll(async () => (await state()).ammo[0])
        .toBeLessThan(initial.ammo[0]);
      await page.locator("#reload").tap();
      await expect(cue).toBeVisible();
      await expect(cue).toHaveText(/装填中 · \d+\.\d秒/);
      const bounds = await cue.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThan(0);
      expect(bounds!.x + bounds!.width).toBeLessThan(viewport.width);
      expect(bounds!.y).toBeGreaterThan(viewport.height / 2 + 15);
      expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
      expect(
        Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
      ).toBeLessThan(1);
      await expect(cue).toHaveCSS("pointer-events", "none");
      await page.screenshot({
        path: `dist-validation/evidence/reload-cue-${viewport.width}.png`,
      });
      await expect(cue).toHaveCount(0, { timeout: 8000 });
      expect((await state()).ammo[0]).toBe(initial.ammo[0]);
      // Real touch input must still reach the buttons while the cue is present.
      await fire();
      await expect
        .poll(async () => (await state()).ammo[0])
        .toBeLessThan(initial.ammo[0]);
      await page.locator("#reload").tap();
      await expect(cue).toBeVisible();
      await page.locator("#swap").tap();
      await expect.poll(async () => (await state()).slot).toBe(1);
      await expect(cue).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
