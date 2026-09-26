import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:5186";
const out = process.argv[3] ?? "dist-validation/audit-round3/recovery-receipts";
const key = "swarm-front-shared-progress-v3";
const journalKey = "swarm-front-pending-result-v3";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const files = [
  "src/bootstrap.ts",
  "src/client/progression-save.ts",
  "src/client/save-recovery.ts",
  "src/client/playtest-app.ts",
  "src/client/shared-armory.ts",
  "src/client/save-writer.ts",
  "scripts/check-recovery-receipts.mjs",
];
const code = () =>
  Object.fromEntries(files.map((file) => [file, sha(fs.readFileSync(file))]));
const results = {
  head: git("rev-parse", "HEAD"),
  status: git("status", "--short"),
  command: `node scripts/check-recovery-receipts.mjs ${origin}`,
  code: code(),
  cases: [],
  fixture:
    "Actual Chrome, Web Locks, localStorage and startup journal recovery. Synthetic battle history is generated with production freshProgress/grantResult/appendCollected/prepareChoice/chooseReward/dismantle APIs. Only initial storage snapshots and stale journal replay are injected; no save/recovery/transport mocks. No live battle or Worker behavior is claimed by this script.",
};
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
results.browser = browser.version();
const errors = [];
let page;
const ids = (save) => [...save.inventory, ...save.pending].map((w) => w.id);
async function saved() {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
}
async function ready() {
  await page.locator("#solo").waitFor();
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), journalKey),
    null,
  );
}
async function replay(journal) {
  await page.evaluate(
    ({ key, journal }) => sessionStorage.setItem(key, JSON.stringify(journal)),
    { key: journalKey, journal },
  );
  await page.reload();
  await ready();
  return saved();
}
try {
  for (const scenario of ["same-run", "later-run", "unreceived-once"]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    await context.route(`${origin}/recovery-receipt-fixture`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Recovery receipt fixture</title><body>Receipt regression fixture</body>",
      }),
    );
    page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/recovery-receipt-fixture`);
    const fixture = await page.evaluate(
      async ({ scenario, key, journalKey }) => {
        const p = await import("/src/client/progression-save.ts");
        const { makeWeapon, weaponYield } =
          await import("/src/shared/progression.ts");
        const initial = p.freshProgress("normal");
        initial.armoryMigration = 1;
        initial.revision = 1;
        const run = `audit-receipt-${scenario}`,
          xId = `${run}-collected-x`,
          yId = `${run}-unreceived-y`;
        const make = (id, acquired) =>
          makeWeapon(
            id,
            "rifle",
            2,
            { power: 3, reload: 2, range: 1, rate: 1 },
            false,
            acquired,
          );
        const base = p.grantResult(
          initial,
          {
            run,
            stage: 1,
            difficulty: "normal",
            win: true,
            time: 30,
            kills: 4,
            missions: [true, false, false],
            weapons: [make(`${run}-initial`, initial.serial)],
            collected: 0,
          },
          () => 0.5,
        );
        const x = make(xId, base.serial),
          y = make(yId, base.serial + 1);
        const pending = p.appendCollected(
          base,
          scenario === "unreceived-once" ? [x, y] : [x],
        );
        const accepted = p.chooseReward(
          p.prepareChoice(p.appendCollected(base, [x]), () => 0.5),
          false,
        );
        let latest = p.dismantle(accepted, [xId]);
        const powderAfterX = latest.powder;
        if (scenario !== "same-run") {
          latest = p.chooseReward(
            p.prepareChoice(
              p.grantResult(
                latest,
                {
                  run: `${run}-later`,
                  stage: 2,
                  difficulty: "normal",
                  win: true,
                  time: 20,
                  kills: 5,
                  missions: [true, false, false],
                  weapons: [make(`${run}-later-reward`, latest.serial)],
                  collected: 0,
                },
                () => 0.5,
              ),
              () => 0.5,
            ),
            false,
          );
        }
        latest.revision = 7;
        p.validateProgress(base);
        p.validateProgress(pending);
        p.validateProgress(latest);
        const journal = { base, pending };
        localStorage.setItem(key, JSON.stringify(latest));
        localStorage.setItem("swarm-front-player-name-v1", "受領履歴監査隊員");
        sessionStorage.setItem(journalKey, JSON.stringify(journal));
        return {
          scenario,
          run,
          xId,
          yId,
          latest,
          journal,
          powderAfterX,
          xYield: weaponYield(x),
          yYield: weaponYield(y),
        };
      },
      { scenario, key, journalKey },
    );
    fs.writeFileSync(
      `${out}/${scenario}-fixture.json`,
      JSON.stringify(fixture, null, 2),
    );
    assert.equal(fixture.latest.powder, fixture.powderAfterX);
    assert.ok(!ids(fixture.latest).includes(fixture.xId));
    await page.goto(origin);
    await ready();
    const recovered = await saved();
    assert.ok(
      !ids(recovered).includes(fixture.xId),
      "Already accepted and dismantled X must not be recreated.",
    );
    assert.equal(recovered.powder, fixture.latest.powder);
    assert.equal(recovered.coins, fixture.latest.coins);
    if (scenario !== "same-run")
      assert.equal(recovered.result.run, fixture.latest.result.run);
    assert.equal(
      ids(recovered).filter((id) => id === fixture.yId).length,
      scenario === "unreceived-once" ? 1 : 0,
    );
    await page.locator("#solo").click();
    await page.locator("#pt-start").waitFor();
    await page.screenshot({ path: `${out}/${scenario}-recovered.png` });
    const repeated = await replay(fixture.journal);
    assert.deepEqual(
      repeated,
      recovered,
      "Replaying identical stale journal must not change saved rewards or powder.",
    );

    let settled;
    if (scenario === "unreceived-once") {
      // Use actual writer-owned persistence for the second dismantle as well.
      settled = await page.evaluate(
        async ({ key, id }) => {
          const { loadProgress, dismantle, persistProgress } =
            await import("/src/client/progression-save.ts");
          const next = dismantle(loadProgress("normal"), [id]);
          persistProgress(next);
          return JSON.parse(localStorage.getItem(key));
        },
        { key, id: fixture.yId },
      );
      assert.equal(settled.powder, fixture.latest.powder + fixture.yYield);
      // A different journal fingerprint prevents the aggregate replay marker
      // from being the only thing protecting this already consumed weapon.
      const changedJournal = await page.evaluate(async (journal) => {
        const p = await import("/src/client/progression-save.ts");
        return {
          base: journal.base,
          pending: p.chooseReward(
            p.prepareChoice(journal.pending, () => 0.5),
            false,
          ),
        };
      }, fixture.journal);
      const afterChangedReplay = await replay(changedJournal);
      assert.ok(!ids(afterChangedReplay).includes(fixture.xId));
      assert.ok(
        !ids(afterChangedReplay).includes(fixture.yId),
        "Once recovered and then dismantled Y must not return under a different journal fingerprint.",
      );
      assert.equal(afterChangedReplay.powder, settled.powder);
      assert.equal(afterChangedReplay.coins, settled.coins);
      const again = await replay(changedJournal);
      assert.deepEqual(again, afterChangedReplay);
      await page.locator("#solo").click();
      await page.locator("#pt-start").waitFor();
      await page.screenshot({
        path: `${out}/${scenario}-after-dismantle-replay.png`,
      });
    }
    results.cases.push({
      scenario,
      passed: true,
      x: fixture.xId,
      y: fixture.yId,
      xAbsentAfterRecovery: true,
      powderBeforeRecovery: fixture.latest.powder,
      powderAfterRecovery: recovered.powder,
      coinsUnchanged: true,
      replayUnchanged: true,
      ...(settled
        ? {
            yRecoveredExactlyOnce: true,
            powderAfterYDismantle: settled.powder,
            changedFingerprintDidNotResurrect: true,
          }
        : {}),
      fixture: `${scenario}-fixture.json`,
      screenshot: `${scenario}-recovered.png`,
      recoveredSha256: sha(JSON.stringify(recovered)),
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  results.codeAtFinish = code();
  assert.deepEqual(
    results.codeAtFinish,
    results.code,
    "Source changed during verification; rerun on stable code.",
  );
  results.passed = true;
  console.log(
    "PASS: receipt recovery does not resurrect accepted/dismantled X in same or later run; unreceived Y recovers once and stays dismantled after changed-fingerprint replay; powder and coins preserved.",
  );
} catch (error) {
  results.passed = false;
  results.failure = String(error.stack || error);
  if (page && !page.isClosed())
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  results.errors = errors;
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
