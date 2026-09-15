import { expect, test } from "@playwright/test";
test("training uses both scope buttons from the unsaved layout draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#home-settings").click();
  await page.locator("#pt-layout").click();
  await page.locator("#layout-scope-count").selectOption("2");
  await page.locator("#layout-training").click();
  const training = page.frameLocator("iframe.training-frame");
  await training.locator("#training-start").click({ timeout: 60000 });
  await training.locator("#scope").click();
  await expect(training.locator("#scope2")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await training.locator("#scope2").click();
  await expect(training.locator("#scope")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await training.locator("#training-exit").click();
  await expect(page.locator("iframe.training-frame")).toHaveCount(0);
  await expect(page.locator("#layout-scope-count")).toHaveValue("2");
  expect(errors).toEqual([]);
});
