// 調査用: 専用Chromeの実タブ切替を1往復だけ観測する。製品・実保存は変更しない。
// 2026-10-07の2試行は実hidden未到達。合格実績なし。再開条件は調査記録を参照。
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const origin = process.env.VISIBILITY_ORIGIN || "http://127.0.0.1:5351";
const out = process.env.VISIBILITY_OUTPUT || "dist-validation/menu-visibility";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("隔離したローカル開発サーバーだけで実行してください");
fs.mkdirSync(out, { recursive: true });
const hash = (s) => createHash("sha256").update(s).digest("hex");
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  origin,
  at: new Date().toISOString(),
  mechanism:
    "headed Chrome, same isolated context, two real tabs, bringToFront",
  visibilityOverridden: false,
  focusEmulation:
    "Disable requested via secondary CDP sessions; effectiveness unconfirmed",
  animationTimingOverridden: false,
  errors: [],
  consoleErrors: [],
  result: "incomplete",
};
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--use-angle=d3d11"],
});
let page;
try {
  report.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  // ゲームを二重起動せず、空白タブは保存ロックにも触れない。
  const other = await context.newPage();
  await other.goto("about:blank");
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") report.consoleErrors.push(e.text());
  });
  await page.addInitScript(() => {
    const probe = (window.__menuVisibilityProbe = {
      animations: [],
      events: [],
      observations: [],
      armed: false,
      hiddenDone: false,
    });
    probe.sample = () => ({
      at: performance.now(),
      visibility: document.visibilityState,
      hidden: document.hidden,
      layers: document.querySelectorAll(".menu-fx-equip,.menu-fx-trace").length,
      animations: probe.animations.map((a, index) => ({
        index,
        state: a.playState,
        currentTime: a.currentTime,
        connected: !!a.effect?.target?.isConnected,
      })),
    });
    // captureとmicrotaskを比較する準備。実hidden未到達のため後者の実行順も未検証。
    // 再開時は製品リスナー処理後の観測を保証すること。hiddenや時刻は偽装しない。
    document.addEventListener(
      "visibilitychange",
      (event) => {
        if (!probe.armed) return;
        const before = probe.sample();
        const observation = { trusted: event.isTrusted, before };
        probe.observations.push(observation);
        queueMicrotask(() => {
          observation.after = probe.sample();
          if (before.hidden) probe.hiddenDone = true;
        });
      },
      true,
    );
  });
  // 開発用解析抑止を指定。画面遷移後を含む全送信抑止は保証されず、実測ではCORSエラーあり。
  await page.goto(origin + "/?developer=1");
  await page.locator("#solo").waitFor();
  await page.evaluate(async () => {
    const module = await import("/src/client/progression-save.ts");
    const fixture = module.freshProgress("normal");
    fixture.tutorials = ["growth", "accessories", "gear", "armory", "base"];
    localStorage.setItem(module.newSaveKey("normal"), JSON.stringify(fixture));
    localStorage.setItem("swarm-front-player-name-v1", "非表示調査用");
  });
  await page.reload();
  // focused/activeの模擬解除を別CDP sessionから要求する。元sessionへの効果は未確認。
  // visibility値を設定せず、実タブ切替のブラウザイベントを観測する。
  for (const tab of [page, other]) {
    const session = await context.newCDPSession(tab);
    await session.send("Emulation.setFocusEmulationEnabled", {
      enabled: false,
    });
  }
  await page.bringToFront();
  await page.locator("#solo").click();
  await page.waitForTimeout(1100);
  const locks = () =>
    page.evaluate(async () =>
      (await navigator.locks.query()).held
        .filter((l) => l.name === "swarm-front-shared-save-writer-v3")
        .map((l) => ({ name: l.name, mode: l.mode })),
    );
  report.lockBefore = await locks();
  assert.equal(report.lockBefore.length, 1);
  await page.evaluate(() => {
    window.__menuVisibilityProbe.armed = true;
  });
  await page.locator('[data-row="v2-starter-rocket"] [data-detail]').click();
  const before = await page.evaluate(() => {
    const probe = window.__menuVisibilityProbe;
    probe.animations = document
      .getAnimations()
      .filter(
        (a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition),
      );
    for (const [index, a] of probe.animations.entries()) {
      for (const type of ["cancel", "finish"])
        a.addEventListener(type, () =>
          probe.events.push({
            type,
            index,
            at: performance.now(),
            hidden: document.hidden,
          }),
        );
    }
    return {
      sample: probe.sample(),
      save: localStorage.getItem("swarm-front-shared-progress-v3"),
    };
  });
  report.before = before.sample;
  assert.equal(before.sample.visibility, "visible");
  assert.ok(before.sample.layers > 0, "非表示前に演出が存在すること");
  assert.ok(before.sample.animations.some((a) => a.state === "running"));
  assert.equal(
    JSON.parse(before.save).soldiers[0].equipped[0],
    "v2-starter-rocket",
  );
  await other.bringToFront();
  // 非表示中のrAFを待たず、状態をポーリングする。合成イベントは送らない。
  await page.waitForFunction(
    () => window.__menuVisibilityProbe.hiddenDone,
    undefined,
    { polling: 50, timeout: 3000 },
  );
  report.hidden = await page.evaluate(() =>
    window.__menuVisibilityProbe.sample(),
  );
  report.observations = await page.evaluate(
    () => window.__menuVisibilityProbe.observations,
  );
  const hide = report.observations.find((o) => o.before.hidden);
  assert.ok(hide?.trusted, "ブラウザ由来の実visibilitychangeが必要");
  assert.ok(
    hide.before.animations.some((a) => a.state === "running"),
    "自然終了後の空確認では合格にしない",
  );
  assert.equal(hide.before.layers > 0, true);
  assert.equal(hide.after.layers, 0);
  assert.ok(
    hide.after.animations.every((a) => a.state === "idle"),
    "finishではなくcancelされた状態を確認する",
  );
  assert.equal(report.hidden.hidden, true);
  report.lockHidden = await locks();
  assert.deepEqual(report.lockHidden, report.lockBefore);
  const hiddenSave = await page.evaluate(() =>
    localStorage.getItem("swarm-front-shared-progress-v3"),
  );
  assert.equal(hiddenSave, before.save);
  await page.bringToFront();
  await page.waitForFunction(() => document.visibilityState === "visible");
  await page.waitForTimeout(300);
  report.returned = await page.evaluate(() =>
    window.__menuVisibilityProbe.sample(),
  );
  assert.equal(report.returned.layers, 0);
  assert.ok(report.returned.animations.every((a) => a.state === "idle"));
  report.events = await page.evaluate(
    () => window.__menuVisibilityProbe.events,
  );
  report.observations = await page.evaluate(
    () => window.__menuVisibilityProbe.observations,
  );
  assert.ok(report.events.some((e) => e.type === "cancel"));
  assert.equal(
    report.events.some((e) => e.type === "finish"),
    false,
  );
  const returnedSave = await page.evaluate(() =>
    localStorage.getItem("swarm-front-shared-progress-v3"),
  );
  assert.equal(returnedSave, before.save);
  report.saveHashes = {
    before: hash(before.save),
    hidden: hash(hiddenSave),
    returned: hash(returnedSave),
  };
  await page.screenshot({ path: `${out}/returned.png` });
  // 復帰後の新しい操作が可能で、取消した演出を再生し直さないこと。
  await page.locator('[data-row="v2-starter-rifle"] [data-detail]').click();
  assert.ok(await page.locator(".menu-fx-trace").count());
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".menu-fx-equip,.menu-fx-trace").length === 0,
  );
  report.nextEquipment = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3"))
        .soldiers[0].equipped[0],
  );
  assert.equal(report.nextEquipment, "v2-starter-rifle");
  assert.deepEqual(report.errors, []);
  report.result = "pass";
} catch (error) {
  report.result = "not-passed";
  report.failure = String(error);
  if (page) {
    report.lastObservation = await page
      .evaluate(() => ({
        sample: window.__menuVisibilityProbe?.sample?.(),
        observations: window.__menuVisibilityProbe?.observations,
        events: window.__menuVisibilityProbe?.events,
      }))
      .catch(() => null);
  }
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(
    `${out}/result.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    source: report.source,
    failure: report.failure,
    output: out,
  }),
);
