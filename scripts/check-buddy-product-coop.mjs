import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { localCreationKey } from "../tests/credentials.ts";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const endpoint = process.env.ENDPOINT ?? "http://127.0.0.1:8821";
const out = "dist-validation/buddy-product-coop";
fs.mkdirSync(out, { recursive: true });
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": localCreationKey() },
  body: JSON.stringify({ name: "バディ製品導線の隔離検査", listed: false }),
});
expect(response.status).toBe(200);
const { code } = await response.json();
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const pages = [],
  results = [],
  errors = [],
  connections = [];
const tap = async (p, selector) => {
  await p.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await p.locator(selector).click();
};
const snap = (p) =>
  p.evaluate(() => ({
    run: window.testWorld?.run,
    time: window.testWorld?.time,
    localId: window.testOwner,
    players: window.testWorld?.players.map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      hp: p.hp,
      connected: p.connected,
    })),
    combat: window.testWorld?.buddies,
    entries: [...(window.testView?.buddies?.entries.values() ?? [])].map(
      (e) => ({
        key: e.key,
        owner: e.owner,
        kind: e.kind,
        loaded: !!e.model,
        visible: e.root.visible,
        motion: e.motion,
        error: e.error,
      }),
    ),
  }));
try {
  for (const [width, height, buddyId] of [
    [844, 390, "tatara"],
    [640, 360, "tobari"],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    pages.push(p);
    p.setDefaultTimeout(60000);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("websocket", (ws) => {
      if (!ws.url().includes(":8821/rooms/")) return;
      const item = { buddyId, opened: Date.now(), events: [] };
      connections.push(item);
      ws.on("framereceived", ({ payload }) => {
        try {
          const m = JSON.parse(String(payload));
          if (["error", "welcome", "pong"].includes(m.type))
            item.events.push({
              at: Date.now(),
              type: m.type,
              reason: m.reason,
            });
        } catch {}
      });
      ws.on("close", () =>
        item.events.push({ at: Date.now(), type: "closed" }),
      );
    });
    await p.route("**/buddy-seed", (r) =>
      r.fulfill({ contentType: "text/html", body: "<html></html>" }),
    );
    await p.goto(origin + "/buddy-seed");
    await p.evaluate(async (id) => {
      const { freshProgress, newSaveKey } =
        await import("/src/client/progression-save.ts");
      const { freshBuddyProgress, chooseStarterBuddy } =
        await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } =
        await import("/src/shared/enemy-identity.ts");
      const s = freshProgress("normal");
      s.buddies = chooseStarterBuddy(freshBuddyProgress(), id);
      s.encounters = Object.fromEntries(
        Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]),
      );
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "協力バディ検証" + id);
    }, buddyId);
    await p.route(/\/src\/client\/render\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst r=Renderer.prototype.render;Renderer.prototype.render=function(...a){window.testWorld=a[0];window.testOwner=a[1];window.testView=this;return r.apply(this,a)};",
      });
    });
    await p.goto(origin + "/?coop=1", { timeout: 120000 });
    await p.locator("#room-join").waitFor();
    await tap(p, ".coop-advanced summary");
    await p.locator("#endpoint").fill(endpoint);
    await p.locator("#endpoint").dispatchEvent("change");
    await p.locator("#room-id").fill(code);
    await tap(p, "#room-join");
    await p.locator("#begin").waitFor({ timeout: 120000 });
    if (pages.length === 1)
      await expect(p.locator("#begin")).toBeEnabled({ timeout: 120000 });
    console.log(`参加と実素材の準備 ${width} ${buddyId}`);
  }
  const [a, b] = pages;
  await expect(a.locator("#begin")).toBeEnabled({ timeout: 120000 });
  await tap(a, "#begin");
  for (const p of pages) {
    await expect(p.locator("#controls")).toBeVisible({ timeout: 120000 });
    await expect
      .poll(
        async () => (await snap(p)).entries.filter((e) => e.loaded).length,
        { timeout: 60000 },
      )
      .toBe(2);
    await p.locator(".operation-cue").waitFor({ state: "detached" });
  }
  const initial = await Promise.all(pages.map(snap));
  expect(initial[0].run).toBe(initial[1].run);
  expect(initial[0].localId).not.toBe(initial[1].localId);
  expect(initial[0].entries.map((e) => e.kind).sort()).toEqual([
    "tatara",
    "tobari",
  ]);
  results.push({ type: "two-product-buddies", snapshots: initial });
  for (let i = 0; i < pages.length; i++)
    await pages[i].screenshot({ path: `${out}/two-${i}.png` });
  await a.bringToFront();
  await expect(a.locator("#buddy")).toHaveAttribute("aria-disabled", "false");
  await a.locator("#buddy").click();
  await expect
    .poll(
      async () =>
        (await snap(b)).combat.entries[initial[0].localId].lastSkillAt,
    )
    .toBeGreaterThanOrEqual(0);
  const used = (await snap(b)).combat.entries[initial[0].localId];
  results.push({
    type: "button-skill-synced",
    readyAt: used.skillReadyAt,
    lastSkillAt: used.lastSkillAt,
  });
  await a.reload();
  await expect(
    a.getByRole("button", { name: "進行中の部隊へ戻る" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "進行中の部隊へ戻る" }).click();
  await expect(a.locator("#controls")).toBeVisible({ timeout: 120000 });
  await expect
    .poll(async () => (await snap(a)).entries.filter((e) => e.loaded).length, {
      timeout: 60000,
    })
    .toBe(2);
  const restored = await snap(a);
  expect(restored.localId).toBe(initial[0].localId);
  expect(restored.combat.entries[restored.localId].skillReadyAt).toBe(
    used.skillReadyAt,
  );
  expect(new Set(restored.entries.map((e) => e.owner)).size).toBe(2);
  results.push({ type: "product-reconnect", snapshot: restored });
  await a.screenshot({ path: `${out}/reconnected.png` });
  await tap(a, "#pause");
  await tap(a, "#pause-leave");
  await tap(a, "#pause-quit");
  await expect.poll(async () => (await snap(a)).entries.length).toBe(0);
  await expect.poll(async () => (await snap(b)).entries.length).toBe(1);
  results.push({
    type: "product-leave",
    snapshots: await Promise.all(pages.map(snap)),
  });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ conditions: results.length, errors }));
} catch (error) {
  errors.push(String(error));
  for (let i = 0; i < pages.length; i++) {
    await pages[i]
      .screenshot({ path: `${out}/failure-${i}.png` })
      .catch(() => {});
    console.log((await pages[i].locator("body").innerText()).slice(0, 600));
  }
  throw error;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        conditions:
          "通常協力進撃。所持だけを隔離保存で準備。実World・表示の読取hook。HP・敵・時間の改変なし。",
        results,
        errors,
        connections,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
