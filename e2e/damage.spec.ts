import { test, expect, type Page } from "@playwright/test";
import { enterSoloPreparation, revealHomeMenu } from "./navigation";
// The numbers are DOM, drawn from world coordinates every frame, so only a real
// browser with a running frame loop can show they appear and then leave.
async function skipFirstContact(page: Page) {
  await page.addLocatorHandler(
    page.getByRole("button", { name: "スキップして戦闘へ", exact: true }),
    async (button) => {
      await button.click();
    },
  );
}
async function battle(page: Page) {
  await skipFirstContact(page);
  await page.goto("/");
  await enterSoloPreparation(page);
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await enterBattle(page);
}
async function enterBattle(page: Page) {
  await page.locator("#pt-enter").click({ timeout: 65000 });
  await page.locator("#pt-tutorial-skip").click();
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
  await skipFirstContact(page);
  await page.goto("/");
  await revealHomeMenu(page);
  await page.locator("#home-settings").click();
  const damageNumbers = page.locator('[data-preference="damageNumbers"]');
  await expect(damageNumbers).toBeVisible();
  await damageNumbers.selectOption("off");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem(
          "swarm-front-environment-preferences-v1",
        );
        return raw ? JSON.parse(raw).damageNumbers : null;
      }),
    )
    .toBe("off");
  await page.reload();
  await enterSoloPreparation(page);
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await enterBattle(page);
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
  await revealHomeMenu(page);
  const button = page.getByRole("button", { name: "更新履歴" });
  await expect(button).toBeVisible();
  // It must not sit on top of the two things the title screen is for.
  for (const name of ["ソロ：進撃 または 生存", "協力：進撃 または 生存"]) {
    const a = (await button.boundingBox())!;
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(
      a.x > b.x + b.width || b.x > a.x + a.width || a.y > b.y + b.height,
    ).toBe(true);
  }
  await button.click();
  const dialog = page.getByRole("dialog", { name: "更新履歴" });
  const entries = dialog.locator(".release-entry");
  await expect(dialog).toBeVisible();
  await expect(entries.first()).toBeVisible();
  await expect(entries.locator("h3")).not.toHaveCount(0);
  await expect(entries.locator("li")).not.toHaveCount(0);
  // The way out stays reachable however far down the list you are.
  await dialog
    .locator(".menu-dialog-body")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await dialog.locator("[data-menu-back]").click();
  await expect(dialog).toHaveCount(0, { timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "ソロ：進撃 または 生存" }),
  ).toBeVisible();
});
