// Run the unchanged base Network class in Chrome against the local new Worker.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import assert from "node:assert/strict";

const base = "http://127.0.0.1:8797";
const oldSource = "src/client/legacy-network-gate.ts";
const sourceSha = "3f2c429c442c44d54bf4a8132cc791f30534ae9d";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
let vite, browser;
try {
  writeFileSync(
    oldSource,
    execFileSync("git", ["show", `${sourceSha}:src/client/network.ts`]),
  );
  vite = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { host: "127.0.0.1", port: 5186, strictPort: true },
  });
  await vite.listen();
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const room = await fetch(base + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(room.status, 200);
  const { code } = await room.json();
  await page.goto(
    "http://127.0.0.1:5186/scripts/catena-legacy-gate-preview.html",
    {
      timeout: 120000,
      waitUntil: "domcontentloaded",
    },
  );
  await page.waitForFunction(() => window.__legacy, null, { timeout: 120000 });
  await page.evaluate((code) => window.__legacy.start(code), code);
  await page.waitForFunction(
    () => window.__legacy.observations.statuses.includes("接続済み"),
    null,
    { timeout: 20000 },
  );
  const fixture = await fetch(`${base}/fixtures/${code}/catena-omega`, {
    method: "POST",
  });
  assert.equal(fixture.status, 200, await fixture.text());
  try {
    await page.waitForFunction(
      () =>
        window.__legacy.observations.statuses.some((s) =>
          s.includes("再読み込み"),
        ),
      null,
      { timeout: 40000 },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        waitingFor: "更新案内",
        observed: await page.evaluate(() => window.__legacy?.observations),
        screen: await page.evaluate(() => window.__legacy?.status()),
        errors,
      }),
    );
    throw error;
  }
  const result = await page.evaluate(() => ({
    statuses: window.__legacy.observations.statuses,
    oldBodyStates: window.__legacy.observations.oldBodyStates,
    tokenRetained: Boolean(window.__legacy.token()),
    screen: window.__legacy.status(),
  }));
  assert.equal(result.oldBodyStates, 0);
  assert.equal(result.tokenRetained, true);
  assert.equal(errors.length, 0);
  await page.screenshot({
    path: "dist-validation/catena-omega/legacy-update-notice.png",
  });
  writeFileSync(
    "dist-validation/catena-omega/legacy-browser.json",
    JSON.stringify({ ...result, errors, sourceSha }, null, 2),
  );
  console.log(JSON.stringify({ ...result, errors, sourceSha }));
} finally {
  await browser?.close();
  await vite?.close();
  unlinkSync(oldSource);
}
