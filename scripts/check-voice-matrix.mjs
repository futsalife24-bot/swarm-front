import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const mode = process.argv[2] || "muted",
  out = "docs/evidence/voice-fix2-20261115",
  base = "http://127.0.0.1:5200/";
const savedState = JSON.parse(
  await readFile("dist-validation/voice-browser-state.json", "utf8"),
);
for (const o of savedState.origins)
  o.localStorage = o.localStorage.filter(
    (v) => v.name !== "swarm-front-session",
  );
const browser = await chromium.launch({ channel: "chrome", headless: true });
const c = await browser.newContext({
  viewport: { width: 844, height: 390 },
  storageState: savedState,
  serviceWorkers: "block",
});
const r = { mode, errors: [], scenes: [] };
await c.addInitScript(
  ({ mode }) => {
    localStorage.setItem("swarm-front-control-captions-v1", "always");
    localStorage.setItem(
      "swarm-front-control-voice-enabled-v1",
      String(mode !== "muted"),
    );
    window.captionLog = [];
    new MutationObserver(() => {
      const n = document.querySelector(".control-caption");
      if (n?.textContent && window.captionLog.at(-1)?.id !== n.dataset.line)
        window.captionLog.push({ id: n.dataset.line, text: n.textContent });
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    window.audioStarts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.audioStarts.push({
        duration: this.buffer?.duration,
        time: performance.now(),
      });
      return start.apply(this, args);
    };
  },
  { mode },
);
await c.route("**/api/**", async (route) => {
  const u = new URL(route.request().url());
  const res = await c.request.fetch(
    "http://127.0.0.1:8796" + u.pathname + u.search,
    {
      method: route.request().method(),
      headers: { ...route.request().headers(), origin: base.slice(0, -1) },
      data: route.request().postDataBuffer() ?? undefined,
    },
  );
  await route.fulfill({ response: res });
});
const p = await c.newPage();
p.setDefaultTimeout(10000);
p.on("pageerror", (e) => r.errors.push(e.message));
const q = (s) => p.locator("css:light=" + s);
const settle = () => p.waitForTimeout(1100);
async function go(url = "") {
  await p.goto(base + url, { waitUntil: "domcontentloaded" });
  await settle();
  if (await q("#pt-discard-battle").count()) {
    await q("#pt-discard-battle").click();
    await settle();
  }
  if (await q(".title-entry-start").count())
    await q(".title-entry-start").click();
  await settle();
  if (await q("#pt-discard-battle").count()) {
    await q("#pt-discard-battle").click();
    await settle();
  }
}
async function shot(scene) {
  const caption = await q(".control-caption").allTextContents();
  await p.screenshot({ path: `${out}/${scene}-${mode}.png` });
  const entry = {
    scene,
    caption,
    log: await p.evaluate(() => window.captionLog),
    audio: await p.evaluate(() => window.audioStarts),
  };
  r.scenes.push(entry);
  console.log("PASS", scene, caption);
}
async function voices() {
  await q("#home-settings").click();
  await settle();
  await p.getByRole("button", { name: "管制AIボイス", exact: true }).click();
  await settle();
  if (!(await q(".cv-dialog").count())) {
    await p.getByRole("button", { name: "管制AIボイス", exact: true }).click();
    await settle();
  }
  await q('[data-voice="hiromi"]').waitFor();
  if (mode !== "missing") {
    await q('[data-voice="hiromi"] [data-cv-action="download"]').click();
    await q('[data-voice="hiromi"][data-state="ready"]').waitFor();
  }
  await q(".cv-dialog .dialog-close").click();
  await q("dialog[open] .dialog-close").click();
}
try {
  await go();
  await voices();
  if (!process.argv.includes("--coop-only")) {
    await go();
    await q('.control-caption[data-line="title"]').waitFor();
    await shot("title");
    await q("#home-tutorial").click();
    await settle();
    await q("#tutorial-training").click();
    const f = p.frameLocator("iframe.training-frame");
    await f.locator("#training-start").click();
    await f.locator(".control-caption").waitFor();
    await p.screenshot({ path: `${out}/training-${mode}.png` });
    if (mode === "audio") {
      await p.waitForTimeout(1200);
      await p.keyboard.down("KeyW");
      await p.waitForTimeout(1200);
      await p.keyboard.up("KeyW");
      await f.locator(".control-caption").waitFor();
      await p.screenshot({ path: `${out}/training-${mode}.png` });
    }
    r.scenes.push({
      scene: "training",
      caption: await f.locator(".control-caption").allTextContents(),
      audio: await f.locator("body").evaluate(() => window.audioStarts),
    });
    console.log("PASS training");
    if (!process.argv.includes("--menus")) {
      await go();
      await q("#solo").click();
      await settle();
      await q('[data-operation="advance"]').click();
      await settle();
      if (await q("#pt-confirm").count()) {
        await q("#pt-confirm").click();
        await settle();
      }
      if (await q("#pt-offer-later").count()) {
        await shot("first-offer");
        await q("#pt-offer-later").click();
        await settle();
      }
      await q("#pt-start").waitFor();
      await q("#pt-start").click();
      await q("#pt-enter").waitFor({ timeout: 60000 });
      await q("#pt-enter").click();
      await q(".control-caption").waitFor();
      await shot("battle");
      if (await q("#pt-tutorial-skip").count()) {
        await q("#pt-tutorial-skip").click();
        await settle();
      }
      await go("front?solo=1");
      await q("#front-launch").click();
      await q("[data-card]").first().waitFor({ timeout: 60000 });
      await settle();
      await q("[data-card]").first().click();
      await q('.control-caption[data-line="srv-sortie"]').waitFor();
      await shot("survival");
    }
    await go("?base=1");
    await q("#pt-base-supply").click();
    await settle();
    if (await q("[data-supply-starter]:visible").count()) {
      await q("[data-supply-starter]").click();
      await settle();
      await q('[data-bd="starter-pick"]').first().click();
      await q('[data-bd="starter-confirm"]').click();
      await settle();
      await go("?base=1");
      await q("#pt-base-supply").click();
      await settle();
    }
    if (await q("[data-supply-recover]:visible").count())
      await q("[data-supply-recover]").click();
    else await q('[data-supply-draw="1"]').click();
    await q('.control-caption[data-line="supply-request"]').waitFor();
    await shot("supply");
  }
  await go("?coop=1");
  console.log("COOP", await q("button:visible").allTextContents());
  await shot("coop-entry");
  const vars = await readFile(".dev.vars", "utf8"),
    key = vars.match(/ROOM_CREATION_KEY="([^"\r\n]+)"/)[1];
  const response = await c.request.post("http://127.0.0.1:8796/api/rooms", {
    headers: { "X-Room-Creation-Key": key },
    data: { name: "字幕検証", listed: false },
  });
  assert.equal(response.status(), 200);
  const { code } = await response.json();
  await q("details.coop-advanced").evaluate((n) => (n.open = true));
  await q("#endpoint").fill("http://127.0.0.1:8796/api");
  await q("#room-id").fill(code);
  await q("#room-join").click();
  await q(".lobby").waitFor({ timeout: 30000 });
  await q(".control-caption").waitFor();
  await settle();
  await shot("coop");
  if (process.argv.includes("--coop-battle")) {
    await q("#begin:not([disabled])").waitFor({ timeout: 60000 });
    await q("#begin").click();
    await q(
      '.control-caption[data-line="adv-sortie"], .control-caption[data-line="tut-battle-multi"]',
    ).waitFor({ timeout: 60000 });
    await p.waitForTimeout(600);
    await shot("coop-battle");
  }
} catch (e) {
  await p.screenshot({ path: `${out}/matrix-failure-${mode}.png` });
  console.log("FAIL", e.message);
  throw e;
} finally {
  await writeFile(
    `${out}/matrix-${mode}${process.argv.includes("--coop-only") ? "-coop" : process.argv.includes("--menus") ? "-menus" : "-all"}.json`,
    JSON.stringify(r, null, 2),
  );
  await writeFile(
    "dist-validation/voice-browser-state.json",
    JSON.stringify(await c.storageState()),
  );
  await browser.close();
}
