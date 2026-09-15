import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8789";
const out = "dist-validation/audit-corrections/shared-armory";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const page = await context.newPage(),
  errors = [],
  results = {};
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => errors.push(e.message));
const ids = (items) => items.map((w) => w.id).sort();
const normal = () => page.evaluate(() => window.__playtest.save);
const coop = () =>
  page.evaluate(() => ({
    inventory: window.__swarm.inventory,
    equipped: window.__swarm.equipped,
  }));
async function homeSolo() {
  await page.goto(origin + "/");
  await page.locator("#solo").click();
  await page.locator("#pt-start").waitFor();
}
try {
  await page.goto(origin + "/");
  const fixture = await page.evaluate(async () => {
    const { fresh } = await import("/src/client/save.ts");
    const { freshProgress } = await import("/src/client/progression-save.ts");
    const { makeWeapon } = await import("/src/shared/progression.ts");
    const { validWeapon, stats } = await import("/src/shared/defs.ts");
    const legacy = fresh(),
      progress = freshProgress("normal");
    const old = {
      ...legacy.inventory[0],
      id: "audit-legacy-rifle",
      rolls: { mag: 1.25, reload: 0.8 },
      rarity: 3,
      power: 1.36,
      effect: "pierce",
    };
    if (!validWeapon(old)) throw Error("Invalid legacy fixture");
    const modern = makeWeapon(
      "audit-normal-rifle",
      "rifle",
      3,
      { power: 19, reload: 17, range: 13, rate: 11 },
      false,
      7,
      "pierce",
    );
    legacy.inventory.push(old);
    progress.inventory.push(modern);
    progress.serial = 8;
    localStorage.clear();
    localStorage.setItem("swarm-front-player-name-v1", "共有武器検証");
    localStorage.setItem("swarm-front-save-v1", JSON.stringify(legacy));
    localStorage.setItem(
      "swarm-front-progression-v2-normal",
      JSON.stringify(progress),
    );
    return { old, modern, oldStats: stats(old), modernStats: stats(modern) };
  });
  await homeSolo();
  let saved = await normal();
  assert.ok(saved.inventory.some((w) => w.id === fixture.old.id));
  assert.ok(saved.inventory.some((w) => w.id === fixture.modern.id));
  const migratedLegacy = saved.inventory.find((w) => w.id === fixture.old.id);
  for (const field of ["id", "kind", "rarity", "power", "effect", "rolls"])
    assert.deepEqual(migratedLegacy[field], fixture.old[field]);
  const legacyStats = await page.evaluate(async (id) => {
    const { stats } = await import("/src/shared/defs.ts");
    return stats(window.__playtest.save.inventory.find((w) => w.id === id));
  }, fixture.old.id);
  assert.deepEqual(legacyStats, fixture.oldStats);
  results.legacyStats = legacyStats;
  await page.locator(`[data-row="${fixture.modern.id}"] [data-detail]`).click();
  saved = await normal();
  assert.ok(
    saved.soldiers
      .find((s) => s.id === saved.selectedSoldier)
      .equipped.includes(fixture.modern.id),
  );
  const originalIds = ids(saved.inventory);
  results.normalIds = originalIds;
  await page.screenshot({ path: `${out}/normal-import.png` });
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
    fs.readFileSync(".dev.vars", "utf8"),
  )?.[1];
  assert.ok(key);
  const response = await fetch(endpoint + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.ok(response.ok);
  const { code } = await response.json();
  await page.goto(`${origin}/?coop=1#${code}`);
  await page.locator("#launch").waitFor();
  const shared = await coop();
  assert.deepEqual(ids(shared.inventory), originalIds);
  assert.ok(shared.equipped.includes(fixture.modern.id));
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(endpoint);
  await page.locator("#launch").click();
  await page.locator("#begin:not(:disabled)").waitFor({ timeout: 90000 });
  await page.screenshot({ path: `${out}/coop-equipped.png` });
  await page.locator("#begin").click();
  await page.waitForFunction(
    () => window.__swarm?.screen === "battle" && window.__swarm.trooper.loaded,
    {},
    { timeout: 90000 },
  );
  const delivered = await page.evaluate(async (id) => {
    const { stats } = await import("/src/shared/defs.ts");
    const w = window.__swarm.world.players
      .find((p) => p.id === window.__swarm.id)
      .weapons.find((w) => w.id === id);
    return { weapon: w, stats: stats(w) };
  }, fixture.modern.id);
  assert.deepEqual(delivered.weapon, fixture.modern);
  assert.deepEqual(delivered.stats, fixture.modernStats);
  results.delivered = delivered;
  const ended = await fetch(`${endpoint}/fixtures/${code}/terminal-victory`, {
    method: "POST",
  });
  assert.ok(ended.ok);
  await page.locator("#regear").waitFor();
  const reward = await page.evaluate(() => ({
    inventory: window.__swarm.inventory,
    rewards: window.__swarm.world.rewards[window.__swarm.id],
  }));
  assert.ok(reward.rewards.length >= 2);
  for (const w of reward.rewards)
    assert.ok(reward.inventory.some((a) => a.id === w.id));
  const afterRewardIds = ids(reward.inventory);
  results.rewardIds = ids(reward.rewards);
  await page.screenshot({ path: `${out}/coop-reward.png` });
  await page.locator("#regear").click();
  await page.locator("#leave-lobby").click();
  await page.locator("#solo").click();
  await page.locator("#pt-start").waitFor();
  assert.deepEqual(ids((await normal()).inventory), afterRewardIds);
  await page.locator("#pt-armory").click();
  await page.screenshot({ path: `${out}/normal-reward-armory.png` });
  await homeSolo();
  assert.deepEqual(ids((await normal()).inventory), afterRewardIds);
  await page.goto(origin + "/?coop=1");
  await page.locator("#launch").waitFor();
  assert.deepEqual(ids((await coop()).inventory), afterRewardIds);
  await page.reload();
  await page.locator("#launch").waitFor();
  assert.deepEqual(ids((await coop()).inventory), afterRewardIds);
  assert.equal(new Set(afterRewardIds).size, afterRewardIds.length);
  results.afterRewardIds = afterRewardIds;
  results.fixture =
    "Only local storage initialized and mission completion shortened; actual browser and local Worker transport, no communication mocks.";
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ ...results, errors }, null, 2),
  );
  console.log(
    "PASS: legacy and normal armory unified; equipped format2/stats preserved over Worker; coop rewards visible in normal and coop without reload duplication",
  );
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.log(await page.locator("body").innerText());
  console.log(errors);
  throw e;
} finally {
  await browser.close();
}
