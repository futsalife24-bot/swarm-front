import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8789";
const out = "dist-validation/menu-effects";
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
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const errors = [],
  results = {};
const pages = [];
try {
  for (let i = 0; i < 2; i++) {
    const p = await browser.newPage({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    p.on("pageerror", (e) => errors.push(e.message));
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
      () => document.querySelectorAll(".menu-fx-trace").length === 0,
      {},
      { timeout: 15000 },
    );
  }
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
  results.realSquadReadyAndReprepare = true;
  for (const p of pages) await p.close();
  // Proxy to the real isolated Worker. No fabricated API response or production save.
  const p = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  p.on("pageerror", (e) => errors.push(e.message));
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
  await p.screenshot({ path: `${out}/weekly.png` });
  await p.waitForTimeout(850);
  assert.equal(await p.locator(".menu-fx-reward").count(), 0);
  await p.locator(".dialog-close").click();
  assert.deepEqual(errors, []);
  results.realWeeklyClaimOnce = true;
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
  await browser.close();
}
