import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
test("four-player lobby shares preparation, equipment and host stage without landscape scrolling", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ viewport: { width: 844, height: 390 } }),
    ),
  );
  try {
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const [a, b] = pages;
    await a.goto("/");
    await a.getByRole("button", { name: "協力プレイ" }).click();
    await expect(a.locator(".room-entry")).toBeVisible();
    await expect(a.locator("[data-equip], #stage-select")).toHaveCount(0);
    for (const size of [
      { width: 740, height: 360 },
      { width: 844, height: 390 },
      { width: 1280, height: 720 },
    ]) {
      await a.setViewportSize(size);
      const bounds = await a.locator(".room-entry").evaluate((e) => ({
        x: e.getBoundingClientRect().x,
        overflow: e.scrollWidth - e.clientWidth,
      }));
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.overflow).toBeLessThanOrEqual(1);
      await a.locator("#launch").scrollIntoViewIfNeeded();
      await a.screenshot({
        path: "dist-validation/coop-entry/" + size.width + ".png",
      });
    }
    await a.setViewportSize({ width: 844, height: 390 });
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill("http://127.0.0.1:8912");
    await a.locator("#creation-key").fill(localCreationKey());
    await a.getByRole("button", { name: "ルームを作る" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(1);
    await contexts[0].grantPermissions(["clipboard-read", "clipboard-write"]);
    await a
      .getByRole("button", { name: "招待リンクをコピー", exact: true })
      .click();
    const invite = await a.evaluate(() => navigator.clipboard.readText());
    await expect(a.locator("#invite-feedback")).toHaveText("コピーしました");
    for (const p of pages.slice(1)) {
      await p.goto(invite);
      await p.locator(".coop-advanced summary").click();
      await p.locator("#endpoint").fill("http://127.0.0.1:8912");
      await p.getByRole("button", { name: "招待ルームに参加" }).click();
      await expect(p.locator(".lobby")).toBeVisible();
    }
    await expect(a.locator(".is-ready")).toHaveCount(4);
    await a.locator("#lobby-stage").selectOption("7");
    await expect(b.locator("#lobby-stage")).toHaveValue("7");
    await expect(b.locator("#lobby-stage")).toBeDisabled();
    await b.locator("#back").click();
    await expect(a.locator(".is-preparing")).toHaveText(["準備中…"]);
    await expect(a.locator("#begin")).toBeDisabled();
    await expect(b.locator("#stage-select")).toHaveValue("7");
    await expect(b.locator(".coop-entry")).toHaveCount(0);
    const first = await a
      .locator(".squad-member")
      .nth(1)
      .locator(".member-weapons")
      .textContent();
    await b.locator("[data-equip]").last().click();
    await expect(
      a.locator(".squad-member").nth(1).locator(".member-weapons"),
    ).not.toHaveText(first!);
    await expect(a.locator("#begin")).toBeDisabled();
    await b.getByRole("button", { name: "準備完了してロビーへ" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(4);
    for (const size of [
      { width: 740, height: 360 },
      { width: 844, height: 390 },
      { width: 915, height: 412 },
      { width: 1280, height: 720 },
    ]) {
      await a.setViewportSize(size);
      const overflow = await a.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            "#ui,.lobby,.lobby-mission,.squad-cards,.squad-member,.member-heading,.member-weapons,.lobby-chat",
          ),
        ].map((e) => ({
          class: e.className,
          x: e.scrollWidth - e.clientWidth,
          y: e.scrollHeight - e.clientHeight,
        })),
      );
      expect(overflow.filter((e) => e.x > 1 || e.y > 1)).toEqual([]);
      const cards = await a.locator(".squad-member").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, bottom: r.bottom };
        }),
      );
      expect(cards[0].y).toBe(cards[1].y);
      expect(cards[2].y).toBe(cards[3].y);
      expect(cards[0].x).toBe(cards[2].x);
      expect(cards[1].x).toBeGreaterThan(cards[0].x);
      expect(cards[2].y).toBeGreaterThan(cards[0].y);
      await expect(
        a.getByLabel("チャット（仮）", { exact: true }),
      ).toBeVisible();
      expect(
        (await a.locator(".lobby-chat").boundingBox())!.y,
      ).toBeGreaterThanOrEqual(cards[3].bottom);
      await a.screenshot({
        path: `dist-validation/lobby-layout/${size.width}.png`,
      });
    }
    await a.locator("#begin").click();
    for (const p of pages) await expect(p.locator("#hud")).toBeVisible();
    expect(await b.evaluate(() => (window as any).__swarm.world.stage)).toBe(7);
  } finally {
    for (const c of contexts) await c.close();
  }
});

test("server rejects starting during preparation and protects the host stage", async ({
  request,
}) => {
  const { STARTERS } = await import("../src/shared/defs");
  const response = await request.post("http://127.0.0.1:8912/rooms", {
    headers: { "X-Room-Creation-Key": localCreationKey() },
  });
  expect(response.ok()).toBe(true);
  const { code } = await response.json();
  const sockets: WebSocket[] = [];
  const messages: any[][] = [[], []];
  try {
    for (let i = 0; i < 2; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:8912/rooms/${code}`);
      sockets.push(ws);
      ws.onopen = () => ws.send(JSON.stringify({ type: "hello" }));
      ws.onmessage = (e) => messages[i].push(JSON.parse(String(e.data)));
      await expect
        .poll(() => messages[i].some((m) => m.type === "welcome"))
        .toBe(true);
      ws.send(
        JSON.stringify({
          type: "equip",
          weapons: STARTERS.slice(0, 2),
          ready: i === 0,
        }),
      );
    }
    const send = (i: number, m: unknown) => sockets[i].send(JSON.stringify(m));
    send(0, { type: "stage", stage: 6 });
    await expect.poll(() => messages[1].at(-1)?.stage).toBe(6);
    send(1, { type: "stage", stage: 10 });
    send(0, { type: "start", stage: 10 });
    await expect
      .poll(() =>
        messages[0].some(
          (m) => m.type === "notice" && m.reason.includes("準備"),
        ),
      )
      .toBe(true);
    expect(messages[0].some((m) => m.type === "state")).toBe(false);
    send(1, { type: "ready", ready: true });
    await expect
      .poll(() => messages[0].at(-1)?.members?.every((m: any) => m.ready))
      .toBe(true);
    send(0, { type: "start", stage: 10 });
    await expect
      .poll(() => messages[0].find((m) => m.type === "state")?.world.stage)
      .toBe(6);
  } finally {
    sockets.forEach((ws) => ws.close());
  }
});
