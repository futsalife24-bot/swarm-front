import { test, expect, type Page } from "@playwright/test";
// The numbers are DOM, drawn from world coordinates every frame, so only a real
// browser with a running frame loop can show they appear and then leave.
async function battle(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
}
async function hold(page: Page) {
  const world = (await page.locator("#world").boundingBox())!;
  await page.mouse.move(world.width / 2, world.height / 2);
  await page.mouse.down();
}
test("hits put a number over the enemy, and it clears itself", async ({
  page,
}) => {
  await battle(page);
  const numbers = page.locator("#damage .damage-number");
  // On a mouse the touch buttons are hidden; firing is a press on the world.
  await hold(page);
  try {
    await expect
      .poll(() => numbers.count(), { timeout: 45000 })
      .toBeGreaterThan(0);
    const first = numbers.first();
    await expect(first).toHaveText(/^\d+$/);
    // Positioned by transform, not by layout, and inside the viewport.
    const box = (await first.boundingBox())!;
    expect(box.x).toBeGreaterThan(-40);
    expect(box.y).toBeGreaterThan(-40);
  } finally {
    await page.mouse.up();
  }
  // Every number is temporary; none may pile up on screen.
  await expect.poll(() => numbers.count(), { timeout: 8000 }).toBe(0);
});
test("the setting turns them off and keeps that across a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page
    .locator("details")
    .filter({ hasText: "操作・設定・保存について" })
    .locator("summary")
    .click();
  await page.locator("#damage-numbers").selectOption("off");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("swarm-front-save-v1");
        return raw ? JSON.parse(raw).damageNumbers : null;
      }),
    )
    .toBe("off");
  await page.reload();
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await hold(page);
  try {
    await page.waitForTimeout(12000);
    await expect(page.locator("#damage .damage-number")).toHaveCount(0);
  } finally {
    await page.mouse.up();
  }
});
