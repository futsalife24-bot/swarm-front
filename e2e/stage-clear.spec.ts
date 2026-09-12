import { test, expect } from "@playwright/test";

// Browser-only terminal-state fixture. The shipped application gets no write hook;
// full mission combat correctness remains covered by shared simulation tests.
test("solo terminal presentation, reduced motion and redeployment", async ({ page }) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) +
      '\nwindow.__terminalFixture = (phase) => { world.phase = phase; };' });
  });
  await page.addInitScript(() => {
    (window as any).__clearCount = 0;
    window.addEventListener("swarm:stage-clear", () => (window as any).__clearCount++);
  });
  await page.goto("/");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const [width, height, reduced] of [[1280, 720, false], [640, 280, true]] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.locator("#solo").click({ force: true });
    await page.locator("#launch").click({ force: true });
    await expect(page.locator("#hud")).toBeVisible();
    await page.evaluate(() => (window as any).__terminalFixture("victory"));
    await page.clock.fastForward(100);
    await expect(page.locator(".clear-title")).toBeVisible();
    await expect(page.locator(".result")).toHaveCount(0);
    const box = (await page.locator(".stage-clear").boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThan(2);
    expect(await page.locator(".clear-title").evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `dist-validation/stage-clear/solo-${width}.png`, animations: "disabled" });
    await page.clock.fastForward(3300);
    await expect(page.locator(".result")).toBeVisible({ timeout: 10000 });
    await page.locator("#regear").click({ force: true });
  }
  expect(await page.evaluate(() => (window as any).__clearCount)).toBe(2);
  await page.locator("#solo").click({ force: true });
  await page.locator("#launch").click({ force: true });
  await page.evaluate(() => (window as any).__terminalFixture("defeat"));
  await page.clock.fastForward(100);
  await expect(page.getByRole("heading", { name: "MISSION FAILED" })).toBeVisible();
  await expect(page.locator(".stage-clear")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__clearCount)).toBe(2);
});

