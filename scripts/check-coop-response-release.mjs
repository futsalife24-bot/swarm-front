import { chromium } from "@playwright/test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const base = "https://swarm-front.melosalife-24.workers.dev";
const out =
  process.env.SWARM_RELEASE_EVIDENCE || "docs/evidence/coop-response-20261101";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const result = {
  checkedAt: new Date().toISOString(),
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  workerVersion: process.env.SWARM_WORKER_VERSION,
  base,
  checks: [],
  errors: [],
  passed: false,
  scope:
    "公開ファイルSHA照合と空Chromeのソロ起動。本人セーブ・本番部屋は不使用。協力通信は別途隔離Workerで検証。",
};
const paths = [
  "index.html",
  "front.html",
  "sw.js",
  "asset-download-manifest.json",
  ...readdirSync("dist/assets")
    .filter((p) => /\.(js|css)$/.test(p))
    .map((p) => "assets/" + p),
];
for (const path of paths) {
  const response = await fetch(
    base + "/" + (path === "front.html" ? "front" : path),
    { cache: "no-store", signal: AbortSignal.timeout(30000) },
  );
  const remote = Buffer.from(await response.arrayBuffer()),
    local = readFileSync("dist/" + path);
  result.checks.push({
    path,
    status: response.status,
    localSha256: sha(local),
    publicSha256: sha(remote),
    match: response.ok && sha(local) === sha(remote),
  });
}
const health = await fetch(base + "/api/health");
result.health = { status: health.status, body: await health.json() };
assert(result.checks.every((x) => x.match));
assert.equal(result.health.body.ok, true);
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  // This check only exercises the published solo entry. No production room or save APIs.
  await context.route("**/*", (route) => {
    if (!["GET", "HEAD"].includes(route.request().method()))
      return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await context.addInitScript(() => {
    localStorage.setItem("swarm-front-player-name-v1", "配信検査隊員");
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => result.errors.push(e.message));
  await page.goto(base + "/front?solo=1&networkDiagnostics=1");
  await page.locator("#front-launch").click();
  await page.locator(".rebuild-card[data-card]").first().click();
  await page.locator("#controls").waitFor({ state: "visible" });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyW");
  assert.deepEqual(result.errors, []);
  result.soloStarted = true;
  await page.screenshot({ path: out + "/published-844.png" });
  result.passed = true;
} finally {
  await browser.close();
  writeFileSync(out + "/delivery.json", JSON.stringify(result, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    passed: result.passed,
    files: result.checks.length,
    health: result.health,
    errors: result.errors,
  }),
);
