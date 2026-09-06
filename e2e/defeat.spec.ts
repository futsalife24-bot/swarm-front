import { test, expect } from "@playwright/test";
test("solo defeat through ordinary enemy attacks returns to equipment and redeploys", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(
    page.getByRole("heading", { name: "MISSION FAILED" }),
  ).toBeVisible({ timeout: 150000 });
  const before = await page.evaluate(
    () => (window as any).__swarm.inventory.length,
  );
  expect(before).toBe(3);
  await page.getByRole("button", { name: "装備変更・再出撃" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
});
