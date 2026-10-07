import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { recordMenuMotion } from "./menu-motion-recorder.mjs";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8789";
const out = "dist-validation/menu-effects";
const width = Number(process.env.MENU_WIDTH || 844);
const height = width === 640 ? 360 : 390;
const reducedMotion =
  process.env.MENU_REDUCED === "reduce" ? "reduce" : "no-preference";
const animated = reducedMotion !== "reduce";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Local creation credential required");
const response = await fetch(endpoint + "/rooms", {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
});
assert.ok(response.ok, `Local room creation ${response.status}`);
const { code } = await response.json();
// PW_EXECUTABLE runs the same checks on a bundled Chromium (e.g. Linux CI).
const browser = await chromium.launch(
  process.env.PW_EXECUTABLE
    ? { executablePath: process.env.PW_EXECUTABLE }
    : { channel: "chrome", args: ["--use-angle=d3d11"] },
);
const errors = [],
  results = {};
const pages = [];
const recordings = [];
const record = async (page, scene) => {
  if (process.env.MENU_RECORD_VIDEO !== "1") return async () => {};
  const folder = "dist-validation/menu-polish-network-motion";
  fs.mkdirSync(folder, { recursive: true });
  const stop = await recordMenuMotion(
    page,
    `${folder}/${width}-${reducedMotion}-${scene}.mp4`,
    width,
    height,
  );
  recordings.push(stop);
  return stop;
};
let stopSquad;
async function observeEffects(page) {
  await page.addInitScript(() => {
    window.menuFxSeen = [];
    const recorded = new WeakSet();
    new MutationObserver((records) => {
      for (const record of records)
        for (const added of record.addedNodes) {
          if (!(added instanceof Element)) continue;
          const nodes = [
            ...added.querySelectorAll(
              ".menu-fx-trace,.menu-fx-check,.menu-fx-reward",
            ),
          ];
          if (added.matches(".menu-fx-trace,.menu-fx-check,.menu-fx-reward"))
            nodes.push(added);
          for (const node of nodes) {
            if (recorded.has(node)) continue;
            recorded.add(node);
            const member = node.closest("[data-fx-member]");
            window.menuFxSeen.push({
              kind: node.classList.contains("menu-fx-reward")
                ? "reward"
                : node.classList.contains("menu-fx-check")
                  ? "check"
                  : "trace",
              member: member?.dataset.fxMember,
              ready: !!member?.querySelector(".member-status.is-ready"),
            });
          }
        }
    }).observe(document, { childList: true, subtree: true });
  });
}

