// 調査用: 専用Chromeの実タブ切替を1往復だけ観測する。製品・実保存は変更しない。
// 旧2試行は実hidden未到達。今回は起動時からnoDefaultsを指定する別構成。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  visibilityPlan,
  visibilityRequestKind,
  createVisibilityProfile,
  removeVisibilityProfile,
  startVisibilityChrome,
} from "./menu-visibility-cdp.mjs";

const origin = process.env.VISIBILITY_ORIGIN || "http://127.0.0.1:5351";
const out =
  process.env.VISIBILITY_OUTPUT || "dist-validation/menu-visibility-temp";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("隔離したローカル開発サーバーだけで実行してください");
const plan = visibilityPlan(origin, out);
if (process.argv.includes("--preflight")) {
  const temporary = createVisibilityProfile();
  removeVisibilityProfile(temporary.profile);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    `${out}/preflight.json`,
    JSON.stringify(
      {
        ...plan,
        browserStarted: false,
        temporaryDirectoryCreatedAndRemoved: true,
        removedProfile: temporary.profile,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("非UI準備確認成功。ブラウザ未起動。実非表示は未確認。");
  process.exit(0);
}
const lease = process.env.VISIBILITY_UI_LEASE;
assert.match(
  lease || "",
  /^UI-\d{8}-\d{3}$/,
  "新規UI貸出IDを指定してから実行してください",
);
fs.mkdirSync(out, { recursive: true });
const hash = (s) => createHash("sha256").update(s).digest("hex");
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  origin,
  at: new Date().toISOString(),
  mechanism:
    "専用一時Chrome、loopback CDP、noDefaults、default contextの実2タブ",
  lease,
  plan,
  visibilityOverridden: false,
  focusEmulation:
    "起動時からnoDefaults=true。focus模擬を設定/解除するコマンドは送らない",
  animationTimingOverridden: false,
  errors: [],
  consoleErrors: [],
  blockedAnalytics: [],
  blockedUnusedTurnstile: [],
  outOfScopeControlRequests: [],
  unexpectedExternalRequests: [],
  result: "incomplete",
};
let session;
let page;
try {
  report.phase = "ローカルdev応答確認";
  const devResponse = await fetch(origin, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(devResponse.status, 200);
  await devResponse.body?.cancel();
  report.phase = "専用Chrome起動";
  session = await startVisibilityChrome(plan);
  const { browser, context } = session;
  report.startup = session.evidence;
  report.browser = browser.version();
  await context.route("**/*", async (route) => {
    const request = route.request();
    const kind = visibilityRequestKind(request.url(), origin);
    if (kind === "local") {
      const pathname = new URL(request.url()).pathname;
      if (
        pathname.startsWith("/api/developer/") ||
        /\/(?:turnstile-config|rooms)(?:\/|$)/.test(pathname)
      )
        report.outOfScopeControlRequests.push(pathname);
      return route.continue();
    }
    if (kind === "internal") return route.continue();
    const url = new URL(request.url());
    const entry = {
      url: url.origin + url.pathname,
      type: request.resourceType(),
      method: request.method(),
    };
    if (kind === "analytics") report.blockedAnalytics.push(entry);
    else if (kind === "unused-turnstile-script")
      report.blockedUnusedTurnstile.push(entry);
    else report.unexpectedExternalRequests.push(entry);
    // 成功モックを返さない。本文・架空保存・queryは記録しない。
    await route.abort("blockedbyclient");
  });
  // ゲームを二重起動せず、空白タブは保存ロックにも触れない。
  const other = context.pages()[0];
  page = await context.newPage();
  await page.setViewportSize({ width: 844, height: 390 });
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
      eventRecords: new WeakMap(),
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
    // 製品の非capture listenerより前に同期観測する。イベントは合成しない。
    document.addEventListener(
      "visibilitychange",
      (event) => {
        if (!probe.armed) return;
        const before = probe.sample();
        const observation = {
          trusted: event.isTrusted,
          before,
          targetIsDocument: event.target === document,
        };
        probe.observations.push(observation);
        probe.eventRecords.set(event, observation);
      },
      true,
    );
  });
  // 通常のソロ入口。管理者/協力/招待/復帰経路を選ばず、認証結果を差し替えない。
  report.phase = "通常ソロ入口";
  await page.goto(origin + "/");
  await page.locator("#solo").waitFor();
  report.entry = await page.evaluate(() => ({
    path: location.pathname,
    search: location.search,
    hash: location.hash,
    legacySolo: document.body.classList.contains("playtest"),
    turnstileHolder: !!document.getElementById("turnstile-room-create"),
  }));
  assert.deepEqual(report.entry, {
    path: "/",
    search: "",
    hash: "",
    legacySolo: true,
    turnstileHolder: false,
  });
  report.phase = "隔離した架空保存の設定";
  await page.evaluate(async () => {
    const module = await import("/src/client/progression-save.ts");
    const fixture = module.freshProgress("normal");
    fixture.tutorials = ["growth", "accessories", "gear", "armory", "base"];
    localStorage.setItem(module.newSaveKey("normal"), JSON.stringify(fixture));
    localStorage.setItem("swarm-front-player-name-v1", "非表示調査用");
  });
  await page.reload();
  await page.bringToFront();
  report.phase = "ソロ出撃準備";
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
  report.reducedMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  assert.equal(
    report.reducedMotion,
    false,
    "通常モーション条件が必要。OS設定は変更しない",
  );
  await page.evaluate(() => {
    const probe = window.__menuVisibilityProbe;
    // 既に製品moduleを読み込んだ後、同じdocumentの非captureへ後から登録する。
    // menu-effectsの同期stop/cleanupより後になる。microtaskの実行順には依存しない。
    document.addEventListener("visibilitychange", (event) => {
      const observation = probe.eventRecords.get(event);
      if (!observation) return;
      observation.after = probe.sample();
      observation.sameTrustedEventAfterProduct = event.isTrusted;
      if (observation.before.hidden) probe.hiddenDone = true;
    });
    probe.armed = true;
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
  report.phase = "装備演出中の実タブ切替";
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
  assert.ok(hide.targetIsDocument && hide.sameTrustedEventAfterProduct);
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
  report.phase = "実非表示から復帰";
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
  assert.deepEqual(report.unexpectedExternalRequests, []);
  assert.deepEqual(report.outOfScopeControlRequests, []);
  report.result = "pass";
} catch (error) {
  report.result = "not-passed";
  report.failure = String(error);
  if (page) {
    report.lastObservation = await page
      .evaluate(() => ({
        documentState: {
          readyState: document.readyState,
          bodyClass: document.body.className,
          soloPresent: !!document.getElementById("solo"),
          saveWriterBlocked: !!document.getElementById("save-writer-blocked"),
        },
        sample: window.__menuVisibilityProbe?.sample?.(),
        observations: window.__menuVisibilityProbe?.observations,
        events: window.__menuVisibilityProbe?.events,
      }))
      .catch(() => null);
  }
  process.exitCode = 1;
} finally {
  if (session) {
    try {
      report.cleanup = await session.cleanup();
    } catch (error) {
      report.cleanupFailure = String(error);
      report.result = "not-passed";
      process.exitCode = 1;
    }
  }
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
