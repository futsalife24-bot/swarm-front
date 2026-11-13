import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const site = process.env.SWARM_CLOSE_SITE ?? "http://127.0.0.1:5186";
const endpoint = process.env.SWARM_CLOSE_ENDPOINT ?? "http://127.0.0.1:8796";
const publicMode = process.env.SWARM_CLOSE_PUBLIC === "1";
const out =
  process.env.SWARM_CLOSE_UI_OUTPUT ??
  "dist-validation/coop-comfort-close-20261113/product-ui";
if (publicMode) {
  assert.equal(site, "https://swarm-front.melosalife-24.workers.dev");
  assert.equal(endpoint, site + "/api");
} else {
  assert.equal(new URL(site).hostname, "127.0.0.1");
  assert.equal(new URL(endpoint).hostname, "127.0.0.1");
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.SWARM_CLOSE_HEADED !== "1",
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const result = { passed: false, errors: [], checks: [] },
  contexts = [];
const key = publicMode
  ? undefined
  : /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
      readFileSync(".dev.vars", "utf8"),
    )?.[1];
if (!publicMode) assert(key);
async function page(name) {
  const c = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
    hasTouch: true,
    reducedMotion: "reduce",
  });
  contexts.push(c);
  await c.addInitScript(
    (name) => localStorage.setItem("swarm-front-player-name-v1", name),
    name,
  );
  const p = await c.newPage();
  p.setDefaultTimeout(120000);
  p.on("pageerror", (e) => result.errors.push(e.message));
  return p;
}
async function opening(p) {
  await p.waitForFunction(
    () =>
      document.querySelector(".title-entry-start") ||
      document.querySelector("#room-id") ||
      document.querySelector("#front-launch") ||
      document.querySelector("#open-bestiary"),
  );
  const start = p.locator(".title-entry-start");
  if (await start.isVisible()) await start.click();
}
try {
  if (!process.env.SWARM_CLOSE_COOP_ONLY) {
    if (!publicMode) {
      const report = await page("予告表示検査");
      await report.goto(site + "/front.html");
      await opening(report);
      await report.evaluate(async () => {
        const { initializeProgress, persistProgress } =
          await import("/src/client/progression-save.ts");
        const s = initializeProgress("normal", localStorage);
        s.encounters.harrow = "solo";
        persistProgress(s, localStorage);
      });
      await report.reload();
      await opening(report);
      await report.locator("#open-bestiary").click();
      const dialog = report.getByRole("dialog");
      await report.waitForTimeout(900); // Existing report opening transition rejects early clicks.
      await dialog.locator('[data-enemy="harrow"]').click();
      assert.equal(
        await dialog
          .locator('[data-enemy="harrow"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await report.waitForFunction(
        () =>
          document.querySelector(".enemy-viewport")?.dataset.asset === "ready",
      );
      assert.match(await dialog.locator("article").innerText(), /HARROW/);
      await dialog.locator(".harrow-attack-picker").selectOption("Dash");
      await report.waitForTimeout(600);
      assert.equal(
        await dialog.locator(".enemy-viewport").getAttribute("data-motion"),
        "attack",
      );
      await report.screenshot({ path: out + "/harrow-report-dash.png" });
      result.checks.push(
        "HARROW実レポートの説明・モデル・Dash攻撃選択・予告を表示",
      );
      await report.close();
    }

    const solo = await page("単独起動検査");
    await solo.goto(site + "/front.html?solo=1");
    await opening(solo);
    await solo.locator("#front-launch").click();
    await solo.locator("[data-card]").first().click();
    await solo.locator("#controls").waitFor({ state: "visible" });
    await solo.keyboard.down("KeyW");
    await solo.waitForTimeout(1200);
    await solo.keyboard.up("KeyW");
    await solo.screenshot({ path: out + "/solo.png" });
    result.checks.push("実製品の生存ソロ開始・移動");
    await solo.close();
  }

  const peers = [];
  for (const name of ["協力起動ホスト", "協力起動ゲスト"]) {
    const p = await page(name);
    peers.push(p);
    await p.goto(site + "/front.html?coop=1");
    await opening(p);
    await p.locator("css:light=#room-id").waitFor();
    if (!publicMode) {
      await p.locator("css:light=.coop-advanced summary").click();
      await p.locator("css:light=#endpoint").fill(endpoint);
    }
  }
  const [host, guest] = peers;
  console.log("協力入口2画面を表示");
  if (!publicMode) await host.locator("css:light=#creation-key").fill(key);
  else {
    // Read only a boolean: the normal widget obtains and submits its own token.
    // Never substitute a creation key, token or Turnstile response.
    await host.waitForFunction(
      () =>
        !!document.querySelector('input[name="cf-turnstile-response"]')?.value,
      null,
      { timeout: 60000 },
    );
  }
  await host.locator("css:light=#room-name").fill("残件の隔離起動検査");
  await host.locator("css:light=#launch").click();
  await host.locator("css:light=.front-lobby").waitFor();
  await host.waitForFunction(() =>
    /^\d{3}$/.test(
      document.querySelector("#front-room-password")?.textContent?.trim() ?? "",
    ),
  );
  const id = (
    await host.locator("css:light=#front-room-password").innerText()
  ).trim();
  await guest.locator("css:light=#room-id").fill(id);
  await guest.locator("css:light=#room-join").click();
  await guest.locator("css:light=.front-lobby").waitFor();
  await host.waitForFunction(
    () => document.querySelectorAll("[data-fx-member]").length === 2,
  );
  console.log("非公開の自室へ2人接続");
  for (const p of peers) {
    await p.locator("css:light=#front-edit-loadout").click();
    await p.locator("css:light=.front-departure-deck").waitFor();
    await p.waitForTimeout(900);
    await p.locator("css:light=#front-save-pool").click();
    await p.locator("css:light=.front-lobby").waitFor();
  }
  console.log("両者のデッキ保存を確認");
  await host.waitForFunction(
    () => !document.querySelector("#front-start")?.disabled,
  );
  await host.waitForTimeout(900);
  await host.locator("css:light=#front-start").click();
  for (const p of peers) {
    await p.locator("css:light=[data-card]").first().waitFor();
    await p.waitForTimeout(900);
    await p.locator("css:light=[data-card]").first().click();
  }
  await Promise.all(
    peers.map((p) => p.locator("#controls").waitFor({ state: "visible" })),
  );
  await host.keyboard.down("KeyW");
  await host.waitForTimeout(2000);
  await host.keyboard.up("KeyW");
  await host.screenshot({ path: out + "/coop.png" });
  result.checks.push("実製品の非公開部屋作成・2人入室・準備・開始・移動");
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.failure = String(e.stack ?? e);
  result.visible = await Promise.all(
    contexts
      .flatMap((c) => c.pages())
      .map(async (p, i) => {
        await p
          .screenshot({ path: out + "/failure-" + i + ".png" })
          .catch(() => {});
        return p
          .evaluate(() => ({
            report: document
              .querySelector(".enemy-viewport")
              ?.getAttribute("data-asset"),
            description:
              document.querySelector(".enemy-description")?.textContent,
            status: [...document.querySelectorAll("[role=status],.status")].map(
              (x) => x.textContent,
            ),
            screen: document.body.dataset.screen,
            heading: document.querySelector("h1")?.textContent,
          }))
          .catch(() => null);
      }),
  );
  process.exitCode = 1;
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
  writeFileSync(out + "/results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
