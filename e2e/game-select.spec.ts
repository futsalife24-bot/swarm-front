import { expect, test } from "@playwright/test";

test("game picker selects, restores focus and syncs at landscape height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route("**/game-select-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/menu-ui.css"><link rel="stylesheet" href="/src/menu-theme.css"></head><body><main id="fixture"><select id="stage" aria-label="ステージ"></select><output id="changes">0</output></main></body></html>',
    }),
  );
  await page.goto("/game-select-fixture");
  await page.evaluate(async () => {
    const path = "/src/client/game-select.ts";
    const api = await import(path);
    Object.assign(window, { pickerApi: api });
    const select = document.querySelector<HTMLSelectElement>("#stage")!;
    for (let n = 1; n <= 21; n++)
      select.add(new Option(`ST${n} 作戦`, String(n)));
    select.options[1].disabled = true;
    document.querySelector("#fixture")!.addEventListener("change", () => {
      const output = document.querySelector("#changes")!;
      output.textContent = String(Number(output.textContent) + 1);
    });
    api.enhanceGameSelects(document, "#stage");
    api.enhanceGameSelects(document, "#stage");
  });
  const trigger = page.locator('[data-game-select-for="stage"]');
  await expect(trigger).toHaveCount(1);
  await expect(page.locator("#stage")).toBeHidden();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ST2 作戦", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("button", { name: "ST21 作戦", exact: true }),
  ).toBeFocused();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.y).toBeGreaterThanOrEqual(0);
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(390);
  await page.keyboard.press("Enter");
  await expect(page.locator("#stage")).toHaveValue("21");
  await expect(page.locator("#changes")).toHaveText("1");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>("#stage")!;
    select.value = "3";
    select.disabled = true;
    (
      window as unknown as {
        pickerApi: { syncGameSelects(root: ParentNode): void };
      }
    ).pickerApi.syncGameSelects(document);
  });
  await expect(trigger).toContainText("ST3 作戦");
  await expect(trigger).toBeDisabled();
});
