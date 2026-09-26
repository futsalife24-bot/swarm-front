import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fixtures,
  assertMigration,
} from "../tests/fixtures/save-regression/index.mjs";

const origin = process.argv[2] ?? "http://127.0.0.1:5197";
const out = process.argv[3] ?? "dist-validation/save-regression";
const key = "swarm-front-shared-progress-v3";
const checkpointKey = "swarm-front-battle-checkpoint-v1";
fs.mkdirSync(out, { recursive: true });
const results = {
  startedAt: new Date().toISOString(),
  cases: [],
  passed: false,
};
const browser = await chromium.launch({ channel: "chrome" });
results.browser = browser.version();
const errors = [];

async function open(seeds = {}) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/save-fixtures`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Synthetic save fixture</title>",
    }),
  );
  await page.goto(`${origin}/save-fixtures`);
  await page.evaluate((seeds) => {
    for (const [name, value] of Object.entries(seeds))
      localStorage.setItem(name, value);
    localStorage.setItem("swarm-front-player-name-v1", "REGRESSION FIXTURE");
  }, seeds);
  await page.goto(origin);
  return { context, page };
}
const read = (page, name = key) =>
  page.evaluate((key) => localStorage.getItem(key), name);

try {
  for (const fixture of fixtures) {
    const { context, page } = await open({ [fixture.sourceKey]: fixture.raw });
    try {
      await page.locator("#solo").waitFor();
      const migrated = JSON.parse(await read(page));
      assertMigration(migrated, fixture);
      let expected = migrated;
      for (let round = 1; round <= 3; round++) {
        expected = await page.evaluate(async () => {
          const { loadProgress, persistProgress } =
            await import("/src/client/progression-save.ts");
          const save = loadProgress("normal");
          save.coins++;
          persistProgress(save);
          return save;
        });
        assert.equal(expected.coins, migrated.coins + round);
        assert.equal(expected.revision, round + 1);
        await page.reload();
        await page.locator("#solo").waitFor();
        assert.deepEqual(JSON.parse(await read(page)), expected);
        assert.deepEqual(expected.inventory, migrated.inventory);
        assert.deepEqual(expected.soldiers, migrated.soldiers);
        assert.deepEqual(expected.accessories, migrated.accessories);
        assert.deepEqual(expected.missions, migrated.missions);
      }
      assert.equal(await read(page, fixture.sourceKey), fixture.raw);
      assert.equal(
        await read(page, fixture.sourceKey + fixture.backupSuffix),
        fixture.raw,
      );
      results.cases.push({
        name: fixture.name,
        passed: true,
        reloads: 3,
        revision: expected.revision,
      });
    } finally {
      await context.close();
    }
  }
  for (const [name, raw] of Object.entries({
    truncated: "{broken",
    null: "null",
    missing: "{}",
    future: '{"version":99}',
    incomplete: '{"version":2,"mode":"normal"}',
  })) {
    const { context, page } = await open({ [key]: raw });
    try {
      await page
        .getByRole("heading", { name: "保存を読めません", exact: true })
        .waitFor();
      assert.equal(await read(page), raw);
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#pt-export").click();
      const download = await downloadPromise;
      const exported = `${out}/invalid-${name}.json`;
      await download.saveAs(exported);
      assert.equal(fs.readFileSync(exported, "utf8"), raw);
      await page.reload();
      await page.locator("#pt-export").waitFor();
      assert.equal(await read(page), raw);
      assert.equal(await page.locator("#pt-start").count(), 0);
      results.cases.push({
        name: `invalid-${name}`,
        passed: true,
        exportedUnchanged: true,
      });
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open();
    try {
      await page.locator("#solo").waitFor();
      assert.equal(await read(page), null);
      await page.locator("#solo").click();
      await page.locator("#pt-confirm").waitFor();
      assert.equal(await read(page), null);
      results.cases.push({ name: "absent-progress-onboarding", passed: true });
    } finally {
      await context.close();
    }
  }
  // Progress and a damaged checkpoint are independent: keep both byte-for-byte.
  {
    const fixture = fixtures[1];
    const { context, page } = await open({
      [fixture.sourceKey]: fixture.raw,
      [checkpointKey]: '{"body":"broken","checksum":"0"}',
    });
    try {
      await page
        .getByText(
          "中断保存が破損しています。通常の進行保存は保持しています。",
          { exact: true },
        )
        .waitFor();
      assertMigration(JSON.parse(await read(page)), fixture);
      assert.equal(
        await read(page, checkpointKey),
        '{"body":"broken","checksum":"0"}',
      );
      assert.equal(await page.locator("#pt-resume-battle").count(), 0);
      results.cases.push({
        name: "corrupt-checkpoint-preserves-progress",
        passed: true,
      });
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  results.passed = true;
  console.log(`PASS: ${results.cases.length} real-storage fixture cases`);
} catch (error) {
  results.failure = String(error.stack || error);
  throw error;
} finally {
  results.errors = errors;
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    `${out}/fixtures-browser.json`,
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
