import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
import { STARTERS } from "../src/shared/defs";
import { neutral } from "../src/shared/game";

test("four network clients split through the doubled nest with ordinary input", async ({
  request,
}) => {
  const response = await request.post("http://127.0.0.1:8917/rooms", {
    headers: { "X-Room-Creation-Key": localCreationKey() },
  });
  expect(response.ok()).toBe(true);
  const { code } = await response.json();
  const clients: {
    ws: WebSocket;
    id: string;
    world: any;
    input: ReturnType<typeof neutral>;
    members: any[];
  }[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    for (let n = 0; n < 4; n++) {
      const c = {
        ws: new WebSocket(`ws://127.0.0.1:8917/rooms/${code}`),
        id: "",
        world: null as any,
        input: neutral(),
        members: [] as any[],
      };
      clients.push(c);
      c.ws.onopen = () => c.ws.send(JSON.stringify({ type: "hello" }));
      c.ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        if (m.type === "welcome") {
          c.id = m.id;
          c.ws.send(
            JSON.stringify({
              type: "equip",
              weapons: STARTERS.slice(0, 2),
              ready: true,
            }),
          );
        }
        if (m.members) c.members = m.members;
        if (m.world) c.world = m.world;
      };
      await expect.poll(() => c.id).not.toBe("");
    }
    const host = clients[0];
    await expect.poll(() => host.members.filter((m) => m.ready).length).toBe(4);
    host.ws.send(JSON.stringify({ type: "stage", stage: 10 }));
    host.ws.send(JSON.stringify({ type: "start" }));
    await expect.poll(() => host.world?.stage).toBe(10);
    timer = setInterval(() => {
      for (const c of clients) {
        c.input.seq++;
        c.ws.send(JSON.stringify({ type: "input", input: c.input }));
      }
    }, 50);
    // Ordinary directional input; no fixture, position, damage or time overrides.
    clients.forEach((c) => (c.input.mz = 1));
    await expect
      .poll(
        () => {
          for (const c of clients)
            if (c.world?.players.find((p: any) => p.id === c.id)?.z < 45)
              c.input.mz = 0;
          return clients.every((c) => c.input.mz === 0);
        },
        { timeout: 12000, intervals: [100] },
      )
      .toBe(true);
    clients[0].input.mx = -1;
    clients[1].input.mx = 1;
    await expect
      .poll(
        () => {
          for (const c of clients.slice(0, 2))
            if (
              Math.abs(c.world.players.find((p: any) => p.id === c.id).x) > 34
            )
              c.input.mx = 0;
          return clients.slice(0, 2).every((c) => c.input.mx === 0);
        },
        { timeout: 12000, intervals: [100] },
      )
      .toBe(true);
    for (const c of clients) {
      expect(c.world.players).toHaveLength(4);
      expect(
        Math.max(...c.world.players.map((p: any) => p.x)) -
          Math.min(...c.world.players.map((p: any) => p.x)),
      ).toBeGreaterThan(60);
    }
  } finally {
    if (timer) clearInterval(timer);
    for (const c of clients) c.ws.close();
  }
});
test("host stage reaches both clients over real Workers", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  try {
    const a = await ca.newPage(),
      b = await cb.newPage();
    await a.goto("/");
    await a.getByRole("button", { name: "協力プレイ" }).click();
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill("http://127.0.0.1:8917");
    await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
      el.value = key;
    }, localCreationKey());
    await a.getByRole("button", { name: "ルームを作る" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(1);
    await ca.grantPermissions(["clipboard-read", "clipboard-write"]);
    await a
      .getByRole("button", { name: "招待リンクをコピー", exact: true })
      .click();
    const invite = await a.evaluate(() => navigator.clipboard.readText());
    await b.goto(invite);
    await b.locator(".coop-advanced summary").click();
    await b.locator("#endpoint").fill("http://127.0.0.1:8917");
    await b.getByRole("button", { name: "招待ルームに参加" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(2);
    await a.locator("#lobby-stage").selectOption("20");
    await a.getByRole("button", { name: "全員で出撃" }).click();
    for (const page of [a, b]) {
      await expect
        .poll(() => page.evaluate(() => (window as any).__swarm?.world?.stage))
        .toBe(20);
      await expect(page.locator("#hud")).toContainText("ST 20");
    }
    const wa = await a.evaluate(() => (window as any).__swarm.world);
    const wb = await b.evaluate(() => (window as any).__swarm.world);
    expect(wa.run).toBe(wb.run);
    expect(wa.players).toHaveLength(2);
    for (const w of [wa, wb]) {
      expect(w.enemies.filter((e: any) => e.kind === "boss")).toHaveLength(2);
      expect(w.enemies.filter((e: any) => e.segments)).toHaveLength(1);
      expect(w.enemies.some((e: any) => e.kind !== "boss")).toBe(true);
    }
    await a.screenshot({ path: "dist-validation/stages/coop-20.png" });
  } finally {
    await ca.close();
    await cb.close();
  }
});
test("select and enter each map on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const id of [1, 2, 5, 10, 13, 20]) {
    await page.goto("/");
    await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await expect(page.locator("#stage-select option")).toHaveCount(20);
    await page.locator("#stage-select").selectOption(String(id));
    await expect(page.locator("#stage-brief")).toBeVisible();
    await page.screenshot({ path: `dist-validation/stages/select-${id}.png` });
    await page.locator("#launch").click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__swarm?.world?.stage))
      .toBe(id);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `dist-validation/stages/map-${id}.png` });
  }
  expect(errors).toEqual([]);
});

