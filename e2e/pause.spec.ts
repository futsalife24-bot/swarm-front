import { test, expect, type Page } from "@playwright/test";
// Leaving a run used to be one mis-tap on a button sitting in the combat HUD,
// and it discarded every unbanked reward without asking.
const time = (p: Page) =>
  p.evaluate(
    () => (window as unknown as { __swarm: any }).__swarm.world.time as number,
  );
async function battle(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#pause")).toBeVisible();
}
test("the pause control never leaves the run on its own", async ({ page }) => {
  await battle(page);
  await page.locator("#pause").click();
  await expect(page.locator("#pause-menu")).toBeVisible();
  await expect(page.locator(".pause-card h2")).toHaveText("一時停止");
  // Still in the mission: the button opens a menu, it does not quit.
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toHaveCount(0);
  const held = await time(page);
  await page.waitForTimeout(700);
  expect(Math.abs((await time(page)) - held)).toBeLessThan(0.01);
  await page.getByRole("button", { name: "戦闘に戻る" }).click();
  await expect(page.locator("#pause-menu")).toBeHidden();
  await expect
    .poll(() => time(page), { timeout: 4000 })
    .toBeGreaterThan(held + 0.2);
});
test("leaving asks first and can be backed out of", async ({ page }) => {
  await battle(page);
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "作戦離脱…" }).click();
  await expect(page.locator(".pause-card h2")).toHaveText("作戦を離脱しますか");
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.locator(".pause-card h2")).toHaveText("一時停止");
  await page.getByRole("button", { name: "戦闘に戻る" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  // Only the explicit confirmation ends the run.
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "作戦離脱…" }).click();
  await page.getByRole("button", { name: "離脱する" }).click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator("#pause-menu")).toBeHidden();
  await expect(page.locator("#hud")).toBeHidden();
});
test("the menu says what walking away costs", async ({ page }) => {
  await battle(page);
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "作戦離脱…" }).click();
  await expect(page.locator(".pause-card")).toContainText(
    "未確定の戦利品はありません",
  );
  await expect(page.locator(".pause-card")).toContainText(
    "確定済みの武器は残ります",
  );
});
test("settings changed mid-run persist to the device", async ({ page }) => {
  await battle(page);
  await page.locator("#pause").click();
  await page.locator("#pause-map").selectOption("follow");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("swarm-front-save-v1");
        return raw ? JSON.parse(raw).mapRotates : null;
      }),
    )
    .toBe(true);
});
