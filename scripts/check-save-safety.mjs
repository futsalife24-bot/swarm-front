import { chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:5186";
const out = process.argv[3] ?? "dist-validation/audit-round2/save-safety";
const key = "swarm-front-shared-progress-v3";
const legacyKey = "swarm-front-progression-v2-normal";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const results = {
  command: `node scripts/check-save-safety.mjs ${origin}`,
  head: git("rev-parse", "HEAD"),
  status: git("status", "--short"),
  code: {},
  fixture:
    "Real installed Chrome, actual Web Locks and localStorage. Storage fixtures seed progress; exact historical modules are bundled from git including their historical imports. No game storage or Web Locks mocks.",
  cases: [],
};
for (const filename of [
  "src/bootstrap.ts",
  "src/client/save-writer.ts",
  "src/client/progression-save.ts",
  "src/client/shared-armory.ts",
  "src/client/save-recovery.ts",
  "src/client/playtest-app.ts",
  "src/main.ts",
  "scripts/check-save-safety.mjs",
]) {
  if (fs.existsSync(filename))
    results.code[filename] = sha(fs.readFileSync(filename));
}
fs.mkdirSync(out, { recursive: true });

async function historicalBundle(ref) {
  const files = {};
  const result = await build({
    entryPoints: ["src/client/progression-save.ts"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "HistoricalProgress",
    platform: "browser",
    plugins: [
      {
        name: "exact-historical-git-tree",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            const name =
              args.kind === "entry-point"
                ? args.path
                : path.posix.normalize(
                    path.posix.join(
                      path.posix.dirname(args.importer),
                      args.path,
                    ),
                  );
            if (args.kind !== "entry-point" && !args.path.startsWith("."))
              throw Error(
                `Unexpected external historical import: ${args.path}`,
              );
            return {
              path: name.endsWith(".ts") ? name : `${name}.ts`,
              namespace: "historical",
            };
          });
          b.onLoad({ filter: /.*/, namespace: "historical" }, (args) => {
            const source = git("show", `${ref}:${args.path}`);
            files[args.path] = sha(source);
            return { contents: source, loader: "ts" };
          });
        },
      },
    ],
  });
  return {
    javascript: result.outputFiles[0].text,
    files,
    head: git("rev-parse", ref),
  };
}

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
results.browser = browser.version();
const errors = [];
let lastPage;
async function context() {
  const c = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  await c.route(`${origin}/save-safety-fixture`, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Save audit fixture</title><body>Historical save writer audit fixture</body>",
    }),
  );
  c.on("page", (p) => {
    p.setDefaultTimeout(60000);
    p.on("pageerror", (e) => errors.push(e.message));
    lastPage = p;
  });
  return c;
}
async function seed(c) {
  const p = await c.newPage();
  await p.goto(`${origin}/save-safety-fixture`);
  await p.evaluate(async (oldKey) => {
    const { freshProgress } = await import("/src/client/progression-save.ts");
    localStorage.setItem(oldKey, JSON.stringify(freshProgress("normal")));
    localStorage.setItem("swarm-front-player-name-v1", "保存監査隊員");
  }, legacyKey);
  await p.close();
}
async function solo(p) {
  await p.locator("#solo").click();
  await p.locator("#pt-start").waitFor();
}
async function reward(p, id) {
  return p.evaluate(
    async ({ id, key }) => {
      const { loadProgress, persistProgress } =
        await import("/src/client/progression-save.ts");
      const { makeWeapon } = await import("/src/shared/progression.ts");
      const s = loadProgress("normal");
      s.inventory.push(
        makeWeapon(
          id,
          "rifle",
          2,
          { power: 3, reload: 2, range: 1, rate: 1 },
          false,
          s.serial++,
        ),
      );
      s.coins += 17;
      persistProgress(s);
      return localStorage.getItem(key);
    },
    { id, key },
  );
}