test("four players load the enlarged nest over real Workers", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const options = { viewport: { width: 844, height: 390 } };
  const ca = await browser.newContext(options),
    cb = await browser.newContext(options),
    cc = await browser.newContext(options),
    cd = await browser.newContext(options);
  try {
    const a = await ca.newPage(),
      b = await cb.newPage(),
      c = await cc.newPage(),
      d = await cd.newPage();
    await a.goto("/");
    await a.getByRole("button", { name: "協力プレイ" }).click();
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill("http://127.0.0.1:8917");
    await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
      el.value = key;
    }, localCreationKey());
    await a.getByRole("button", { name: "ルームを作る" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(1);
    await ca.grantPermissions(["clipboard-read", "clipboard-write"]);
    await a
      .getByRole("button", { name: "招待リンクをコピー", exact: true })
      .click();
    const invite = await a.evaluate(() => navigator.clipboard.readText());
    for (const page of [b, c, d]) {
      await page.goto(invite);
      await page.locator(".coop-advanced summary").click();
      await page.locator("#endpoint").fill("http://127.0.0.1:8917");
      await page.getByRole("button", { name: "招待ルームに参加" }).click();
    }
    await expect(a.locator(".is-ready")).toHaveCount(4);
    await a.locator("#lobby-stage").selectOption("10");
    await a.getByRole("button", { name: "全員で出撃" }).click();
    for (const page of [a, b, c, d]) {
      await expect
        .poll(() => page.evaluate(() => (window as any).__swarm?.world?.stage))
        .toBe(10);
      await expect(page.locator("#hud")).toContainText("ST 10");
    }
    for (const page of [a, b, c, d])
      await page.waitForFunction(
        () => (window as any).__swarm?.mapAssets?.[5].state === "ready",
        undefined,
        { timeout: 30000 },
      );
    const wa = await a.evaluate(() => (window as any).__swarm.world);
    const wb = await b.evaluate(() => (window as any).__swarm.world);
    expect(wa.run).toBe(wb.run);
    expect(wa.players).toHaveLength(4);
    for (const [i, page] of [a, b, c, d].entries()) {
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__swarm.world.players.length),
        )
        .toBe(4);
      await page.screenshot({
        path: `dist-validation/stages/nest-coop-${i}.png`,
      });
    }
  } finally {
    await ca.close();
    await cb.close();
    await cc.close();
    await cd.close();
  }
});
