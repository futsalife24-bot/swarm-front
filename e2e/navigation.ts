import { expect, type Page } from "@playwright/test";

export async function revealHomeMenu(page: Page) {
  const start = page.locator(".title-entry-start");
  const revealed = await start
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (revealed) {
    await start.click();
    await expect(start).toHaveCount(0, { timeout: 10000 });
  }
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
  await page.locator("[data-operation=advance]").click(options);
  await expect(page.locator(".coop-entry")).toBeVisible();
}

export async function openArmory(page: Page, input: "click" | "tap" = "click") {
  await revealHomeMenu(page);
  if (input === "tap") await page.locator("#open-armory").tap();
  else await page.locator("#open-armory").click();
}
