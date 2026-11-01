// 調査専用: 実ローカルWorker/WebSocket/描画で協力1人の生存戦を自然進行させ、
// 端末・中継の両側で時系列を有限バッファに記録する。製品コードは変更しない。
//
// 使い方（worktreeのルートで、Worker:8837とVite:5317を起動済み）:
//   node scripts/lag-investigation/trace-coop.mjs <条件名> [秒数]
// 条件: baseline | delay150 | down-bw | down-pause | up-pause | client-stall | cpu4x
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createTraceShaper } from "./trace-shaper.mjs";

const origin = "http://127.0.0.1:5317",
  upstream = "http://127.0.0.1:8837";
const condition = process.argv[2] ?? "baseline";
const seconds = Number(process.argv[3] ?? 180);
const rep = process.env.LAG_REP ?? "1";
const out = `dist-validation/lag-resilience-20261101/runs/${condition}-${rep}`;
mkdirSync(out, { recursive: true });

// 障害注入は1条件ずつ。自然発生の記録(baseline)と混ぜない。
const pauseSchedule = (direction) =>
  [300, 600, 1200, 300, 600, 1200].map((durationMs, i) => ({
    direction,
    startMs: 45000 + i * 20000,
    durationMs,
  }));
const conditions = {
  baseline: {},
  "rate-burst": {},
  delay150: { downDelayMs: 150, upDelayMs: 150 },
  "down-bw": { downBytesPerSecond: Number(process.env.LAG_DOWN_BPS ?? 60000) },
  "down-pause": { pauses: pauseSchedule("down") },
  "up-pause": { pauses: pauseSchedule("up") },
  // 上り1回だけの停止。LAG_PAUSE_MSで長さを変え、送信頻度上限での切断の閾値を見る。
  "up-pause-once": {
    pauses: [
      {
        direction: "up",
        startMs: 45000,
        durationMs: Number(process.env.LAG_PAUSE_MS ?? 1200),
      },
    ],
  },
  "client-stall": { clientStalls: [300, 600, 1200, 300, 600, 1200] },
  cpu4x: { cpuThrottle: 4 },
};
const spec = conditions[condition];
assert(spec, `unknown condition ${condition}`);
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);

