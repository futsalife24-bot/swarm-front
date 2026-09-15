const endpoint = process.env.SWARM_TEST_ENDPOINT ?? "http://127.0.0.1:8789";
import { localCreationKey } from "../tests/credentials";
import { test, expect } from "@playwright/test";
test("co-op clear cue precedes results and saves each reward exactly once", async ({
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
    await p.addInitScript(() => {
      (window as any).__clearCues = [];
      window.addEventListener("swarm:stage-clear", (e) => {
        (window as any).__clearCues.push({
          ...(e as CustomEvent).detail,
          at: performance.now(),
          title: document.querySelector(".clear-title")?.textContent,
          resultAbsent: !document.querySelector(".panel.result"),
          controlsHidden: (document.querySelector("#controls") as HTMLElement)
            .hidden,
          inventory: (window as any).__swarm.inventory.length,
        });
      });
    });
    await p.goto("/");
    await p.getByRole("button", { name: "協力プレイ" }).click();
    await p.locator(".coop-advanced summary").click();
    await p.locator("#endpoint").fill(endpoint);
  }
  await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
    el.value = key;
  }, localCreationKey());
  await a.getByRole("button", { name: "ルームを作る" }).click();
  await expect(a.getByText("準備完了", { exact: true })).toBeVisible();
  const invite = await a.evaluate(() => {
    const { code } = JSON.parse(sessionStorage.getItem("swarm-front-session")!);
    return `${location.origin}/#${code}`;
  });
  const code = invite.split("#")[1];
  await b.goto(invite);
  await expect(b.locator(".coop-entry")).toContainText("招待を受け取りました");
  await b.locator(".coop-advanced summary").click();
  await b.locator("#endpoint").fill(endpoint);
  await b.getByRole("button", { name: "招待ルームに参加" }).click();
  await expect(a.getByText("準備完了", { exact: true })).toHaveCount(2);
  expect((await request.post(`${endpoint}/fixtures/${code}/reward`)).ok()).toBe(
    true,
  );
  await expect(a.locator("#hud")).toBeVisible();
  const fire = (await a.locator("#fire").boundingBox())!;
  await a.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await a.mouse.down();
  await expect(a.getByRole("heading", { name: "MISSION CLEAR" })).toBeVisible({
    timeout: 15000,
  });
  await a.mouse.up();
  await expect(b.getByRole("heading", { name: "MISSION CLEAR" })).toBeVisible();
  for (const p of [a, b]) {
    const cues = await p.evaluate(() => (window as any).__clearCues);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({
      title: "STAGE CLEAR",
      resultAbsent: true,
      controlsHidden: true,
      inventory: 5,
    });
    expect(
      (await p.evaluate(() => performance.now())) - cues[0].at,
    ).toBeGreaterThanOrEqual(3000);
  }
  await ca.close();
  await cb.close();
});
