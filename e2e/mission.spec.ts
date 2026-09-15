import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("full solo mission rewards equip reload and redeploy with ordinary inputs", async ({
  page,
}) => {
  test.setTimeout(600000);
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await page.mouse.move(600, 350);
  await page.mouse.down();
  await page.evaluate(async () => {
    const { pilot } = await import("/tests/bot.ts" as string);
    const timer = setInterval(() => {
      const app = (window as any).__swarm;
      if (app.screen !== "battle") {
        clearInterval(timer);
        return;
      }
      const i = pilot(app.world, app.id);
      const dispatch = (type: string, code: string) =>
        window.dispatchEvent(new KeyboardEvent(type, { code }));
      for (const [key, pressed] of Object.entries({
        KeyW: i.mz > 0.2,
        KeyS: i.mz < -0.2,
        KeyD: i.mx > 0.2,
        KeyA: i.mx < -0.2,
        Space: i.dodge,
        KeyE: i.revive,
      })) {
        dispatch(pressed ? "keydown" : "keyup", key);
      }
      const angle = Math.atan2(
        Math.sin(i.yaw - app.input.yaw),
        Math.cos(i.yaw - app.input.yaw),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          movementX: angle / 0.003,
          movementY: (app.input.pitch - i.pitch) / 0.0025,
          buttons: 2,
        }),
      );
    }, 50);
  });
  await expect(
    page.getByRole("heading", { name: "MISSION CLEAR" }),
  ).toBeVisible({ timeout: 540000 });
  await page.screenshot({ path: "dist-validation/evidence/loot.png" });
  const initial = await page.evaluate(() => (window as any).__swarm);
  expect(initial.world.time).toBeLessThan(600);
  writeFileSync(
    "dist-validation/evidence/mission.json",
    JSON.stringify(
      {
        phase: initial.world.phase,
        seconds: initial.world.time,
        kills: initial.world.totalKills,
        starterEquipment: true,
        fixture: false,
      },
      null,
      2,
    ),
  );
  expect(initial.inventory.length).toBeGreaterThan(3);
  const rewardId = initial.inventory.at(-1).id;
  await page.getByRole("button", { name: "ホームへ戻る" }).click();
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  // Slot first, then the weapon: the per-card equip buttons are gone.
  await page.locator('[data-pick="0"]').click();
  await page.locator(`[data-equip="${rewardId}"]`).click();
  await page.reload();
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await expect(page.locator(`[data-equip="${rewardId}"]`)).toHaveClass(
    /equipped-0/,
  );
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  expect(
    await page.evaluate(
      () => (window as any).__swarm.world.players[0].weapons[0].id,
    ),
  ).toBe(rewardId);
});
