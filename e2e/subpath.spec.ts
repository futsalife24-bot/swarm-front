import { test, expect } from "@playwright/test";
test("production Pages subpath serves assets and starts standalone solo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4186/swarm-front/");
  expect(await page.evaluate(() => "__swarm" in window)).toBe(false);
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.locator("script[type=module]").getAttribute("src")).toMatch(
    /^\/swarm-front\/assets\//,
  );
  expect(errors).toEqual([]);
});
