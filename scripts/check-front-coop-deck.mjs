// Local-only regression: actual host/guest lobby, draft save and authoritative deck.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.SWARM_DECK_ORIGIN ?? "http://127.0.0.1:5194";
const endpoint = process.env.SWARM_DECK_ENDPOINT ?? "http://127.0.0.1:8814";
for (const url of [origin, endpoint])
  assert.equal(new URL(url).hostname, "127.0.0.1", "Test is local only");
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(
    process.env.SWARM_TEST_VARS_PATH ?? "../task-survival-build/.dev.vars",
    "utf8",
  ),
)?.[1];
assert.ok(key, "Existing local test credential required");
const out = "dist-validation/coop-lobby-deck";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const checks = [];
const record = (text) => {
  checks.push(text);
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(text);
};
const pages = [];
const wire = [];
try {
  console.log("Starting isolated browser host and guest");
  const errors = [];
  const contexts = [];
  for (const name of ["デッキ検証ホスト", "デッキ検証ゲスト"]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    contexts.push(context);
    await context.addInitScript(
      (name) => localStorage.setItem("swarm-front-player-name-v1", name),
      name,
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (socket) => {
      for (const direction of ["framesent", "framereceived"])
        socket.on(direction, ({ payload }) => {
          try {
            const m = JSON.parse(String(payload));
            if (
              ["lobby", "ready", "equip", "notice", "error"].includes(m.type)
            ) {
              const entry = {
                at: new Date().toISOString(),
                name,
                direction,
                type: m.type,
                generation: m.preparationGeneration,
                ready: m.ready,
                members: m.members?.map(({ ready, connected }) => ({
                  ready,
                  connected,
                })),
              };
              wire.push(entry);
              fs.writeFileSync(
                `${out}/wire.json`,
                JSON.stringify(wire, null, 2),
              );
            }
          } catch {}
        });
    });
    await page.goto(origin + "/front.html?coop=1", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.locator("css:light=#room-id").waitFor({ timeout: 120000 });
    console.log("Room entry loaded", name);
    await page.evaluate(async () => {
      const { initializeProgress, persistProgress } =
        await import("/src/client/progression-save.ts");
      const p = initializeProgress("normal", localStorage);
      p.missions = Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7].map((s) => [`${s}:normal`, [true, false, false]]),
      );
      persistProgress(p, localStorage);
    });
    await page.locator("css:light=.coop-advanced summary").click();
    await page.locator("css:light=#endpoint").fill(endpoint);
    pages.push(page);
  }
  const [host, guest] = pages;
  await host.locator("css:light=#creation-key").fill(key);
  await host.locator("css:light=#room-name").fill("カード編成ローカル検証");
  const created = host.waitForResponse(
    (r) => r.url() === endpoint + "/rooms" && r.request().method() === "POST",
  );
  await host.locator("css:light=#launch").click();
  const { code: roomCode } = await (await created).json();
  await host.locator("css:light=.front-lobby").waitFor({ timeout: 120000 });
  await host.waitForFunction(
    () =>
      /^(?:[a-f0-9]{8}|[0-9]{3})$/i.test(
        document.querySelector("#front-room-password")?.textContent?.trim() ??
          "",
      ),
    null,
    { timeout: 120000 },
  );
  const roomId = (
    await host.locator("css:light=#front-room-password").innerText()
  ).trim();
  assert.match(roomId, /^(?:[a-f0-9]{8}|[0-9]{3})$/i);
  assert.equal(
    await host.locator("css:light=.front-prep, .front-departure-deck").count(),
    0,
  );
  await guest.locator("css:light=#room-id").fill(roomId);
  await guest.locator("css:light=#room-join").click();
  await guest.locator("css:light=.front-lobby").waitFor({ timeout: 120000 });
  await host.waitForFunction(
    () => document.querySelectorAll("[data-fx-member]").length === 2,
  );
  assert.equal(
    await guest.locator("css:light=.front-departure-deck").count(),
    0,
  );
  assert.equal(await host.locator("css:light=#front-start").isEnabled(), false);
  record("Both host and guest enter lobby first; neither is implicitly ready");
  await host.screenshot({ path: `${out}/initial-lobby-844.png` });

  await host.locator("css:light=#front-edit-loadout").click();
  await host.locator("css:light=.front-departure-deck").waitFor();
  assert.equal(
    await host.locator("css:light=[data-front-slot], .gear-arsenal").count(),
    0,
  );
  const initial = await host.evaluate(async () =>
    (await import("/src/client/front-campaign.ts")).readFrontSurvivalLoadout(
      localStorage,
    ),
  );
  assert.equal(initial.pool.length, 25);
  await host.locator('css:light=[data-inspect="blast-core"]').click();
  await host.locator("css:light=#base-exclude").check();
  assert.equal(
    await host.evaluate(
      async () =>
        (
          await import("/src/client/front-campaign.ts")
        ).readFrontSurvivalLoadout(localStorage).pool.length,
    ),
    25,
  );
  await host.locator("css:light=#base-back").click();
  await host.locator("css:light=.base-confirm [data-cancel]").click();
  await host.locator('css:light=[data-inspect="blast-core"]').click();
  assert.equal(await host.locator("css:light=#base-exclude").isChecked(), true);
  await host.locator("css:light=#base-back").click();
  await host.locator("css:light=.base-confirm [data-confirm]").click();
  await host.locator("css:light=.front-lobby").waitFor();
  assert.equal(
    await host
      .locator("css:light=.squad-member.self .member-status")
      .innerText(),
    "準備中…",
  );
  record(
    "Draft is unsaved until explicit save; cancel/discard preserves saved deck and readiness",
  );

  await host.locator("css:light=#front-edit-loadout").click();
  await host.locator('css:light=[data-inspect="blast-core"]').click();
  await host.locator("css:light=#base-exclude").check();
  await host.locator('css:light=[data-inspect="armor-piercer"]').click();
  await host.locator("css:light=#base-exclude").check();
  await host.locator('css:light=[data-inspect="afterimage-mine"]').click();
  await host.locator("css:light=#base-exclude").click();
  assert.equal(
    await host.locator("css:light=#base-exclude").isChecked(),
    false,
  );
  assert.match(
    await host.locator("css:light=#front-pool-status").innerText(),
    /除外枠がいっぱい/,
  );
  record("Existing two-exclusion capacity is enforced; no invented deck rules");
  for (const [width, height] of [
    [844, 390],
    [640, 360],
    [568, 320],
  ]) {
    await host.setViewportSize({ width, height });
    await host.screenshot({ path: `${out}/deck-${width}.png` });
    const bounds = await host
      .locator("css:light=.front-departure-deck")
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          overflow: el.scrollWidth > el.clientWidth + 1,
        };
      });
    assert.ok(
      bounds.left >= -1 &&
        bounds.right <= width + 1 &&
        bounds.top >= -1 &&
        bounds.bottom <= height + 1,
      JSON.stringify(bounds),
    );
    assert.equal(bounds.overflow, false, JSON.stringify(bounds));
    for (const id of ["front-save-pool", "base-back", "base-exclude"])
      assert.equal(await host.locator(`#${id}`).isVisible(), true);
  }
  await host.setViewportSize({ width: 844, height: 390 });
  await host.evaluate(() => {
    window.__deckSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error("test storage unavailable");
    };
  });
  await host.locator("css:light=#front-save-pool").click();
  assert.match(
    await host.locator("css:light=#front-pool-status").innerText(),
    /保存・反映できませんでした/,
  );
  assert.equal(
    await host.locator("css:light=.front-departure-deck").count(),
    1,
  );
  await host.evaluate(() => {
    Storage.prototype.setItem = window.__deckSetItem;
  });
  await host.locator("css:light=#front-save-pool").click();
  await host.locator("css:light=.front-lobby").waitFor();
  const saved = await host.evaluate(async () =>
    (await import("/src/client/front-campaign.ts")).readFrontSurvivalLoadout(
      localStorage,
    ),
  );
  assert.equal(saved.pool.length, 23);
  assert.equal(saved.pool.includes("blast-core"), false);
  assert.equal(saved.pool.includes("armor-piercer"), false);
  record(
    "Storage failure blocks readiness; successful save keeps the exact excluded cards",
  );
  await host.locator("css:light=#front-edit-loadout").click();
  await host.waitForTimeout(1500);
  assert.equal(
    await host.locator("css:light=.front-departure-deck").count(),
    1,
  );
  await host.locator("css:light=#base-back").click();
  await host.locator("css:light=.front-lobby").waitFor();
  assert.equal(await host.locator("css:light=#front-start").isEnabled(), false);
  await host.locator("css:light=#front-edit-loadout").click();
  await host.locator("css:light=#front-save-pool").click();
  await host.locator("css:light=.front-lobby").waitFor();
  record(
    "Editing during background preparation preserves the editor and requires explicit readiness again",
  );
  await host.waitForFunction(
    () =>
      document
        .querySelector(".squad-member.self .member-status")
        ?.classList.contains("is-ready"),
    null,
    { timeout: 180000 },
  );
  await guest.locator("css:light=#front-edit-loadout").click();
  await guest.locator("css:light=#front-save-pool").click();
  await guest.locator("css:light=.front-lobby").waitFor();
  await host.waitForFunction(
    () =>
      !document.querySelector("#front-start").disabled &&
      document.querySelectorAll(".squad-member .member-status.is-ready")
        .length === 2,
    null,
    { timeout: 180000 },
  );
  assert.equal(
    await guest.locator("css:light=#front-start").isEnabled(),
    false,
  );
  record("Only host can launch after both players save and assets are ready");
  await host.screenshot({ path: `${out}/both-ready.png` });
  await host.locator("css:light=#front-start").click();
  for (const page of pages)
    await page
      .locator("css:light=[data-card]")
      .first()
      .waitFor({ timeout: 90000 });
  record("Actual two-player authoritative survival opening reached");
  // Check authoritative server state rather than trusting only the local editor.
  const snapshot = await fetch(
    `${endpoint}/fixtures/${roomCode}/snapshot`,
  ).then((r) => r.json());
  const pools = Object.values(snapshot.frontUpgradePools);
  assert.ok(
    pools.some(
      (p) =>
        p.length === 23 &&
        !p.includes("blast-core") &&
        !p.includes("armor-piercer"),
    ),
  );
  assert.ok(pools.some((p) => p.length === 25));
  assert.equal(snapshot.world.players.length, 2);
  record("Server received host 23-card deck and guest 25-card deck");
  assert.deepEqual(errors, []);
  for (const context of contexts) await context.close();
} catch (error) {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    try {
      const state = await Promise.race([
        page.evaluate(() => ({
          screen: document.body.dataset.screen,
          status: document.querySelector(".lobby-actions .status")?.textContent,
          members: [...document.querySelectorAll(".member-status")].map(
            (e) => e.textContent,
          ),
        })),
        new Promise((resolve) =>
          setTimeout(() => resolve({ error: "page busy" }), 5000),
        ),
      ]);
      fs.writeFileSync(
        `${out}/failure-${i}.json`,
        JSON.stringify(state, null, 2),
      );
      console.log("Failure UI", i, state);
      await page.screenshot({ path: `${out}/failure-${i}.png`, timeout: 5000 });
    } catch {}
  }
  throw error;
} finally {
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(checks, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ ok: true, checks }, null, 2));