const result = {
  condition,
  rep,
  spec,
  seconds,
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: execFileSync("git", ["status", "--short", "--", "src", "server"], {
    encoding: "utf8",
  }).trim(),
  method:
    "実front入口、協力1人の生存戦、実ローカルWorker(wrangler dev --local)とWebSocket。中継は同一PC上で記録し、端末とサーバーの時刻は同じOS時計(epoch ms)。PC Chromeでありスマホ実測ではない。",
  errors: [],
};
const shaper = await createTraceShaper({ upstream, origin, ...spec });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
let page;
try {
  await context.addInitScript(() => {
    localStorage.setItem("swarm-front-player-name-v1", "遅延調査隊員");
    const at = () => performance.timeOrigin + performance.now();
    const T = (window.__lag = {
      frames: [],
      wsIn: [],
      wsOut: [],
      states: [],
      receipts: [],
      timing: [],
      pongs: [],
      labels: [],
      world: [],
      events: [],
      longtasks: [],
      choices: [],
    });
    let frame = 0;
    const raf = () => {
      T.frames.push(at());
      if (T.frames.length > 40000) T.frames.shift();
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    for (const type of [
      "visibilitychange",
      "focus",
      "blur",
      "pagehide",
      "pageshow",
    ])
      addEventListener(
        type,
        () => T.events.push({ at: at(), type, hidden: document.hidden }),
        true,
      );
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          T.longtasks.push({
            at: performance.timeOrigin + e.startTime,
            ms: e.duration,
          });
      }).observe({ type: "longtask", buffered: true });
    } catch {}
    const Original = WebSocket;
    window.WebSocket = class extends Original {
      constructor(url, protocols) {
        super(url, protocols);
        if (!String(url).includes("/rooms/")) return; // Vite HMR等は記録しない
        window.__lagSocket = this;
        this.addEventListener("message", (e) => {
          T.wsIn.push({
            at: at(),
            bytes: typeof e.data === "string" ? e.data.length : 0,
          });
          if (T.wsIn.length > 60000) T.wsIn.shift();
        });
        this.addEventListener("open", () =>
          T.events.push({ at: at(), type: "ws-open" }),
        );
        this.addEventListener("close", (e) =>
          T.events.push({ at: at(), type: "ws-close", code: e.code }),
        );
      }
    };
    const send = Original.prototype.send;
    Original.prototype.send = function (data) {
      try {
        const m = JSON.parse(data);
        T.wsOut.push({
          at: at(),
          type: String(m.type).slice(0, 16),
          seq: m.input?.seq,
          fire: m.input ? !!m.input.fire : undefined,
          stateAck: m.stateAck,
          buffered: this.bufferedAmount,
        });
        if (T.wsOut.length > 60000) T.wsOut.shift();
      } catch {}
      return send.call(this, data);
    };
    setInterval(() => {
      const text = document.querySelector(".battle-fps")?.textContent ?? "";
      if (text !== T.labels.at(-1)?.text) T.labels.push({ at: at(), text });
      const cards = document.querySelectorAll(
        ".rebuild-card[data-card]",
      ).length;
      const last = T.choices.at(-1);
      if (!!cards !== !!last?.open) T.choices.push({ at: at(), open: !!cards });
    }, 50);
    void frame;
  });
  page = await context.newPage();
  page.setDefaultTimeout(70000);
  page.on("pageerror", (e) =>
    result.errors.push(e.message.replace(/[a-f0-9]{32,64}/gi, "[redacted]")),
  );
  if (spec.cpuThrottle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: spec.cpuThrottle,
    });
  }
  await context.addInitScript(
    ({ from, to }) => {
      const Base = window.WebSocket;
      window.WebSocket = class extends Base {
        constructor(url, protocols) {
          const value = String(url);
          super(
            value.startsWith(from + "/rooms/")
              ? to + value.slice(from.length)
              : value,
            protocols,
          );
        }
      };
    },
    {
      from: upstream.replace("http:", "ws:"),
      to: shaper.endpoint.replace("http:", "ws:"),
    },
  );
  const response = await fetch(upstream + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": key,
      "X-Test-Client": createHash("sha256")
        .update(`lag-claude-${condition}-${rep}-${Date.now()}`)
        .digest("hex"),
    },
    body: JSON.stringify({
      name: "遅延独立調査",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body.slice(0, 200));
  const room = JSON.parse(body);
  await page.goto(
    origin + "/front.html?networkDiagnostics=1&frontRoom=" + room.roomId,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  if (await page.locator(".title-entry-start").isVisible())
    await page.locator(".title-entry-start").click();
  await page.locator("#room-id").waitFor();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(upstream);
  await page.locator("#room-id").fill(room.roomId);
  const shutter = () =>
    page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
  await shutter();
  console.log("画面読込・入室開始");
  await page.locator(":light(#room-join)").click();
  await page.getByRole("button", { name: "準備完了", exact: true }).waitFor();
  await shutter();
  await page.getByRole("button", { name: "準備完了", exact: true }).click();
  await page.locator(":light(#front-start)").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector("#front-start")?.disabled,
    null,
    { timeout: 70000 },
  );
  await page.locator(":light(#front-start)").click();
  await page.locator(":light(.rebuild-card[data-card])").first().waitFor();
  await shutter();
  await page.locator(":light(.rebuild-card[data-card])").first().click();
  await page.locator("#controls").waitFor({ state: "visible" });
  // アプリと同じmodule instanceのprototypeへ記録だけを追加する（入口の再importはしない）。
  await page.evaluate(async () => {
    const at = () => performance.timeOrigin + performance.now();
    const T = window.__lag;
    const { ConnectionDiagnostics } =
      await import("/src/client/connection-diagnostics.ts");
    const { StateReceipt } = await import("/src/client/state-receipt.ts");
    const { Renderer } = await import("/src/client/render.ts");
    const D = ConnectionDiagnostics.prototype;
    const state = D.state,
      server = D.server,
      pong = D.pong;
    D.state = function (now, stateId) {
      T.states.push(at());
      return state.call(this, now, stateId);
    };
    D.server = function (value) {
      if (value && typeof value === "object")
        T.timing.push({ at: at(), ...value });
      return server.call(this, value);
    };
    D.pong = function (now) {
      T.pongs.push(at());
      return pong.call(this, now);
    };
    const receive = StateReceipt.prototype.receive;
    StateReceipt.prototype.receive = function (id, urgent) {
      T.receipts.push({ at: at(), id, urgent: !!urgent });
      return receive.call(this, id, urgent);
    };
    const render = Renderer.prototype.render;
    let n = 0;
    Renderer.prototype.render = function (w, id, ...args) {
      if (n++ % 6 === 0) {
        const p = w?.players?.find((p) => p.id === id);
        T.world.push({
          at: at(),
          time: w?.time,
          hp: p?.hp,
          ammo: Array.isArray(p?.ammo) ? p.ammo.join("/") : undefined,
          enemies: w?.enemies?.length,
          active: !!args[4],
        });
      }
      return render.call(this, w, id, ...args);
    };
    T.instrumentedAt = at();
  });
  // 自然進行: 射撃を保持し、移動方向を一定周期で変える。強化選択は最初の札を選ぶ。
  const box = await page.locator("#world").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const started = Date.now();
  console.log("戦闘計測開始");
  const keys = ["KeyW", "KeyD", "KeyS", "KeyA"];
  let k = 0,
    stallIndex = 0,
    ended = "";
  while (Date.now() - started < seconds * 1000) {
    const elapsed = Date.now() - started;
    if (condition === "rate-burst" && stallIndex === 0 && elapsed >= 12000) {
      stallIndex++;
      await page.evaluate(() => {
        for (let n = 0; n < 40; n++)
          window.__lagSocket.send(JSON.stringify({ type: "ping" }));
      });
    }
    if (
      spec.clientStalls &&
      stallIndex < spec.clientStalls.length &&
      elapsed >= 45000 + stallIndex * 20000
    ) {
      const ms = spec.clientStalls[stallIndex++];
      await page.evaluate((ms) => {
        window.__lag.events.push({
          at: performance.timeOrigin + performance.now(),
          type: "injected-stall",
          ms,
        });
        const until = performance.now() + ms;
        while (performance.now() < until) {}
      }, ms);
    }
    const card = page
      .locator(":light(.rebuild-card[data-card]:not([disabled]))")
      .first();
    if (await card.isVisible().catch(() => false)) {
      await page.mouse.up();
      await card.click().catch(() => {});
      await page.waitForTimeout(400);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    }
    const outcome = await page.evaluate(() => {
      const text = document.body.innerText;
      return /戦闘不能|敗北|全滅|作戦失敗/.test(text) &&
        !document.querySelector("#controls:not([hidden])")
        ? text.slice(0, 200)
        : "";
    });
    if (outcome) {
      ended = outcome.replace(/[a-f0-9]{32,64}/gi, "[redacted]");
      break;
    }
    await page.keyboard.down(keys[k % 4]);
    await page.waitForTimeout(1500);
    await page.keyboard.up(keys[k % 4]);
    k++;
  }
  await page.mouse.up();
  result.endedEarly = ended || null;
  result.wallSeconds = (Date.now() - started) / 1000;
  await page.screenshot({ path: `${out}/end.png` });
  result.trace = await page.evaluate(() => window.__lag);
  assert(
    result.trace.wsOut.some((e) => e.fire),
    "実射撃入力が必要",
  );
  assert.equal(result.errors.length, 0);
  if (condition === "rate-burst") {
    assert(
      result.trace.events.some((e) => e.type === "ws-close" && e.code === 4008),
    );
    assert(shaper.connections.length >= 2, "再接続が必要");
    const close = result.trace.events.find(
      (e) => e.type === "ws-close" && e.code === 4008,
    );
    assert(
      result.trace.receipts.some((e) => e.at > close.at + 1000),
      "復帰後の状態受理が必要",
    );
  }
  result.diagnostics = await page.evaluate(() =>
    window.swarmNetworkDiagnostics?.(),
  );
} catch (e) {
  result.failure = String(e?.stack ?? e).replace(
    /[a-f0-9]{32,64}/gi,
    "[redacted]",
  );
  if (page)
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  result.link = { log: shaper.log, connections: shaper.connections };
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await shaper.close().catch(() => {});
  writeFileSync(`${out}/trace.json`, JSON.stringify(result));
}
console.log(
  JSON.stringify({
    condition,
    rep,
    out,
    failure: result.failure ?? null,
    endedEarly: result.endedEarly ?? null,
    errors: result.errors.length,
  }),
);
