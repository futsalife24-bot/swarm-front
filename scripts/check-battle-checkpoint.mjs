import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = process.argv[3] ?? "dist-validation/battle-checkpoint";
const origin = process.argv[2] ?? "http://127.0.0.1:5197";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const p = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
p.setDefaultTimeout(60000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const key = "swarm-front-battle-checkpoint-v1";
try {
  await p.goto(origin);
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#solo").click();
  await p.locator("#player-name").fill("復帰検証");
  await p.locator("#player-name-form button[type=submit]").click();
  await p.locator("#pt-confirm").click();
  await p.locator("#pt-start").click();
  await p.locator("#pt-enter").click();
  // First-encounter loading can finish after the tutorial. Wait for a real
  // active battle, handling its ordinary controls instead of a fixed 2s delay.
  const deadline = Date.now() + 60000;
  let active = false;
  while (Date.now() < deadline) {
    const skip = p.getByRole("button", { name: /スキップ/ }).first();
    if (await skip.isVisible()) await skip.click();
    active = await p.evaluate(() => {
      const world = window.__playtest?.world;
      return world?.time > 0 && world.enemies.length > 0;
    });
    if (active && (await p.locator("#pause").isVisible())) break;
    active = false;
    await p.waitForTimeout(100);
  }
  assert(active, "An active battle with enemies must become ready");
  console.log(
    "BEFORE PAUSE",
    await p.evaluate(() => ({
      screen: window.__playtest.screen,
      paused: window.__playtest.paused,
      hp: window.__playtest.world?.players[0]?.hp,
      text: document.querySelector("#ui")?.textContent?.slice(0, 400),
    })),
    errors,
  );
  await p.screenshot({ path: out + "/before-pause.png" });
  await p.locator("#pause").click();
  const cycles = [];
  for (let cycle = 1; cycle <= 3; cycle++) {
    const before = await p.evaluate(
      (k) => JSON.parse(JSON.parse(localStorage.getItem(k)).body),
      key,
    );
    assert(before.world.time > 0, "Battle must advance before checkpointing");
    assert(before.world.enemies.length > 0, "Resume must include live enemies");
    assert(before.world.campaignPlan.waves.length > 0);
    await p.reload();
    if (await p.locator("#landscape-start").isVisible())
      await p.locator("#landscape-start").click();
    await p.locator("#pt-resume-battle").waitFor();
    await p.screenshot({ path: out + "/resume-prompt.png" });
    await p.locator("#pt-resume-battle").click();
    await p.locator("#pt-enter").waitFor({ state: "visible" });
    const prepared = await p.evaluate(() => window.__playtest.world);
    assert.deepEqual(prepared, before.world);
    await p.locator("#pt-enter").click();
    await p.locator("#pause").click();
    const resumed = await p.evaluate(() => window.__playtest);
    assert.equal(resumed.world.run, before.world.run);
    assert(
      resumed.world.time >= before.world.time &&
        resumed.world.time < before.world.time + 2,
    );
    assert.deepEqual(resumed.save, JSON.parse(before.progress));
    cycles.push({
      cycle,
      run: before.world.run,
      savedTime: before.world.time,
      resumedTime: resumed.world.time,
      wave: before.world.wave,
      enemies: before.world.enemies.length,
    });
  }
  await p.screenshot({ path: out + "/resumed.png" });
  // Complete a cloned checkpoint roster synthetically. This tests the actual
  // persistence/reward path, not player combat ability or campaign balance.
  const reward = await p.evaluate(async () => {
    const {
      loadProgress,
      grantResult,
      prepareChoice,
      chooseReward,
      persistProgress,
    } = await import("/src/client/progression-save.ts");
    const { readBattleCheckpoint } =
      await import("/src/client/battle-checkpoint.ts");
    const { step, neutral } = await import("/src/shared/game.ts");
    const { stageFor, troopCount } = await import("/src/shared/stages.ts");
    const { makeWeapon } = await import("/src/shared/progression.ts");
    const save = loadProgress("normal");
    const world = readBattleCheckpoint(save).world;
    for (let n = 0; n < 8 && world.phase === "battle"; n++) {
      const plan = stageFor(world).waves[world.wave - 1];
      world.enemies = [];
      world.spawned = troopCount(plan);
      world.solo.bossSpawned = plan.bosses.length;
      step(world, { solo: neutral() });
    }
    if (world.phase !== "victory")
      throw Error("Synthetic roster did not reach victory");
    const input = {
      run: world.run,
      stage: world.solo.stage,
      difficulty: world.solo.difficulty,
      win: true,
      time: world.time,
      kills: world.totalKills,
      missions: [true, false, false],
      collected: 0,
      weapons: [
        makeWeapon(
          "regression-resumed-reward",
          "rifle",
          1,
          { power: 3, reload: 2, range: 1, rate: 1 },
          false,
          save.serial,
        ),
      ],
    };
    const granted = chooseReward(
      prepareChoice(
        grantResult(save, input, () => 0.5),
        () => 0.5,
      ),
      false,
    );
    persistProgress(granted);
    return {
      input,
      saved: granted,
      coinsBefore: save.coins,
      inventoryBefore: save.inventory.length,
    };
  });
  await p.reload();
  await p.locator("#solo").waitFor();
  const after = await p.evaluate(async (input) => {
    const { loadProgress, grantResult } =
      await import("/src/client/progression-save.ts");
    const { readBattleCheckpoint } =
      await import("/src/client/battle-checkpoint.ts");
    const save = loadProgress("normal");
    return {
      saved: save,
      duplicate: grantResult(save, input, () => 0.99),
      checkpoint: readBattleCheckpoint(save),
    };
  }, reward.input);
  assert.deepEqual(after.saved, reward.saved);
  assert.deepEqual(after.duplicate, reward.saved);
  assert.equal(
    after.saved.inventory.filter((w) => w.id === "regression-resumed-reward")
      .length,
    1,
  );
  assert.equal(after.saved.inventory.length, reward.inventoryBefore + 1);
  assert.equal(
    after.saved.coins,
    reward.coinsBefore + reward.saved.result.coins,
  );
  assert.equal(
    after.saved.receipts.filter((run) => run === reward.input.run).length,
    1,
  );
  assert.equal(after.checkpoint, null);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify(
      {
        pass: true,
        finishedAt: new Date().toISOString(),
        origin,
        cycles,
        reward: {
          run: reward.input.run,
          id: "regression-resumed-reward",
          duplicatePrevented: true,
          fixture:
            "Synthetic remaining roster completion and reward; real checkpoint/UI reload and production persistence functions.",
        },
        errors,
      },
      null,
      2,
    ),
  );
  console.log("CHECKPOINT PASS");
} catch (error) {
  await p.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  fs.writeFileSync(
    `${out}/checks.json`,
    JSON.stringify(
      {
        pass: false,
        finishedAt: new Date().toISOString(),
        failure: String(error.stack || error),
        errors,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
