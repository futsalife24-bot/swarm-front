import { expect, type Page } from "@playwright/test";

export async function revealHomeMenu(page: Page) {
  const start = page.locator(".title-entry-start");
  const titleEntry = page.locator("dialog.title-entry");
  const solo = page.locator("#solo");
  await expect
    .poll(
      async () =>
        (await titleEntry.isVisible()) || (await solo.isVisible()),
      { timeout: 30000 },
    )
    .toBe(true);
  if (await titleEntry.isVisible()) {
    await start.click();
    await expect(titleEntry).toHaveCount(0, { timeout: 30000 });
  }
  await expect(solo).toBeVisible({ timeout: 30000 });
}

async function ensurePlayerName(page: Page) {
  await page.evaluate(() => {
    const key = "swarm-front-player-name-v1";
    if (!localStorage.getItem(key)) localStorage.setItem(key, "E2E隊員");
  });
}

export async function openSoloProfile(
  page: Page,
  options: { force?: boolean } = {},
) {
  await revealHomeMenu(page);
  await page.locator("#solo").click(options);
}

export async function enterSoloPreparation(
  page: Page,
  options: { force?: boolean } = {},
) {
  await ensurePlayerName(page);
  await openSoloProfile(page, options);
  await page.locator("[data-operation=advance]").click(options);
  const confirm = page.getByRole("button", { name: "確定" });
  if (await confirm.isVisible()) await confirm.click(options);
  const trainingLater = page.locator("#pt-offer-later");
  if (await trainingLater.isVisible()) await trainingLater.click(options);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
}

export async function openCoopProfile(
  page: Page,
  options: { force?: boolean } = {},
) {
  await revealHomeMenu(page);
  await page.locator("#coop").click(options);
}

export async function enterCoopPreparation(
  page: Page,
  options: { force?: boolean } = {},
) {
  await ensurePlayerName(page);
  await openCoopProfile(page, options);
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  const picker = page.getByRole("dialog", { name: "協力の作戦を選ぶ" });
  await expect(picker).toBeVisible();
  await page.locator("[data-operation=advance]").click(options);
  await expect(picker).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".room-entry")).toBeVisible({ timeout: 30000 });
}

export async function readyCoopLobby(page: Page) {
  const ui = page.locator("#ui");
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  await expect
    .poll(() => ui.locator(".lobby:visible").count(), { timeout: 60000 })
    .toBe(1);
  await ui.locator("#back").click();
  await expect(page.locator(".split-shutter")).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(ui.locator("#launch")).toBeVisible({ timeout: 30000 });
  await ui.locator("#launch").click();
  await expect(page.locator(".split-shutter")).toHaveCount(0, {
    timeout: 30000,
  });
  await expect
    .poll(() => ui.locator(".lobby:visible").count(), { timeout: 60000 })
    .toBe(1);
  await expect
    .poll(
      () =>
        ui
          .locator(".squad-member.self")
          .getByText("準備完了", { exact: true })
          .count(),
      { timeout: 90000 },
    )
    .toBe(1);
}

export async function openArmory(page: Page, input: "click" | "tap" = "click") {
  await revealHomeMenu(page);
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  const action = input === "tap" ? "tap" : "click";
  const activeBody = page.locator("xpath=/html/body");
  await page.locator("#open-armory")[action]();
  const confirm = page.locator("#pt-confirm");
  if (await confirm.isVisible()) await confirm[action]();
  await expect(activeBody).toHaveAttribute("data-screen", "base");
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  await expect(page.locator("#pt-base-weapons")).toBeVisible();
  await page.locator("#pt-base-weapons")[action]();
  await expect(activeBody).toHaveAttribute("data-screen", "armory");
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  await expect(page.locator('[data-genre="rifle"]')).toBeVisible();
  await page.locator('[data-genre="rifle"]')[action]();
  await expect(page.locator(".split-shutter")).toHaveCount(0);
  await expect(page.locator(".pt-list-tools")).toBeVisible();
  const allWeapons = page.locator(
    '[data-list-choice="kind"][data-value="all"]',
  );
  await page.locator(".pt-view-menu").last().locator("summary")[action]();
  await expect(page.locator(".pt-view-menu").last()).toHaveAttribute("open");
  await expect(allWeapons).toBeVisible();
  await allWeapons[action]();
  await expect(page.getByRole("heading", { name: "武器一覧" })).toBeVisible();
  await page.locator(".pt-view-menu").last().locator("summary")[action]();
  await expect(page.locator(".pt-view-menu").last()).not.toHaveAttribute("open");
  await expect(page.getByRole("heading", { name: "武器一覧" })).toBeVisible();
}
