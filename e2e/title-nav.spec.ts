import { expect, test, type Locator, type Page } from "@playwright/test";

const back = "[data-menu-back]:visible";
const toggle = "[data-menu-toggle]:visible";
const opening = "dialog.menu-dialog:modal, dialog.bestiary:modal";

// The shutter renders inert copies of the outgoing screen in shadow roots.
const menu = (page: Page) => page.locator("xpath=//*[@id='ui']");

async function click(page: Page, target: Locator) {
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  await target.click();
}

async function openTitle(page: Page, path: string) {
  await page.goto(path);
  await expect(menu(page).locator("#solo")).toBeVisible({ timeout: 20_000 });
  const start = page.locator(".title-entry-start");
  if (await start.isVisible()) {
    await start.click();
    await expect(start).toBeHidden();
  }
  await expect(
    page.locator("[data-menu-back], [data-menu-toggle]"),
  ).toHaveCount(0);
}

async function checkNavigation(page: Page, frame: Locator, heading: Locator) {
  await expect(frame).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(page.locator(back)).toHaveCount(1);
  await expect(page.locator(toggle)).toHaveCount(1);
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const [left, right, panel, title] = await Promise.all([
        page.locator(back).boundingBox(),
        page.locator(toggle).boundingBox(),
        frame.boundingBox(),
        heading.boundingBox(),
      ]);
      if (!left || !right || !panel || !title) return null;
      const buttonBottom = Math.max(
        left.y + left.height,
        right.y + right.height,
      );
      return {
        left: [left.x, left.y],
        right: [viewport.width - right.x - right.width, right.y],
        frameBelow: panel.y > buttonBottom,
        headingBelow: title.y > buttonBottom,
        frameInside: panel.y + panel.height <= viewport.height + 1,
      };
    })
    .toEqual({
      left: [6, 5],
      right: [6, 5],
      frameBelow: true,
      headingBelow: true,
      frameInside: true,
    });

  await click(page, page.locator(toggle));
  const drawer = page.getByRole("dialog", { name: "サイドメニュー" });
  await expect(drawer.locator("[data-menu-destination]")).toHaveCount(8);
  await drawer.getByRole("button", { name: "メニューを閉じる" }).click();
  await expect(drawer).toBeHidden();
  await click(page, page.locator(back));
}

for (const [width, height] of [
  [844, 390],
  [932, 430],
]) {
  test(`title and corner navigation at ${width}x${height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "確認用"),
    );
    await openTitle(page, "/");
    const ui = menu(page);
    for (const selector of [
      "#open-armory",
      "#open-bestiary",
      "#pt-daily-defense",
      "#pt-weekly-missions",
      "#pt-supply-box",
      "#home-tutorial",
      "#home-settings",
      "#changelog",
    ]) {
      await expect(ui.locator(selector)).toBeVisible();
    }

    const modal = page.locator(opening).last();
    await click(page, ui.locator("#open-armory"));
    await expect(modal.locator("#pt-cancel")).toBeVisible();
    await expect(
      modal.locator("[data-menu-back], [data-menu-toggle]"),
    ).toHaveCount(0);
    await click(page, modal.locator("#pt-cancel"));
    await click(page, ui.locator("#open-armory"));
    await click(page, modal.locator("#pt-confirm"));

    const panel = ui
      .locator(":scope > section")
      .filter({ has: page.locator("h1") });
    for (const [entry, destination] of [
      ["#pt-base-weapons", "armory"],
      ["#pt-base-workshop", "workshop"],
      ["#pt-base-supply", "supply"],
    ]) {
      await click(page, ui.locator(entry));
      await expect(page.locator("xpath=/html/body")).toHaveAttribute(
        "data-screen",
        destination,
      );
      await checkNavigation(page, panel, panel.locator("h1"));
      await expect(ui.locator(entry)).toBeVisible();
    }
    await click(page, ui.locator("#pt-base-weapons"));
    await click(page, ui.locator('[data-genre="rifle"]'));
    await click(page, ui.locator(".pt-view-menu > summary"));
    await click(
      page,
      ui.locator('[data-list-choice="kind"][data-value="all"]'),
    );
    await expect(panel.locator("h1")).toHaveText("武器一覧");
    await checkNavigation(page, panel, panel.locator("h1"));
    await expect(panel.locator("h1")).toHaveText("基地");
    await checkNavigation(page, panel, panel.locator("h1"));
    await expect(ui.locator("#open-armory")).toBeVisible();

    for (const [entry, title] of [
      ["#open-bestiary", "エネミーレポート"],
      ["#home-settings", "設定"],
      ["#changelog", "更新履歴"],
      ["#pt-supply-box", "支給ボックス"],
    ]) {
      await click(page, ui.locator(entry));
      await expect(modal.locator("h2").first()).toHaveText(title);
      await checkNavigation(
        page,
        modal,
        modal.locator("header .eyebrow, header h2").first(),
      );
      await expect(modal).toBeHidden();
      await expect(page.locator(back)).toHaveCount(0);
    }

    await click(page, ui.locator("#solo"));
    await click(page, modal.locator('[data-operation="advance"]'));
    await click(page, modal.locator("#pt-offer-later"));
    await click(page, ui.getByRole("button", { name: /^ステージ:/ }));
    await checkNavigation(page, modal, modal.locator("header h2"));
    await expect(ui.getByRole("button", { name: /^ステージ:/ })).toBeVisible();

    await openTitle(page, "/front");
    await click(page, ui.locator("#home-settings"));
    await expect(panel.locator("h1")).toHaveText("設定・操作");
    await checkNavigation(page, panel, panel.locator("h1"));
    await expect(ui.locator("#solo")).toBeVisible();
    await expect(page.locator(toggle)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
