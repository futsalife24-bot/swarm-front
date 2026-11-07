import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:5202",
  endpoint = "http://127.0.0.1:8811";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  fs.readFileSync(process.env.SWARM_TEST_VARS_PATH ?? ".dev.vars", "utf8"),
)?.[1];
assert(key);
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const checks = [],
  errors = [];
fs.mkdirSync("dist-validation/room-id", { recursive: true });
async function entry(context, path) {
  const p = await context.newPage();
  p.setDefaultTimeout(45000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.url().includes("/rooms"))
      console.log("room response", r.status(), r.url());
  });
  await p.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "3桁検証"),
  );
  await p.goto(origin + path, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await p.locator("#room-id").waitFor();
  await p.locator(".coop-advanced summary").click();
  await p.locator("#endpoint").fill(endpoint);
  await p.locator("#endpoint").dispatchEvent("change");
  return p;
}
async function lobby(p, front) {
  if (front) {
    await p.locator("#front-launch").waitFor();
    await p.locator("#front-launch").click();
  }
  await p.locator(front ? "#front-room-password" : "#room-code").waitFor();
}
try {
  await fetch(endpoint + "/room-id-fixture", { method: "POST", body: "empty" });
  for (const [front, width, height] of [
    [false, 844, 390],
    [true, 640, 360],
  ]) {
    const contexts = [];
    for (let i = 0; i < 2; i++)
      contexts.push(
        await browser.newContext({
          viewport: { width, height },
          serviceWorkers: "block",
          permissions: ["clipboard-read", "clipboard-write"],
        }),
      );
    const path = front ? "/front.html?coop=1" : "/?coop=1";
    const host = await entry(contexts[0], path);
    await host.locator("#creation-key").fill(key);
    await host.locator("#launch").click();
    console.log("created action", front);
    try {
      await lobby(host, front);
    } catch (e) {
      console.log(await host.locator("body").innerText());
      console.log("errors", errors);
      await host.screenshot({ path: "dist-validation/room-id/failure.png" });
      throw e;
    }
    const selector = front ? "#front-room-password" : "#room-code",
      id = await host.locator(selector).innerText();
    assert.match(id, /^[0-9]{3}$/);
    await host.bringToFront();
    await host.locator(front ? "#front-copy-password" : "#copy").click();
    assert.equal(
      await host.evaluate(() =>
        Promise.race([
          navigator.clipboard.readText(),
          new Promise((_, reject) =>
            setTimeout(() => reject(Error("clipboard timeout")), 5000),
          ),
        ]),
      ),
      id,
    );
    const guest = await entry(
      contexts[1],
      front ? "/front.html?frontRoom=" + id : path,
    );
    if (front) assert.equal(await guest.locator("#room-id").inputValue(), id);
    await guest.locator("#room-id").fill("12");
    await guest.locator("#room-join").click();
    assert.match(
      await guest.locator("#room-list-status").innerText(),
      /数字3桁/,
    );
    assert.equal(
      await guest.locator("#room-id").getAttribute("aria-invalid"),
      "true",
    );
    await guest.locator("#room-id").fill(id);
    await guest.locator("#room-join").click();
    await lobby(guest, front);
    assert.equal(await guest.locator(selector).innerText(), id);
    await host.waitForFunction(
      () => document.querySelectorAll("[data-fx-member]").length === 2,
    );
    assert.equal(
      await host
        .locator(".lobby")
        .evaluate((e) => e.scrollWidth > e.clientWidth),
      false,
    );
    await host.screenshot({
      path:
        "dist-validation/room-id/" +
        (front ? "survival" : "campaign") +
        "-" +
        width +
        ".png",
    });
    checks.push({
      mode: front ? "生存" : "進撃",
      width,
      height,
      id,
      uiCreate: true,
      copy: true,
      invalidRejected: true,
      uiJoin: true,
      invitePrefill: front,
      realMembers: 2,
    });
    fs.writeFileSync(
      "dist-validation/room-id/ui-partial.json",
      JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2),
    );
    for (const c of contexts) await c.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "dist-validation/room-id/ui.json",
    JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
