import { localCreationKey } from "../tests/credentials";
import { test, expect } from "@playwright/test";
test("co-op fixture rewards save on both clients and allow equipment change and a real rematch", async ({
  browser,
  request,
}) => {
  const ca = await browser.newContext({
      viewport: { width: 844, height: 320 },
      isMobile: true,
      hasTouch: true,
    }),
    cb = await browser.newContext({
      viewport: { width: 844, height: 320 },
      isMobile: true,
      hasTouch: true,
    }),
    a = await ca.newPage(),
    b = await cb.newPage();
  for (const p of [a, b]) {
    await p.goto("/");
    await p.getByRole("button", { name: "協力プレイ" }).click();
    await p.locator("#endpoint").fill("http://127.0.0.1:8789");
  }
  await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await a.getByRole("button", { name: "ルーム作成" }).click();
  await expect(a.getByText("準備完了")).toBeVisible();
  const code = (await a.locator("#invite").inputValue()).split("#")[1];
  await b.locator("#code").fill(code);
  await b.getByRole("button", { name: "招待から参加" }).click();
  await expect(a.getByText("準備完了")).toHaveCount(2);
  expect(
    (await request.post(`http://127.0.0.1:8789/fixtures/${code}/reward`)).ok(),
  ).toBe(true);
  await expect(a.locator("#hud")).toBeVisible();
  const fire = (await a.locator("#fire").boundingBox())!;
  await a.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await a.mouse.down();
  await expect(a.getByRole("heading", { name: "MISSION CLEAR" })).toBeVisible();
  await a.mouse.up();
  await expect(b.getByRole("heading", { name: "MISSION CLEAR" })).toBeVisible();
  const oldRun = await a.evaluate(() => (window as any).__swarm.world.run);
  await a.screenshot({ path: "dist-validation/evidence/coop-loot.png" });
  for (const p of [a, b]) {
    expect(
      await p.evaluate(() => (window as any).__swarm.inventory.length),
    ).toBe(5);
    await p.getByRole("button", { name: "装備変更・再出撃" }).click();
  }
  const item = await a.evaluate(() => (window as any).__swarm.inventory[3].id);
  await a.locator(`[data-equip="${item}"][data-slot="0"]`).click();
  await a.waitForTimeout(500);
  await expect(a.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await a.getByRole("button", { name: "ルームに戻る" }).click();
  await a.getByRole("button", { name: "全員で出撃" }).click();
  await expect(a.locator("#hud")).toBeVisible();
  await expect(b.locator("#hud")).toBeVisible();
  const next = await a.evaluate(() => (window as any).__swarm);
  expect(next.world.run).not.toBe(oldRun);
  expect(
    next.world.players.find((p: any) => p.id === next.id).weapons[0].id,
  ).toBe(item);
  await ca.close();
  await cb.close();
});
