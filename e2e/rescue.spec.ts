import { localCreationKey } from "../tests/credentials";
import { test, expect, type Page } from "@playwright/test";
// Revive cannot be exercised solo: going down alone ends the mission. This is the
// only way to check the rescuer's side without a second person.
const swarm = (p: Page) =>
  p.evaluate(() => (window as unknown as { __swarm: any }).__swarm);
test("the rescuer is told the revive is working, and it completes", async ({
  browser,
  request,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext(),
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
  await a.getByRole("button", { name: "全員で出撃" }).click();
  await expect(a.locator("#hud")).toBeVisible();
  await expect(b.locator("#hud")).toBeVisible();
  // Nobody is down yet, so the button must not invite a press.
  await expect(a.locator("#revive")).toContainText("対象なし");
  await expect(a.locator(".rescue")).toHaveCount(0);
  expect(
    (await request.post(`http://127.0.0.1:8789/fixtures/${code}/revive`)).ok(),
  ).toBe(true);
  // The fixture downs the first member and stands the second one beside them.
  const first = (await swarm(a)).world.players[0].id;
  const [downed, rescuer] = (await swarm(a)).id === first ? [a, b] : [b, a];
  await expect(downed.locator(".downed")).toBeVisible();
  // The regression this guards: the rescuer used to see nothing whatsoever.
  await expect(rescuer.locator(".rescue")).toContainText("味方がダウン");
  await expect(rescuer.locator(".rescue")).toContainText("蘇生を長押し");
  await expect(rescuer.locator(".rescue")).toHaveAttribute(
    "data-rescue",
    "ready",
  );
  await expect(rescuer.locator("#revive")).not.toContainText("対象なし");
  await rescuer.keyboard.down("KeyE");
  try {
    await expect
      .poll(() => rescuer.locator("#revive").getAttribute("data-remaining"), {
        timeout: 4000,
      })
      .not.toBe("0");
    // Read the outcome from the rescuer. The fixture backdates the downed
    // member's last input by three minutes, which is harmless while they are
    // down (the idle check skips hp <= 0) but kicks them the instant they
    // stand up, freezing their own view at the moment before the revive.
    await expect
      .poll(
        async () =>
          (await swarm(rescuer)).world.players.find((p: any) => p.id === first)
            .hp,
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
  } finally {
    await rescuer.keyboard.up("KeyE");
  }
  // Once nobody is down the prompt has to disappear again on its own.
  await expect(rescuer.locator(".rescue")).toHaveCount(0);
  await expect(rescuer.locator("#revive")).toContainText("対象なし");
});
