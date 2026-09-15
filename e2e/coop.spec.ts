import { localCreationKey } from "../tests/credentials";
import { test, expect } from "@playwright/test";
import { copyInvite } from "./invite";
import { writeFileSync } from "node:fs";
const endpoint = process.env.SWARM_TEST_ENDPOINT ?? "http://127.0.0.1:8789";
test("local credential file is not served and creation key stays in the development panel", async ({
  page,
  request,
}) => {
  const denied = await request.get("/.dev.vars");
  expect(denied.status()).toBe(403);
  expect((await denied.text()).includes(localCreationKey())).toBe(false);
  await page.goto("/");
  await page.getByRole("button", { name: "協力プレイ" }).click();
  await expect(page.locator("#creation-key")).toHaveCount(0);
  await page.locator(".coop-advanced summary").click();
  await expect(page.locator("#creation-key")).toHaveAttribute(
    "type",
    "password",
  );
  await page.locator("#endpoint").fill("http://127.0.0.1:8789");
  await page.getByRole("button", { name: "ルームを作る" }).click();
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
  request,
}) => {
  const ca = await browser.newContext({ serviceWorkers: "block" }),
    cb = await browser.newContext({ serviceWorkers: "block" });
  const a = await ca.newPage(),
    b = await cb.newPage();
  try {
    for (const p of [a, b]) {
      await p.goto("/");
      await p.getByRole("button", { name: "協力プレイ" }).click();
    }
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill(endpoint);
    await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
      el.value = key;
    }, localCreationKey());
    await a.getByRole("button", { name: "ルームを作る" }).click();
    await expect(a.getByText("準備完了", { exact: true })).toBeVisible();
    const invite = await copyInvite(a);
    await b.goto(invite);
    await expect(b.locator(".coop-entry")).toContainText(
      "招待を受け取りました",
    );
    await b.locator(".coop-advanced summary").click();
    await b.locator("#endpoint").fill(endpoint);
    await b.getByRole("button", { name: "招待ルームに参加" }).click();
    await expect(a.getByText("準備完了", { exact: true })).toHaveCount(2);
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
    const startX = wa.world.players.find((p: any) => p.id === wa.id).x;
    await a.bringToFront();
    await a.keyboard.down("KeyD");
    try {
      // Wait for the remote authoritative observation, not a fixed wall-clock delay.
      await expect
        .poll(
          () =>
            b.evaluate(
              (id: string) =>
                (window as any).__swarm.world.players.find(
                  (p: any) => p.id === id,
                ).x,
              wa.id,
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(startX + 1);
    } finally {
      await a.keyboard.up("KeyD");
    }
    const code = invite.split("#")[1];
    expect(
      (await request.post(`${endpoint}/fixtures/${code}/freeze`)).ok(),
    ).toBe(true);
    await expect
      .poll(() =>
        a.evaluate(
          () =>
            (window as any).__swarm.world.players.find(
              (p: any) => p.id === (window as any).__swarm.id,
            )?.hp,
        ),
      )
      .toBe(50);
    const beforeReload = await a.evaluate(() => {
      const diagnostic = (window as any).__swarm;
      const session = JSON.parse(
        sessionStorage.getItem("swarm-front-session")!,
      );
      return {
        id: diagnostic.id,
        token: session.token,
        player: diagnostic.world.players.find(
          (p: any) => p.id === diagnostic.id,
        ),
      };
    });
    expect(beforeReload.token).toMatch(/^[a-f0-9]{32}$/);
    expect(a.url()).not.toContain(beforeReload.token);
    await a.reload();
    await expect(
      a.getByRole("button", { name: "進行中の部隊へ戻る" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        b.evaluate(
          (id: string) =>
            (window as any).__swarm.world.players.find((p: any) => p.id === id)
              ?.connected,
          beforeReload.id,
        ),
      )
      .toBe(false);
    await a.getByRole("button", { name: "進行中の部隊へ戻る" }).click();
    await expect(a.locator("#hud")).toBeVisible();
    const restored = await a.evaluate(() => (window as any).__swarm);
    const restoredPlayer = restored.world.players.find(
      (p: any) => p.id === restored.id,
    );
    expect(restored.id).toBe(beforeReload.id);
    expect(restored.world.players).toHaveLength(2);
    expect(restoredPlayer.hp).toBe(beforeReload.player.hp);
    expect(restoredPlayer.ammo).toEqual(beforeReload.player.ammo);
    expect(JSON.stringify(restored)).not.toContain(beforeReload.token);
    expect(documentText(await a.locator("body").textContent())).not.toContain(
      beforeReload.token,
    );
    expect(a.url()).not.toContain(beforeReload.token);
    await a.screenshot({ path: "dist-validation/evidence/coop-a.png" });
    await b.screenshot({ path: "dist-validation/evidence/coop-b.png" });
  } finally {
    await ca.close();
    await cb.close();
  }
});

function documentText(value: string | null) {
  return value ?? "";
}
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
  await p.locator(".coop-advanced summary").click();
  await p.locator("#endpoint").fill("http://127.0.0.1:8789");
  await p.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await p.getByRole("button", { name: "ルームを作る" }).click();
  await expect(p.getByText("準備完了", { exact: true })).toBeVisible();
  const invite = await copyInvite(p);
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
