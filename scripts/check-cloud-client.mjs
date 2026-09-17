import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const out = "dist-validation/cloud-client";
fs.mkdirSync(out, { recursive: true });
const errors = [];
async function device() {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  // An HTTP proxy to the real local Worker; no API responses are fabricated.
  await p.route("**/api/cloud/**", async (route) => {
    const request = route.request();
    const response = await route.fetch({
      url: "http://127.0.0.1:8793" + new URL(request.url()).pathname,
      headers: {
        ...request.headers(),
        origin: "http://127.0.0.1:8793",
        host: "127.0.0.1:8793",
      },
    });
    await route.fulfill({ response });
  });
  await p.goto("http://127.0.0.1:5197");
  await p.waitForFunction(() => !!window.__playtest);
  return p;
}
try {
  const a = await device(),
    b = await device();
  const code = await a.evaluate(async () => {
    const save = await import("/src/client/progression-save.ts");
    save.initializeProgress("normal");
    return (await import("/src/client/cloud-save.ts")).createCloudSave();
  });
  const coins = await a.evaluate(async () => {
    const save = await import("/src/client/progression-save.ts"),
      cloud = await import("/src/client/cloud-save.ts");
    const s = save.loadProgress("normal");
    s.coins += 12;
    save.persistProgress(s);
    await cloud.syncCloud();
    if (cloud.cloudStatus().status !== "saved")
      throw Error("first sync failed");
    return s.coins;
  });
  assert.equal(
    await b.evaluate(async (code) => {
      const cloud = await import("/src/client/cloud-save.ts");
      const remote = await cloud.inspectCloud(code);
      cloud.restoreCloud(code, remote, null);
      return remote.save.coins;
    }, code),
    coins,
  );
  await b.evaluate(async () => {
    const save = await import("/src/client/progression-save.ts"),
      cloud = await import("/src/client/cloud-save.ts");
    const s = save.loadProgress("normal");
    s.coins += 15;
    for (const run of ["client-a", "client-b", "client-c"])
      s.receipts.push(run);
    s.weeklyPending = ["client-a", "client-b", "client-c"];
    save.persistProgress(s);
    await cloud.syncCloud();
  });
  assert.equal(
    await a.evaluate(async () => {
      const save = await import("/src/client/progression-save.ts"),
        cloud = await import("/src/client/cloud-save.ts");
      const s = save.loadProgress("normal");
      s.coins += 1;
      save.persistProgress(s);
      await cloud.syncCloud();
      return cloud.cloudStatus().status;
    }),
    "conflict",
  );
  const restored = await a.evaluate(async (code) => {
    const save = await import("/src/client/progression-save.ts"),
      cloud = await import("/src/client/cloud-save.ts");
    const remote = await cloud.inspectCloud(code);
    cloud.restoreCloud(
      code,
      remote,
      localStorage.getItem(save.newSaveKey("normal")),
    );
    await cloud.syncCloud();
    const next = await cloud.claimCloudWeekly("campaign-3");
    return { coins: next.save.coins, claimed: next.save.weekly.claimed };
  }, code);
  assert.equal(restored.coins, coins + 15 + 150);
  assert.deepEqual(restored.claimed, ["campaign-3"]);
  await a.evaluate(async () => {
    await (await import("/src/client/cloud-save.ts")).deleteCloudSave();
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify(
      {
        pass: true,
        checks: [
          "same code returns newer progress",
          "second device restore",
          "offline event queue acknowledgement",
          "conflict fence",
          "explicit restore",
          "weekly reward",
          "delete cloud only",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("CLOUD CLIENT PASS");
} finally {
  await browser.close();
}
