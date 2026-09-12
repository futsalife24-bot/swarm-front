import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
test("real Worker result, overflow rewards and rematch retain accessible menus", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.locator("#coop").click();
    await page.locator(".coop-advanced summary").click();
    await page.locator("#endpoint").fill("http://127.0.0.1:8912");
    await page.locator("#creation-key").fill(localCreationKey());
    await page.locator("#launch").click();
    await expect(page.locator(".is-ready")).toHaveCount(1);
    await page.locator("#copy").click();
    const code = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).split("#")[1];
    expect(
      (
        await request.post(
          `http://127.0.0.1:8912/fixtures/${code}/reward-overflow`,
        )
      ).ok(),
    ).toBe(true);
    await expect(page.locator("#hud")).toBeVisible();
    await page.mouse.move(422, 195);
    await page.mouse.down();
    await expect(
      page.getByRole("heading", { name: "MISSION CLEAR" }),
    ).toBeVisible();
    await page.mouse.up();
    for (const [width, height] of [
      [640, 280],
      [844, 390],
      [1280, 720],
    ]) {
      await page.setViewportSize({ width, height });
      const fit = await page.locator(".loot-list").evaluate((e) => ({
        x: e.scrollWidth - e.clientWidth,
        rows: e.children.length,
      }));
      expect(fit.x).toBeLessThanOrEqual(1);
      expect(fit.rows).toBeGreaterThan(8);
      const action = await page.locator("#regear").boundingBox();
      expect(action!.y + action!.height).toBeLessThanOrEqual(height);
      await page.screenshot({
        path: `dist-validation/menu-ui/result-${width}.png`,
      });
    }
    await page.locator("#regear").click();
    await page.locator("#open-armory").click();
    await page.locator("#armory-filter").selectOption("pending");
    await expect(page.locator(".armory-list article")).not.toHaveCount(0);
    await page.locator("#armory-home").click();
    await page.locator("#coop").click();
    await page.locator("#launch").click();
    await expect(page.locator(".is-ready")).toHaveCount(1);
    await page.locator("#begin").click();
    await expect(page.locator("#hud")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
