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
test("the title carries a changelog that opens and closes", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "更新履歴" });
  await expect(button).toBeVisible();
  // It must not sit on top of the two things the title screen is for.
  for (const name of ["ソロで出撃準備", "協力プレイ"]) {
    const a = (await button.boundingBox())!;
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(
      a.x > b.x + b.width || b.x > a.x + a.width || a.y > b.y + b.height,
    ).toBe(true);
  }
  await button.click();
  const card = page.locator(".log-card");
  await expect(card).toBeVisible();
  await expect(card.locator("h3")).not.toHaveCount(0);
  await expect(card.locator("li")).not.toHaveCount(0);
  // The way out stays reachable however far down the list you are.
  await card.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator("#pause-menu")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "ソロで出撃準備" }),
  ).toBeVisible();
});
