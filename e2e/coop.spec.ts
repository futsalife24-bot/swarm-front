import { localCreationKey } from "../tests/credentials";
import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("local credential file is not served and creation requires a host key", async ({
  page,
  request,
}) => {
  const denied = await request.get("/.dev.vars");
  expect(denied.status()).toBe(403);
  expect((await denied.text()).includes(localCreationKey())).toBe(false);
  await page.goto("/");
  await page.getByRole("button", { name: "協力プレイ" }).click();
  await expect(page.locator("#creation-key")).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "ルーム作成" }).click();
  await expect(page.getByRole("status")).toContainText("作成キーを確認");
  expect(
    await page.evaluate(
      (key) => Object.values(localStorage).join("").includes(key),
      localCreationKey(),
    ),
  ).toBe(false);
});
test("two independent browsers join a real room and receive the same battlefield", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  for (const p of [a, b]) {
    await p.goto("/");
    await p.getByRole("button", { name: "協力プレイ" }).click();
  }
  await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await a.getByRole("button", { name: "ルーム作成" }).click();
  await expect(a.getByText("準備完了")).toBeVisible();
  const invite = await a.locator("#invite").inputValue();
  await b.locator("#code").fill(invite.split("#")[1]);
  await b.getByRole("button", { name: "招待から参加" }).click();
  await expect(a.getByText("準備完了")).toHaveCount(2);
  await a.getByRole("button", { name: "全員で出撃" }).click();
  await expect(a.locator("#hud")).toBeVisible();
  await expect(b.locator("#hud")).toBeVisible();
  await a.waitForTimeout(1200);
  const wa = await a.evaluate(() => (window as any).__swarm),
    wb = await b.evaluate(() => (window as any).__swarm);
  expect(wa.world.run).toBe(wb.world.run);
  expect(wa.world.players).toHaveLength(2);
  expect(wb.world.players.map((p: any) => p.id)).toEqual(
    wa.world.players.map((p: any) => p.id),
  );
  expect(wa.id).not.toBe(wb.id);
  await a.keyboard.down("KeyW");
  await a.waitForTimeout(700);
  await a.keyboard.up("KeyW");
  await b.waitForTimeout(300);
  const observed = await b.evaluate(
    (id: string) =>
      (window as any).__swarm.world.players.find((p: any) => p.id === id).z,
    wa.id,
  );
  expect(observed).toBeLessThan(16);
  await a.screenshot({ path: "dist-validation/evidence/coop-a.png" });
  await b.screenshot({ path: "dist-validation/evidence/coop-b.png" });
  await ca.close();
  await cb.close();
});
test("40 authoritative enemies render in a mobile-sized browser; record PC-only frame timings", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await context.newPage();
  await p.goto("/");
  await p.getByRole("button", { name: "協力プレイ" }).click();
  await p.locator("#endpoint").fill("http://127.0.0.1:8789");
  await p.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await p.getByRole("button", { name: "ルーム作成" }).click();
  await expect(p.getByText("準備完了")).toBeVisible();
  const invite = await p.locator("#invite").inputValue();
  const response = await request.post(
    `http://127.0.0.1:8789/fixtures/${invite.split("#")[1]}/load`,
  );
  expect(response.ok()).toBe(true);
  await expect(p.locator("#hud")).toBeVisible();
  await p.waitForTimeout(5000);
  const s = await p.evaluate(() => (window as any).__swarm);
  expect(s.world.enemies.length).toBe(40);
  const sorted = s.frameMs.slice(-200).sort((a: number, b: number) => a - b);
  const report = {
    environment: "Windows PC Chrome SwiftShader, 915x412 touch emulation",
    androidHardware: false,
    enemies: s.world.enemies.length,
    fps: s.fps,
    drawCalls: s.drawCalls,
    frameMsMedian: sorted[Math.floor(sorted.length * 0.5)],
    frameMsP95: sorted[Math.floor(sorted.length * 0.95)],
    sampleCount: sorted.length,
  };
  writeFileSync(
    "dist-validation/evidence/render-load.json",
    JSON.stringify(report, null, 2),
  );
  await p.screenshot({ path: "dist-validation/evidence/combat-40.png" });
  await context.close();
});
