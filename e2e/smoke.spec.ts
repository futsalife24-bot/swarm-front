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
  const startX = await page.evaluate(
    () => (window as any).__swarm.world.players[0].x,
  );
  await page.bringToFront();
  await page.keyboard.down("KeyD");
  await expect
    .poll(() => page.evaluate(() => (window as any).__swarm.world.players[0].x))
    .toBeGreaterThan(startX + 1);
  await page.keyboard.up("KeyD");
  const before = await page.evaluate(
    () => (window as any).__swarm.world.players[0].x,
  );
  expect(before).toBeGreaterThan(startX + 1);
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
test("third-person camera follows the rendered local player during fixed-step movement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(260);
  await page.keyboard.up("KeyW");
  const state = await page.evaluate(() => (window as any).__swarm);
  expect(state.renderedLocal).not.toBeNull();
  // The camera collision calculation must start from the smoothed visual
  // position, not the 20Hz world position. Buildings can shorten its final
  // offset, so assert the actual collision anchor instead of its result.
  expect(state.cameraAnchor).toEqual(state.renderedLocal);
});
test("mobile fire drag aims outside the button while moving and stops on release or cancel", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "ソロで出撃準備" }).click();
    await page.getByRole("button", { name: "ソロ出撃" }).click();
    await expect(page.locator("#hud")).toBeVisible();
    const cdp = await context.newCDPSession(page);
    const fire = (await page.locator("#fire").boundingBox())!;
    const move = (await page.locator("#move").boundingBox())!;
    const finger = {
      x: fire.x + fire.width / 2,
      y: fire.y + fire.height / 2,
      id: 1,
    };
    const thumb = {
      x: move.x + move.width / 2,
      y: move.y + move.height / 2,
      id: 2,
    };
    const input = () => page.evaluate(() => (window as any).__swarm.input);
    for (const ending of ["touchEnd", "touchCancel"] as const) {
      const before = await input();
      const ammo = await page.evaluate(
        () => (window as any).__swarm.world.players[0].ammo[0],
      );
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [finger, thumb],
      });
      const dragged = { ...finger, x: finger.x - 120, y: finger.y - 40 };
      const moving = { ...thumb, y: thumb.y - 35 };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [dragged, moving],
      });
      await expect
        .poll(async () => (await input()).yaw)
        .toBeCloseTo(before.yaw - 0.36, 3);
      const active = await input();
      expect(active.pitch).toBeCloseTo(before.pitch + 0.1, 3);
      expect(active.fire).toBe(true);
      expect(active.mz).toBeGreaterThan(0.5);
      await expect
        .poll(async () =>
          page.evaluate(() => (window as any).__swarm.world.players[0].ammo[0]),
        )
        .toBeLessThan(ammo - 1);
      // A second move uses only its delta, not the distance from the initial press.
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { ...dragged, x: dragged.x + 20, y: dragged.y + 10 },
          moving,
        ],
      });
      await expect
        .poll(async () => (await input()).yaw)
        .toBeCloseTo(before.yaw - 0.3, 3);
      expect((await input()).pitch).toBeCloseTo(before.pitch + 0.075, 3);
      await cdp.send("Input.dispatchTouchEvent", {
        type: ending,
        touchPoints: [],
      });
      await expect.poll(async () => (await input()).fire).toBe(false);
      expect((await input()).mz).toBe(0);
      const released = await input();
      await page.waitForTimeout(150);
      expect((await input()).yaw).toBe(released.yaw);
    }
    await page.locator("#pause").click();
    await page.locator("#pause-sense").fill("3");
    await page.locator("#pause-fire-sense").fill("2");
    await page.locator("#pause-resume").click();
    const independent = await input();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [finger],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...finger, x: finger.x - 100, y: finger.y - 100 }],
    });
    await expect
      .poll(async () => (await input()).yaw)
      .toBeCloseTo(independent.yaw - 0.6, 3);
    expect((await input()).pitch).toBeCloseTo(independent.pitch + 0.5, 3);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    for (let i = 0; i < 3; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [finger],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...finger, y: finger.y - 100 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await expect
      .poll(async () => (await input()).pitch)
      .toBeCloseTo((80 * Math.PI) / 180, 5);
    await page.screenshot({ path: "dist-validation/aim-upward-mobile.png" });
  } finally {
    await context.close();
  }
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

test("aim settings persist independently and gyro respects permission, pause and off", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(DeviceMotionEvent, "requestPermission", {
        configurable: true,
        value: async () => (window as any).__permission ?? "granted",
      });
    });
    await page.goto("/");
    await page.locator("#home-settings").click();
    await page.locator("#fire-sense").fill("2");
    await page.locator("#sense").fill("3");
    await expect(page.locator("#fire-sense")).toHaveValue("2");
    await page.evaluate(() => {
      (window as any).__permission = "denied";
    });
    await page.locator("#gyro").click();
    await expect(page.locator("#gyro-status")).toContainText(
      "許可されませんでした",
    );
    await page.evaluate(() => {
      (window as any).__permission = "granted";
    });
    await page.locator("#gyro").click();
    await expect(page.locator("#gyro-status")).toContainText("オンにしました");
    await page.reload();
    await page.locator("#home-settings").click();
    await expect(page.locator("#fire-sense")).toHaveValue("2");
    await expect(page.locator("#sense")).toHaveValue("3");
    await expect(page.locator("#gyro")).toHaveText("オン");
    await page.keyboard.press("Escape");
    await page.locator("#solo").click();
    await page.locator("#launch").click();
    await expect(page.locator("#hud")).toBeVisible();
    const emit = () =>
      page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(
            new DeviceMotionEvent("devicemotion", {
              rotationRate: { alpha: 0, beta: 100, gamma: 100 },
              interval: 20,
            }),
          );
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      });
    const input = () => page.evaluate(() => (window as any).__swarm.input);
    const before = await input();
    await emit();
    await expect.poll(async () => (await input()).yaw).not.toBe(before.yaw);
    await page.locator("#pause").click();
    await expect(page.locator("#pause-fire-sense")).toHaveValue("2");
    const paused = await input();
    await emit();
    expect((await input()).yaw).toBe(paused.yaw);
    await page.locator("#pause-gyro").click();
    await page.locator("#pause-resume").click();
    const off = await input();
    await emit();
    expect((await input()).yaw).toBe(off.yaw);
    await page.locator("#pause").click();
    await page.screenshot({ path: "dist-validation/aim-settings-pause.png" });
    console.log("Aim settings assertions and screenshot completed");
  } finally {
    await context.close();
  }
});
