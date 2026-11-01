/** Isolated PWA version-switch check using the production service worker. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const worker = await readFile(new URL("../public/sw.js", import.meta.url));
const names = { old: "front-11111111.js", next: "front-22222222.js" };
let deployed = "old";
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  response.setHeader("Cache-Control", "no-store");
  if (path === "/sw.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(worker);
  } else if (
    path === "/" ||
    path === "/front" ||
    path === "/front/" ||
    path === "/front.html"
  ) {
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<!doctype html><html><body><script src="/assets/${names[deployed]}"></script><script>navigator.serviceWorker.register('/sw.js')</script></body></html>`,
    );
  } else if (
    path === `/assets/${names.old}` ||
    path === `/assets/${names.next}`
  ) {
    response.setHeader("Content-Type", "text/javascript");
    response.end(
      `window.swarmBuild = ${JSON.stringify(path === `/assets/${names.old}` ? "old" : "next")}`,
    );
  } else {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/front/`);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // The first load predates control; navigate once under the installed worker.
  await page.reload();
  assert.equal(await page.evaluate(() => window.swarmBuild), "old");
  await page.waitForFunction(
    async () =>
      !!(await (
        await caches.open("swarm-front-shell-v1")
      ).match(new URL("/front.html", location.href))),
  );
  const before = await page.evaluate(async () => ({
    controlling: !!navigator.serviceWorker.controller,
    cacheKeys: await caches.keys(),
  }));

  deployed = "next";
  assert.equal(
    await page.evaluate(() => window.swarmBuild),
    "old",
    "an already open page keeps its JS",
  );
  await context.setOffline(true);
  await page.reload();
  assert.equal(
    await page.evaluate(() => window.swarmBuild),
    "old",
    "offline navigation uses cached old HTML",
  );

  await context.setOffline(false);
  await page.reload();
  assert.equal(
    await page.evaluate(() => window.swarmBuild),
    "next",
    "online navigation uses new HTML and hashed JS",
  );
  await page.waitForFunction(
    async () =>
      !!(await (
        await caches.open("swarm-front-shell-v1")
      ).match(new URL("/assets/front-22222222.js", location.href))),
  );
  const after = await page.evaluate(async () => ({
    controlling: !!navigator.serviceWorker.controller,
    cacheKeys: await caches.keys(),
    frontHtml: (
      await (
        await caches.open("swarm-front-shell-v1")
      ).match(new URL("/front.html", location.href))
    )?.status,
    oldAsset: !!(await (
      await caches.open("swarm-front-shell-v1")
    ).match(new URL("/assets/front-11111111.js", location.href))),
    newAsset: !!(await (
      await caches.open("swarm-front-shell-v1")
    ).match(new URL("/assets/front-22222222.js", location.href))),
  }));
  console.log(
    JSON.stringify({
      initial: before,
      openPageAfterDeploy: "old",
      offlineReload: "old",
      onlineReload: "next",
      after,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
