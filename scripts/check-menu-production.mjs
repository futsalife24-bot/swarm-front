import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://127.0.0.1:4326";
const dir = `dist-validation/menu-ui/${base.includes("127.0.0.1") ? "production-preview" : "published"}`;
mkdirSync(dir, { recursive: true });
const html = readFileSync("dist/index.html", "utf8");
const paths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const assets = [];
for (const path of paths) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(sha(bytes), sha(readFileSync("dist" + path)));
  assets.push({ path, sha256: sha(bytes), bytes: bytes.length });
}
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [1280, 582],
    [844, 390],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install();
    await p.goto(base);
    await p.locator("#solo").waitFor();
    await p.clock.pauseAt(
      new Date((await p.evaluate(() => Date.now())) + 2000),
    );
    await p.screenshot({ path: `${dir}/home-${width}.png` });
    await p.locator("#solo").click();
    const critical = await p.evaluate(() =>
      [
        "#stage-select",
        '[data-pick="0"]',
        '[data-pick="1"]',
        "#launch",
        "#gear-armory",
      ].map((s) => {
        const e = document.querySelector(s),
          b = e.getBoundingClientRect(),
          hit = document.elementFromPoint(
            b.x + b.width / 2,
            b.y + b.height / 2,
          );
        return {
          s,
          inside:
            b.bottom <= innerHeight &&
            b.right <= innerWidth &&
            b.x >= 0 &&
            b.y >= 0,
          reachable: hit === e || e.contains(hit),
        };
      }),
    );
    assert.ok(
      critical.every((c) => c.inside && c.reachable),
      JSON.stringify(critical),
    );
    assert.equal(
      await p
        .locator(".gear-brief")
        .evaluate((e) => e.scrollHeight - e.clientHeight),
      0,
    );
    await p.screenshot({ path: `${dir}/gear-${width}.png` });
    await p.locator("#gear-settings").click();
    await p.locator("#volume").fill("0.5");
    assert.match(
      await p.locator(".settings-status").innerText(),
      /保存しました/,
    );
    await p.keyboard.press("Escape");
    await p.locator("#gear-armory").click();
    assert.equal(await p.locator(".armory-row-effect").count(), 3);
    await p.locator("#armory-compare-open").click();
    assert.equal(
      await p.getByRole("dialog").locator(".armory-stats tbody tr").count(),
      5,
    );
    await p.keyboard.press("Escape");
    await p.screenshot({ path: `${dir}/armory-${width}.png` });
    await p.locator("#armory-gear").click();
    await p.locator("#launch").click();
    await p.locator("#hud").waitFor({ state: "visible" });
    assert.equal(await p.evaluate(() => typeof window.__swarm), "undefined");
    await p.clock.runFor(400);
    await p.locator("#pause").click();
    await p.locator("#pause-leave").click();
    await p.locator("#pause-quit").click();
    await p.locator(".gear").waitFor();
    assert.deepEqual(errors, []);
    results.push({
      width,
      height,
      critical,
      soloStartAndRetreat: true,
      errors,
    });
    await p.close();
  }
  writeFileSync(
    `${dir}/checks.json`,
    JSON.stringify(
      { base, date: new Date().toISOString(), assets, results },
      null,
      2,
    ),
  );
  console.log(
    "PASS: compiled JS/CSS match, both menu sizes fit, settings save, comparison expands, solo start/retreat work, no page errors or development globals.",
  );
} finally {
  await browser.close();
}
