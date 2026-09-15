import { expect, test } from "@playwright/test";

test("stage picker masks locked names and shows each difficulty mission at landscape sizes", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (await page.locator("#landscape-start").isVisible())
    await page.locator("#landscape-start").click();
  await page.locator("#solo").click();
  await page.locator("#player-name").fill("星表示検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await page.locator("#pt-confirm").click();
  await page.locator('[data-game-select-for="pt-stage"]').click();
  await expect(
    page.locator('[data-option-index="1"] .stage-picker-name'),
  ).toHaveText("ST2 ？？？");
  await expect(page.locator('[data-option-index="0"] .is-locked')).toHaveCount(
    2,
  );
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const path = "/src/client/progression-save.ts";
    const { newSaveKey } = await import(path);
    const key = newSaveKey("normal");
    const save = JSON.parse(localStorage.getItem(key)!);
    save.missions["1:normal"] = [true, false, true];
    save.missions["1:medium"] = [true, true, false];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  if (await page.locator("#landscape-start").isVisible())
    await page.locator("#landscape-start").click();
  await page.locator("#solo").click();
  for (const width of [667, 844, 1280]) {
    await page.setViewportSize({ width, height: 390 });
    await page.locator('[data-game-select-for="pt-stage"]').click();
    const first = page.locator('[data-option-index="0"]');
    await expect(first.locator(".is-achieved")).toHaveCount(4);
    await expect(first.locator(".is-locked")).toHaveCount(1);
    await expect(
      page.locator('[data-option-index="1"] .stage-picker-name'),
    ).not.toContainText("？？？");
    await expect(
      page.locator('[data-option-index="2"] .stage-picker-name'),
    ).toHaveText("ST3 ？？？");
    expect(await first.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const name = await first.locator(".stage-picker-name").boundingBox();
    const stars = await first.locator(".stage-picker-progress").boundingBox();
    expect(name!.x + name!.width).toBeLessThanOrEqual(stars!.x);
    const second = await page.locator('[data-option-index="1"]').boundingBox();
    expect(second!.x).toBe((await first.boundingBox())!.x);
    await page.screenshot({
      path: testInfo.outputPath(`stage-stars-${width}.png`),
    });
    await page.keyboard.press("Escape");
  }
  await page.locator('[data-game-select-for="pt-stage"]').click();
  await page.locator('[data-option-index="1"]').click();
  await expect(page.locator("#pt-stage")).toHaveValue("2");
  await expect(page.locator('[data-game-select-for="pt-stage"]')).toBeFocused();
});

test("normal sortie weapon filter keeps keyboard focus after actual screen redraw", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (await page.locator("#landscape-start").isVisible())
    await page.locator("#landscape-start").click();
  await page.locator("#solo").click();
  await page.locator("#player-name").fill("フォーカス検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await page.locator("#pt-confirm").click();
  const trigger = page.locator('[data-game-select-for="pt-filter"]');
  const previous = await trigger.elementHandle();
  await trigger.click();
  const index = await page
    .locator("#pt-filter")
    .evaluate((select: HTMLSelectElement) =>
      [...select.options].findIndex((option) => option.value === "shotgun"),
    );
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator(`dialog[open] [data-option-index="${index}"]`).click();
  await expect(page.locator("#pt-filter")).toHaveValue("shotgun");
  await expect(trigger).toBeFocused();
  expect(await previous!.evaluate((button) => button.isConnected)).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("normal-filter-replacement-focused.png"),
  });
  await trigger.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("game picker returns focus to the replacement trigger after menu redraw", async ({
  page,
}, testInfo) => {
  await page.route("**/game-select-redraw", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body><main id="fixture"></main></body></html>',
    }),
  );
  await page.goto("/game-select-redraw");
  await page.evaluate(async () => {
    const path = "/src/client/game-select.ts";
    const { enhanceGameSelects } = await import(path);
    const root = document.querySelector("#fixture")!;
    const render = (value: string) => {
      root.innerHTML =
        '<label>武器種<select id="weapon-filter"><option value="all">すべて</option><option value="rifle">ライフル</option></select></label>';
      root.querySelector<HTMLSelectElement>("select")!.value = value;
      queueMicrotask(() => enhanceGameSelects(root, "#weapon-filter"));
    };
    root.addEventListener("change", (event) => {
      const oldButton = root.querySelector("button")!;
      Object.assign(window, { removedPickerButton: oldButton });
      render((event.target as HTMLSelectElement).value);
    });
    render("all");
  });
  const trigger = page.locator('[data-game-select-for="weapon-filter"]');
  await trigger.click();
  await page.getByRole("button", { name: "ライフル", exact: true }).click();
  await expect(trigger).toContainText("ライフル");
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        !(
          window as unknown as {
            removedPickerButton: HTMLButtonElement;
          }
        ).removedPickerButton.isConnected,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("replacement-trigger-focused.png"),
  });
  await testInfo.attach("replacement-trigger-focused", {
    body: JSON.stringify(
      await page.evaluate(() => ({
        value:
          document.querySelector<HTMLSelectElement>("#weapon-filter")!.value,
        focusedTrigger: (document.activeElement as HTMLElement).dataset
          .gameSelectFor,
        removedButtonConnected: (
          window as unknown as { removedPickerButton: HTMLButtonElement }
        ).removedPickerButton.isConnected,
      })),
    ),
    contentType: "application/json",
  });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

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
