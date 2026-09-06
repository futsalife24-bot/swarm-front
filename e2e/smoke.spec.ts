import { test, expect } from "@playwright/test";
test("solo boots, moves, changes weapons and resets focus input", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  const before = await page.evaluate(
    () => (window as any).__swarm.world.players[0].z,
  );
  expect(before).toBeLessThan(17);
  await page.keyboard.press("KeyQ");
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => (window as any).__swarm.world.players[0].slot),
  ).toBe(1);
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(200);
  await page.keyboard.up("KeyW");
  const stopped = await page.evaluate(
    () => (window as any).__swarm.world.players[0].z,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as any).__swarm.world.players[0].z),
  ).toBeCloseTo(stopped, 1);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "dist-validation/evidence/combat.png" });
  expect(errors).toEqual([]);
});
test("mobile simultaneous movement/look/fire cancels and survives rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  const cdp = await context.newCDPSession(page);
  const points = [
    { x: 105, y: 310, id: 1 },
    { x: 510, y: 205, id: 2 },
    { x: 833, y: 300, id: 3 },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 105, y: 265, id: 1 },
      { x: 560, y: 210, id: 2 },
      points[2],
    ],
  });
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => (window as any).__swarm);
  expect(s.input.mz).toBeGreaterThan(0.5);
  expect(s.input.yaw).not.toBe(0);
  expect(s.input.fire).toBe(true);
  expect(s.world.players[0].ammo[0]).toBeLessThan(32);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.waitForTimeout(100);
  const i = await page.evaluate(() => (window as any).__swarm.input);
  expect(i.mx).toBe(0);
  expect(i.mz).toBe(0);
  expect(i.fire).toBe(false);
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator("#portrait")).toBeVisible();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator("#portrait")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();
  await page.screenshot({
    path: "dist-validation/evidence/mobile-emulation.png",
  });
  await context.close();
});
