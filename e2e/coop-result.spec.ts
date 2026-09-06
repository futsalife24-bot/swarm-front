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
    await p.locator(".coop-advanced summary").click();
    await p.locator("#endpoint").fill("http://127.0.0.1:8789");
  }
  await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await a.getByRole("button", { name: "ルームを作る" }).click();
  await expect(a.getByText("準備完了", { exact: true })).toBeVisible();
  const invite = await a.locator("#invite").inputValue();
  const code = invite.split("#")[1];
  await b.goto(invite);
  await expect(b.locator(".coop-entry")).toContainText("招待を受け取りました");
  await b.locator(".coop-advanced summary").click();
  await b.locator("#endpoint").fill("http://127.0.0.1:8789");
  await b.getByRole("button", { name: "招待ルームに参加" }).click();
  await expect(a.getByText("準備完了", { exact: true })).toHaveCount(2);
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
  for (const viewport of [
    { width: 844, height: 320 },
    { width: 640, height: 280 },
  ]) {
    await a.setViewportSize(viewport);
    const layout = await a.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
        };
      };
      const panel = box(".panel.result");
      const summary = box(".result-summary");
      const loot = box(".result-loot");
      const list = document.querySelector(".result-loot .loot-list")!;
      return {
        panel,
        summary,
        loot,
        listHeight: list.clientHeight,
        listWidth: list.clientWidth,
        listScrollWidth: list.scrollWidth,
      };
    });
    expect(layout.summary.right).toBeLessThan(layout.loot.left);
    expect(layout.summary.width).toBeLessThan(layout.panel.width / 2);
    expect(layout.loot.width).toBeGreaterThan(layout.summary.width);
    expect(layout.loot.right).toBeLessThanOrEqual(layout.panel.right + 1);
    expect(layout.listHeight).toBeGreaterThan(layout.panel.height * 0.45);
    expect(layout.listScrollWidth).toBeLessThanOrEqual(layout.listWidth + 1);
  }
  await a.setViewportSize({ width: 844, height: 320 });
  await a.screenshot({ path: "dist-validation/evidence/coop-loot.png" });
  const scroll = await a.evaluate(() => {
    const list = document.querySelector(".result-loot .loot-list")!;
    const row = list.querySelector(".weapon-row")!;
    for (let i = 0; i < 8; i++) list.append(row.cloneNode(true));
    list.scrollTop = list.scrollHeight;
    return {
      top: list.scrollTop,
      height: list.clientHeight,
      scrollHeight: list.scrollHeight,
    };
  });
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.height);
  expect(scroll.top).toBeGreaterThan(0);
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