try {
  const c = await context();
  await seed(c);
  const a = await c.newPage();
  await a.goto(origin);
  await solo(a);
  const saved = await reward(a, "audit-single-writer-reward");
  const b = await c.newPage();
  await b.goto(origin);
  await b.locator("#save-writer-blocked").waitFor();
  const coop = await c.newPage();
  await coop.goto(`${origin}/?coop=1`);
  await coop.locator("#save-writer-blocked").waitFor();
  const locks = await a.evaluate(() => navigator.locks.query());
  assert.equal(
    locks.held.filter(
      (lock) => lock.name === "swarm-front-shared-save-writer-v3",
    ).length,
    1,
  );
  assert.equal(await b.evaluate(() => typeof window.__playtest), "undefined");
  assert.equal(await coop.evaluate(() => typeof window.__swarm), "undefined");
  assert.equal(await b.evaluate((k) => localStorage.getItem(k), key), saved);
  await b.locator("#save-writer-retry").click();
  await b.locator("#save-writer-blocked").waitFor();
  assert.equal(await b.evaluate((k) => localStorage.getItem(k), key), saved);
  await b.screenshot({ path: `${out}/second-normal-blocked.png` });
  await coop.screenshot({ path: `${out}/second-coop-blocked.png` });
  // A separate browser profile is a separate user and does not share the lock.
  const independent = await context();
  const independentPage = await independent.newPage();
  await independentPage.goto(origin);
  await independentPage.locator("#solo").waitFor();
  assert.equal(
    await independentPage.locator("#save-writer-blocked").count(),
    0,
  );
  await independent.close();
  await a.close();
  await b.locator("#save-writer-retry").click();
  await solo(b);
  assert.ok(
    await b.evaluate(() =>
      window.__playtest.save.inventory.some(
        (w) => w.id === "audit-single-writer-reward",
      ),
    ),
  );
  await b.screenshot({ path: `${out}/normal-reacquired.png` });
  await b.close();
  await coop.locator("#save-writer-retry").click();
  await coop.locator("#launch").waitFor();
  assert.ok(
    await coop.evaluate(() =>
      window.__swarm.inventory.some(
        (w) => w.id === "audit-single-writer-reward",
      ),
    ),
  );
  await coop.screenshot({ path: `${out}/coop-reacquired.png` });
  results.cases.push({
    name: "single-writer-normal-coop",
    passed: true,
    reward: "audit-single-writer-reward",
    browserLockSnapshot: locks,
    independentProfileAllowed: true,
    screenshots: [
      "second-normal-blocked.png",
      "second-coop-blocked.png",
      "normal-reacquired.png",
      "coop-reacquired.png",
    ],
  });
  await c.close();

  for (const ref of ["157df95", "d947dd8"]) {
    const bundle = await historicalBundle(ref);
    const c = await context();
    const oldTab = await c.newPage();
    await oldTab.goto(`${origin}/save-safety-fixture`);
    await oldTab.addScriptTag({ content: bundle.javascript });
    await oldTab.evaluate(() => {
      window.oldSnapshot = HistoricalProgress.freshProgress("normal");
      HistoricalProgress.persistProgress(window.oldSnapshot);
      localStorage.setItem("swarm-front-player-name-v1", "旧版併存監査");
    });
    const a = await c.newPage();
    await a.goto(origin);
    await solo(a);
    const newRaw = await reward(a, `audit-after-migration-${ref}`);
    const oldWrite = await oldTab.evaluate(
      ({ oldKey, newKey }) => {
        oldSnapshot.coins += 5;
        HistoricalProgress.persistProgress(oldSnapshot);
        return {
          old: JSON.parse(localStorage.getItem(oldKey)),
          newRaw: localStorage.getItem(newKey),
        };
      },
      { oldKey: legacyKey, newKey: key },
    );
    assert.equal(oldWrite.old.coins, 5);
    assert.equal(oldWrite.newRaw, newRaw);
    await a.reload();
    await solo(a);
    const actual = await a.evaluate(() => window.__playtest.save);
    assert.ok(
      actual.inventory.some((w) => w.id === `audit-after-migration-${ref}`),
    );
    assert.equal(actual.coins, JSON.parse(newRaw).coins);
    await a.screenshot({
      path: `${out}/historical-${ref}-reward-preserved.png`,
    });
    results.cases.push({
      name: `historical-${ref}-actual-persist`,
      passed: true,
      historicalHead: bundle.head,
      historicalFiles: bundle.files,
      bundleSha256: sha(bundle.javascript),
      oldCoinsAfterWrite: oldWrite.old.coins,
      newCoinsAfterReload: actual.coins,
      reward: `audit-after-migration-${ref}`,
      screenshot: `historical-${ref}-reward-preserved.png`,
    });
    await c.close();
  }

  // An out-of-band write intentionally bypasses the app lock to exercise its
  // final conflict defence. Reward generation is a fixture; the recovery UI,
  // journal, download and persistence are the actual game implementation.
  for (const action of ["click", "reload", "quota-reload"]) {
    const c = await context();
    const fixture = await c.newPage();
    await fixture.goto(`${origin}/save-safety-fixture`);
    const seeded = await fixture.evaluate(
      async ({ key, action }) => {
        const { freshProgress, grantResult, prepareChoice } =
          await import("/src/client/progression-save.ts");
        const { makeWeapon } = await import("/src/shared/progression.ts");
        const base = freshProgress("normal");
        base.armoryMigration = 1;
        base.revision = 1;
        const rewardId = `audit-conflict-reward-${action}`;
        const result = prepareChoice(
          grantResult(
            base,
            {
              run: `audit-conflict-run-${action}`,
              stage: 1,
              difficulty: "normal",
              win: true,
              time: 30,
              kills: 4,
              missions: [true, false, false],
              weapons: [
                makeWeapon(
                  rewardId,
                  "rifle",
                  2,
                  { power: 3, reload: 2, range: 1, rate: 1 },
                  false,
                  base.serial,
                ),
              ],
              collected: 0,
            },
            () => 0.5,
          ),
          () => 0.5,
        );
        localStorage.setItem(key, JSON.stringify(result));
        localStorage.setItem("swarm-front-player-name-v1", "戦果回復監査");
        return {
          base,
          rewardId,
          rewardCoins: result.result.coins,
          run: result.result.run,
        };
      },
      { key, action },
    );
    const a = await c.newPage();
    await a.goto(origin);
    await a.locator("#pt-normal-reward").waitFor();
    const unrelated = await fixture.evaluate(
      ({ base, key }) => {
        const latest = structuredClone(base);
        latest.revision++;
        latest.coins = 23;
        latest.locks = [latest.inventory[2].id];
        latest.soldiers[0].equipped = [
          latest.inventory[2].id,
          latest.inventory[1].id,
        ];
        localStorage.setItem(key, JSON.stringify(latest));
        return latest;
      },
      { base: seeded.base, key },
    );
    await a.locator("#pt-normal-reward").click();
    await a.locator("#pt-save-conflict").waitFor();
    assert.ok(
      await a.evaluate(() =>
        sessionStorage.getItem("swarm-front-pending-result-v3"),
      ),
    );
    assert.equal(await a.locator("#pt-save-retry").count(), 0);
    const download = a.waitForEvent("download");
    await a.locator("#pt-export-unsaved").click();
    const downloaded = await download;
    await downloaded.saveAs(`${out}/unsaved-result-${action}.json`);
    const exported = JSON.parse(
      fs.readFileSync(`${out}/unsaved-result-${action}.json`, "utf8"),
    );
    assert.equal(exported.pending.result.run, seeded.run);
    await a.screenshot({ path: `${out}/result-conflict-${action}.png` });
    let quotaEvidence;
    if (action === "click") await a.locator("#pt-recover-result").click();
    else if (action === "quota-reload") {
      quotaEvidence = await a.evaluate(() => {
        let low = 0,
          high = 12 * 1024 * 1024,
          failures = 0;
        while (low < high) {
          const size = Math.ceil((low + high) / 2);
          try {
            localStorage.setItem("audit-quota-fill", "x".repeat(size));
            low = size;
          } catch (error) {
            if (error.name !== "QuotaExceededError") throw error;
            failures++;
            high = size - 1;
          }
        }
        localStorage.setItem("audit-quota-fill", "x".repeat(low));
        return { fillerCharacters: low, actualQuotaExceededErrors: failures };
      });
      assert.ok(quotaEvidence.actualQuotaExceededErrors > 0);
      await a.reload();
      await a.locator("#pt-retry-recovery").waitFor();
      assert.ok(
        await a.evaluate(() =>
          sessionStorage.getItem("swarm-front-pending-result-v3"),
        ),
      );
      assert.equal(
        await a.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).coins,
          key,
        ),
        unrelated.coins,
      );
      const failedRecoveryDownload = a.waitForEvent("download");
      await a.locator("#pt-export-unsaved").click();
      await (
        await failedRecoveryDownload
      ).saveAs(`${out}/quota-retained-journal.json`);
      assert.equal(
        JSON.parse(
          fs.readFileSync(`${out}/quota-retained-journal.json`, "utf8"),
        ).pending.result.run,
        seeded.run,
      );
      await a.screenshot({ path: `${out}/quota-recovery-blocked.png` });
      await a.locator("#pt-retry-recovery").click();
      await a.locator("#pt-retry-recovery").waitFor();
      assert.ok(
        await a.evaluate(() =>
          sessionStorage.getItem("swarm-front-pending-result-v3"),
        ),
      );
      await a.evaluate(() => localStorage.removeItem("audit-quota-fill"));
      await a.locator("#pt-retry-recovery").click();
    } else await a.reload();
    await a.locator("#solo").waitFor();
    const recovered = await a.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      key,
    );
    assert.equal(
      recovered.inventory.filter((w) => w.id === seeded.rewardId).length,
      1,
    );
    assert.equal(recovered.coins, unrelated.coins + seeded.rewardCoins);
    assert.deepEqual(recovered.locks, unrelated.locks);
    assert.deepEqual(
      recovered.soldiers[0].equipped,
      unrelated.soldiers[0].equipped,
    );
    assert.equal(
      await a.evaluate(() =>
        sessionStorage.getItem("swarm-front-pending-result-v3"),
      ),
      null,
    );
    const recoveredRaw = JSON.stringify(recovered);
    await a.reload();
    await a.locator("#solo").waitFor();
    assert.equal(
      await a.evaluate((k) => localStorage.getItem(k), key),
      recoveredRaw,
    );
    await solo(a);
    await a.screenshot({ path: `${out}/result-recovered-${action}.png` });
    results.cases.push({
      name: `result-conflict-${action}`,
      passed: true,
      run: seeded.run,
      reward: seeded.rewardId,
      journalSurvivedUntilRecovery: true,
      controls: ["pt-recover-result", "pt-export-unsaved"],
      staleEquipmentNotApplied: true,
      reloadDidNotDuplicate: true,
      coins: recovered.coins,
      fixture:
        "Synthetic saved result; out-of-band newer save without this run; real reward-choice click triggers typed conflict. Actual journal/recovery/download UI.",
      screenshots: [
        `result-conflict-${action}.png`,
        `result-recovered-${action}.png`,
      ],
      export: `unsaved-result-${action}.json`,
      ...(quotaEvidence
        ? {
            quotaEvidence,
            failedRecoveryJournalExport: "quota-retained-journal.json",
            quotaScreenshot: "quota-recovery-blocked.png",
          }
        : {}),
    });
    await c.close();
  }

  {
    const c = await context();
    await seed(c);
    const a = await c.newPage();
    await a.goto(origin);
    await solo(a);
    const initial = await a.evaluate(() => window.__playtest.save);
    const raw = await a.evaluate((key) => {
      const latest = JSON.parse(localStorage.getItem(key));
      latest.revision++;
      latest.coins += 31;
      localStorage.setItem(key, JSON.stringify(latest));
      return localStorage.getItem(key);
    }, key);
    await a.locator(`[data-lock="${initial.inventory[0].id}"]`).click();
    await a.locator("#pt-reload-save").waitFor();
    assert.equal(await a.locator("#pt-recover-result").count(), 0);
    assert.equal(
      await a.evaluate((key) => localStorage.getItem(key), key),
      raw,
    );
    await a.screenshot({ path: `${out}/settings-conflict.png` });
    await a.locator("#pt-reload-save").click();
    await solo(a);
    await a.locator(`[data-lock="${initial.inventory[0].id}"]`).click();
    assert.ok(
      await a.evaluate(
        (id) => window.__playtest.save.locks.includes(id),
        initial.inventory[0].id,
      ),
    );
    assert.equal(
      await a.evaluate(() => window.__playtest.save.coins),
      initial.coins + 31,
    );
    results.cases.push({
      name: "non-result-conflict-reload-and-retry",
      passed: true,
      screenshot: "settings-conflict.png",
      fixture:
        "Intentional out-of-band revision/coin update; actual lock-button action and reload/retry UI.",
    });
    await c.close();
  }
  assert.deepEqual(errors, []);
  results.codeAtFinish = Object.fromEntries(
    Object.keys(results.code).map((filename) => [
      filename,
      sha(fs.readFileSync(filename)),
    ]),
  );
  assert.deepEqual(
    results.codeAtFinish,
    results.code,
    "Audited code changed while the browser verification was running; rerun on stable source.",
  );
  results.passed = true;
  console.log(
    "PASS: seven save-safety cases; real Web Locks prevent concurrent normal/co-op writers; historical writes preserve v3; result recovery by click/reload/quota retry and generic conflict recovery preserve latest data.",
  );
} catch (error) {
  results.passed = false;
  results.failure = String(error.stack || error);
  if (lastPage && !lastPage.isClosed())
    await lastPage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  results.errors = errors;
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