try {
  for (let i = 0; i < 2; i++) {
    const p = await browser.newPage({
      viewport: { width, height },
      reducedMotion,
      serviceWorkers: "block",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await observeEffects(p);
    await p.addInitScript(
      (name) => localStorage.setItem("swarm-front-player-name-v1", name),
      "部隊演出" + (i + 1),
    );
    await p.goto(`${origin}/#${code}`);
    await p.locator(".coop-advanced summary").click();
    await p.locator("#endpoint").fill(endpoint);
    await p.locator("#launch").click();
    await p.locator(".lobby").waitFor();
    pages.push(p);
    if (i === 0) stopSquad = await record(p, "squad");
  }
  for (const p of pages) {
    await p.bringToFront();
    await p.waitForFunction(
      () => document.querySelectorAll(".member-status.is-ready").length === 2,
      {},
      { timeout: 90000 },
    );
    assert.equal(await p.locator("[data-fx-member]").count(), 2);
    await p.waitForFunction(
      () =>
        document.querySelectorAll(".menu-fx-trace,.menu-fx-check").length === 0,
      {},
      { timeout: 15000 },
    );
  }
  const readyBefore = await pages[0].evaluate(() =>
    window.menuFxSeen.filter((e) => e.member && e.ready),
  );
  assert.equal(readyBefore.length, animated ? 2 : 0);
  assert.equal(
    new Set(readyBefore.map((e) => e.member)).size,
    animated ? 2 : 0,
  );
  await pages[0].screenshot({ path: `${out}/squad.png` });
  await pages[1].locator("#back").click();
  await pages[0].waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 1,
  );
  await pages[1].locator("#launch").click();
  await pages[0].waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 2,
    {},
    { timeout: 90000 },
  );
  if (animated)
    await pages[0].waitForFunction(
      () => window.menuFxSeen.filter((e) => e.member && e.ready).length === 3,
    );
  await pages[0].waitForFunction(
    () =>
      document.querySelectorAll(".menu-fx-trace,.menu-fx-check").length === 0,
  );
  const readyAfter = await pages[0].evaluate(() =>
    window.menuFxSeen.filter((e) => e.member && e.ready),
  );
  assert.equal(readyAfter.length, animated ? 3 : 0);
  results.squadReadyEffects = {
    initial: readyBefore.length,
    afterReprepare: readyAfter.length,
    ended: true,
  };
  results.realSquadReadyAndReprepare = true;
  await stopSquad();
  for (const p of pages) await p.close();
  // Proxy to the real isolated Worker. No fabricated API response or production save.
  const p = await browser.newPage({
    viewport: { width, height },
    reducedMotion,
    serviceWorkers: "block",
  });
  p.on("pageerror", (e) => errors.push(e.message));
  await observeEffects(p);
  await p.route("**/api/cloud/**", async (route) => {
    const request = route.request();
    const r = await route.fetch({
      url: endpoint + new URL(request.url()).pathname,
      headers: {
        ...request.headers(),
        origin: endpoint,
        host: "127.0.0.1:8789",
      },
    });
    await route.fulfill({ response: r });
  });
  await p.goto(origin);
  await p.locator("#solo").waitFor();
  await p.evaluate(async () => {
    const save = await import("/src/client/progression-save.ts");
    save.initializeProgress("normal");
    const s = save.loadProgress("normal");
    s.receipts = ["menu-offline-1", "menu-offline-2", "menu-offline-3"];
    s.weeklyPending = [...s.receipts];
    save.persistProgress(s);
    await (await import("/src/client/cloud-save.ts")).createCloudSave();
    localStorage.setItem("swarm-front-player-name-v1", "報酬演出");
  });
  await p.reload();
  await p.locator("#pt-weekly-missions").click();
  const claim = p.locator('[data-weekly-id="campaign-3"]');
  await claim.waitFor({ timeout: 45000 });
  assert.equal(await claim.isEnabled(), true);
  const coins = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")).coins,
  );
  const stopWeekly = await record(p, "weekly");
  await claim.click();
  await p.waitForFunction(
    () =>
      document.querySelector('[data-weekly-id="campaign-3"]')?.textContent ===
      "受取済み",
    {},
    { timeout: 45000 },
  );
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3"))
          .coins,
    ),
    coins + 150,
  );
  assert.equal(await claim.isDisabled(), true);
  assert.equal(
    await p.locator(".weekly-wallet .resource-amount").innerText(),
    String(coins + 150),
  );
  const rewards = await p.evaluate(
    () => window.menuFxSeen.filter((e) => e.kind === "reward").length,
  );
  // The mutation observer also sees a reward node synchronously removed by
  // reduced motion. Verify the live DOM separately from this success count.
  assert.equal(rewards, 1);
  if (!animated) {
    assert.equal(await p.locator(".menu-fx-reward").count(), 0);
    assert.equal(
      await p.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                a.effect?.target?.closest?.(".menu-fx-layer"),
            ).length,
      ),
      0,
    );
  }
  results.weeklyEffects = { appeared: rewards, ended: true };
  await p.screenshot({ path: `${out}/weekly.png` });
  await p.waitForFunction(
    () => document.querySelectorAll(".menu-fx-reward").length === 0,
    {},
    { timeout: 3000 },
  );
  await stopWeekly();
  await p.locator(".dialog-close").click();
  assert.deepEqual(errors, []);
  results.realWeeklyClaimOnce = true;
  results.viewport = { width, height };
  results.reducedMotion = reducedMotion;
  results.errors = errors;
  fs.writeFileSync(`${out}/network.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  fs.writeFileSync(
    `${out}/network-failure.json`,
    JSON.stringify(
      {
        errors,
        pages: await Promise.all(
          pages.map(async (p) =>
            p.isClosed()
              ? "closed"
              : p.evaluate(() => ({
                  text: document.body.innerText.slice(-2200),
                  members: [
                    ...document.querySelectorAll("[data-fx-member]"),
                  ].map((e) => e.textContent),
                })),
          ),
        ),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  for (const stop of recordings) await stop();
  await browser.close();
}
