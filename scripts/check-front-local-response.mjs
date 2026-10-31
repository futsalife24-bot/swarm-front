import { chromium, expect } from "@playwright/test";
import { createLocalWebSocketShaper } from "./local-websocket-shaper.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186",
  upstream = "http://127.0.0.1:8793";
const out =
  process.env.SWARM_RESPONSE_OUTPUT ??
  "dist-validation/coop-comfort-20261030/local-response/baseline";
const latencies = (process.env.SWARM_RESPONSE_LATENCIES ?? "0,150")
  .split(",")
  .map(Number);
const touchAndActions = process.env.SWARM_RESPONSE_ACTIONS === "1";
const sustained = process.env.SWARM_RESPONSE_SUSTAINED === "1";
assert(!(sustained && touchAndActions));
assert(latencies.every((x) => Number.isFinite(x) && x >= 0 && x <= 500));
mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);
const sources = Object.fromEntries(
  [
    "src/client/front-app.ts",
    "src/client/front-network.ts",
    "src/client/connection-diagnostics.ts",
    "src/shared/state-delta.ts",
    "server/worker.ts",
    "src/client/input.ts",
    "src/client/front-local-motion.ts",
  ].map((path) => [
    path,
    createHash("sha256").update(readFileSync(path)).digest("hex"),
  ]),
);
const result = {
  method:
    "Actual front entry, 1-player cooperative room, real local Worker/WebSocket. Added latency is each direction on WebSocket only; room HTTP uses direct local Worker. No save/game-state fixture. Empty profile with name preference only.",
  sources,
  touchAndActions,
  sustained,
  legacyNegotiation: process.env.SWARM_RESPONSE_LEGACY === "1",
  bandwidth: Number(process.env.SWARM_RESPONSE_BANDWIDTH ?? 0),
  injectedStallMs: Number(process.env.SWARM_RESPONSE_STALL_MS ?? 0),
  runs: [],
  errors: [],
  passed: false,
};
const browser = await chromium.launch({
  channel: "chrome",
  args:
    process.env.SWARM_RESPONSE_DEFAULT_GPU === "1" ? [] : ["--use-angle=d3d11"],
});
try {
  for (const latency of latencies) {
    const shaper = await createLocalWebSocketShaper({
      upstream,
      origin,
      latencyMs: latency,
      ...(process.env.SWARM_RESPONSE_BANDWIDTH
        ? { bytesPerSecond: Number(process.env.SWARM_RESPONSE_BANDWIDTH) }
        : {}),
    });
    const context = await browser.newContext({
      viewport: {
        width: Number(process.env.SWARM_RESPONSE_WIDTH ?? 844),
        height: 390,
      },
      serviceWorkers: "block",
      hasTouch: touchAndActions,
    });
    let page;
    try {
      await context.addInitScript((disabled) => {
        window.__disableResponseOptimizations = disabled;
      }, process.env.SWARM_RESPONSE_LEGACY === "1");
      await context.addInitScript(() => {
        localStorage.setItem("swarm-front-player-name-v1", "応答検査隊員");
        window.__response = { frames: [], keys: [], sent: [] };
        let movingTouch = false;
        for (const type of ["pointermove", "pointerup", "pointercancel"])
          addEventListener(
            type,
            (e) => {
              if (e.pointerType !== "touch") return;
              if (
                type === "pointermove" &&
                !movingTouch &&
                e.target.closest?.("#move")
              ) {
                movingTouch = true;
                window.__response.keys.push({
                  type: "keydown",
                  code: "TouchMove",
                  ms: performance.now(),
                });
              } else if (type !== "pointermove" && movingTouch) {
                movingTouch = false;
                window.__response.keys.push({
                  type: "keyup",
                  code: "TouchMove",
                  ms: performance.now(),
                });
              }
            },
            true,
          );
        for (const type of ["keydown", "keyup"])
          addEventListener(
            type,
            (e) => {
              if (["KeyW", "KeyS", "KeyD", "KeyA"].includes(e.code))
                window.__response.keys.push({
                  type,
                  code: e.code,
                  ms: performance.now(),
                });
            },
            true,
          );
        const send = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
          try {
            const m = JSON.parse(data);
            if (m.type === "hello" && window.__disableResponseOptimizations) {
              delete m.inputReceipt;
              delete m.stateDelta;
              data = JSON.stringify(m);
            }
            if (m.type === "input")
              window.__response.sent.push({
                ms: performance.now(),
                seq: m.input.seq,
                mx: m.input.mx,
                mz: m.input.mz,
                jump: !!m.input.jump,
                dodge: m.input.dodge,
              });
          } catch {}
          return send.call(this, data);
        };
      });
      await context.addInitScript(
        ({ from, to }) => {
          const Original = WebSocket;
          window.WebSocket = class extends Original {
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
      page = await context.newPage();
      page.setDefaultTimeout(60000);
      page.on("pageerror", (e) =>
        result.errors.push(
          e.message.replace(/[a-f0-9]{32,64}/gi, "[redacted]"),
        ),
      );
      const response = await fetch(upstream + "/rooms", {
        method: "POST",
        headers: {
          "X-Room-Creation-Key": key,
          "X-Test-Client": createHash("sha256")
            .update("local-response-" + Date.now())
            .digest("hex"),
        },
        body: JSON.stringify({
          name: "隔離応答検査",
          listed: false,
          ruleset: "front-v1",
          mode: "survival",
        }),
      });
      assert.equal(response.status, 200);
      const room = await response.json();
      await page.goto(
        origin + "/front.html?networkDiagnostics=1&frontRoom=" + room.roomId,
      );
      if (await page.locator(".title-entry-start").isVisible())
        await page.locator(".title-entry-start").click();
      await page.locator("#room-id").waitFor();
      await page.locator(".coop-advanced summary").click();
      await page.locator("#endpoint").fill(upstream);
      await page.locator("#room-id").fill(room.roomId);
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(":light(#room-join)").click();
      await page
        .getByRole("button", { name: "準備完了", exact: true })
        .waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.getByRole("button", { name: "準備完了", exact: true }).click();
      await expect(page.locator(":light(#front-start)")).toBeEnabled({
        timeout: 65000,
      });
      await page.locator(":light(#front-start)").click();
      await page.locator(":light(.rebuild-card[data-card])").first().waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(":light(.rebuild-card[data-card])").first().click();
      await page.locator("#controls").waitFor({ state: "visible" });
      await page.evaluate(async () => {
        const { Renderer } = await import("/src/client/render.ts");
        const render = Renderer.prototype.render;
        Renderer.prototype.render = function (w, id, ...args) {
          const value = render.call(this, w, id, ...args),
            p = w?.players.find((p) => p.id === id),
            v = this.players.get(id)?.position;
          if (p && v)
            window.__response.frames.push({
              ms: performance.now(),
              worldTime: w.time,
              x: p.x,
              z: p.z,
              y: p.y,
              ack: p.ack,
              vx: v.x,
              vz: v.z,
              vy: v.y,
              hp: p.hp,
              evade: p.evade,
              verticalSpeed: p.verticalSpeed ?? 0,
              predict: !!args[3],
              px: args[3]?.x,
              pz: args[3]?.z,
            });
          return value;
        };
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        window.__response.keys = [];
        window.__response.sent = [];
      });
      const stallMs = Number(process.env.SWARM_RESPONSE_STALL_MS ?? 0);
      assert(stallMs >= 0 && stallMs <= 1000);
      if (stallMs)
        await page.evaluate((ms) => {
          setTimeout(() => {
            const until = performance.now() + ms;
            while (performance.now() < until) {}
          }, 15000);
        }, stallMs);
      for (const code of sustained
        ? ["KeyW", "KeyS", "KeyD", "KeyA"]
        : ["KeyW", "KeyD", "KeyW"]) {
        await page.keyboard.down(code);
        await page.waitForTimeout(sustained ? 4000 : 500);
        await page.keyboard.up(code);
        await page.waitForTimeout(sustained ? 100 : 1300);
      }
      let actions;
      if (touchAndActions) {
        const cdp = await context.newCDPSession(page);
        const box = await page.locator("#move").boundingBox();
        assert(box);
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 1, x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: x + 50, y }],
        });
        await page.waitForTimeout(500);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.waitForTimeout(1300);
        const since = await page.evaluate(() => performance.now());
        await page.keyboard.press("KeyF");
        await page.waitForTimeout(1800);
        await page.keyboard.press("Space");
        await page.waitForTimeout(1800);
        actions = await page.evaluate((since) => {
          const frames = window.__response.frames.filter((f) => f.ms >= since);
          const sent = window.__response.sent.filter((f) => f.ms >= since);
          return {
            jumpSent: sent.filter((f) => f.jump).length,
            dodgeSent: sent.filter((f) => f.dodge).length,
            airborneFrames: frames.filter(
              (f) => Math.abs(f.verticalSpeed) > 0.1,
            ).length,
            dodgeFrames: frames.filter((f) => f.evade > 0).length,
            unsafePredictionFrames: frames.filter(
              (f) =>
                f.predict && (f.evade > 0 || Math.abs(f.verticalSpeed) > 0.1),
            ).length,
            alive: frames.every((f) => f.hp > 0),
          };
        }, since);
        assert.equal(actions.jumpSent, 1);
        assert.equal(actions.dodgeSent, 1);
        assert(
          actions.airborneFrames > 0 &&
            actions.dodgeFrames > 0 &&
            actions.alive,
        );
        assert.equal(actions.unsafePredictionFrames, 0);
      }
      if (sustained) await page.waitForTimeout(1800);
      await page.screenshot({ path: `${out}/battle-${latency}.png` });
      const networkDiagnostics = await page.evaluate(() =>
        window.swarmNetworkDiagnostics?.(),
      );
      assert(
        networkDiagnostics,
        "diagnostics must be collected from the running app, never re-import its entry",
      );
      writeFileSync(
        `${out}/diagnostics-${latency}.json`,
        JSON.stringify(networkDiagnostics, null, 2),
      );
      if (stallMs)
        assert(
          networkDiagnostics.samples.inputTimerLagMs.max >= stallMs - 100,
          "injected main-thread stall must be observed",
        );
      const trace = await page.evaluate(() => window.__response),
        trials = [];
      for (const start of trace.keys.filter((k) => k.type === "keydown")) {
        const stop = trace.keys.find(
          (k) => k.type === "keyup" && k.ms > start.ms && k.code === start.code,
        );
        const before = trace.frames.filter((f) => f.ms < start.ms).at(-1);
        assert(before && stop);
        if (sustained) {
          // 継続移動では次の入力へ反転するため、短押し用の停止誤差を流用しない。
          // この検査は視点を操作せず、初期yaw=0のW/S/D/Aを使う。
          const frames = trace.frames.filter(
            (f) => f.ms > start.ms + 200 && f.ms < stop.ms - 100,
          );
          const axis = ["KeyW", "KeyS"].includes(start.code) ? "z" : "x",
            sign = ["KeyW", "KeyA"].includes(start.code) ? -1 : 1;
          const steps = frames.slice(1).map((f, i) => ({
            dt: f.ms - frames[i].ms,
            target:
              Number.isFinite(f["p" + axis]) &&
              Number.isFinite(frames[i]["p" + axis])
                ? (f["p" + axis] - frames[i]["p" + axis]) * sign
                : null,
            authority: (f[axis] - frames[i][axis]) * sign,
          }));
          const predicted = steps.filter((s) => s.target !== null);
          trials.push({
            code: start.code,
            alive: frames.every((f) => f.hp > 0),
            frames: frames.length,
            authorityStates: steps.filter((s) => Math.abs(s.authority) > 0.001)
              .length,
            targetBacksteps: predicted.filter((s) => s.target < -0.05).length,
            targetStops: predicted.filter((s) => Math.abs(s.target) < 0.005)
              .length,
            fallbackFrames: frames.filter((f) => !f.predict).length,
            maxFrameMs: Math.max(...steps.map((s) => s.dt)),
            maxDisplayAuthorityGapM: Math.max(
              ...frames.map((f) => Math.hypot(f.vx - f.x, f.vz - f.z)),
            ),
          });
          continue;
        }
        const after = trace.frames.filter(
          (f) => f.ms >= start.ms && f.ms < stop.ms + 1200,
        );
        const visible = after.find(
            (f) => Math.hypot(f.vx - before.vx, f.vz - before.vz) > 0.025,
          ),
          authority = after.find(
            (f) => Math.hypot(f.x - before.x, f.z - before.z) > 0.025,
          ),
          sent = trace.sent.find((s) => s.ms >= start.ms && (s.mx || s.mz));
        const released = after.filter((f) => f.ms >= stop.ms),
          last = released.at(-1),
          first = released[0];
        assert(last && first);
        const dx = first.vx - before.vx,
          dz = first.vz - before.vz,
          norm = Math.hypot(dx, dz) || 1;
        const projected = released.map(
          (f) => ((f.vx - first.vx) * dx + (f.vz - first.vz) * dz) / norm,
        );
        let peak = 0,
          backtrack = 0;
        for (const distance of projected) {
          peak = Math.max(peak, distance);
          backtrack = Math.max(backtrack, peak - distance);
        }
        trials.push({
          code: start.code,
          sendMs: sent ? sent.ms - start.ms : null,
          visibleMoveMs: visible ? visible.ms - start.ms : null,
          authorityMoveMs: authority ? authority.ms - start.ms : null,
          alive: after.every((f) => f.hp > 0),
          predictedFrames: after.filter((f) => f.predict).length,
          stopFinalErrorM: Math.hypot(last.vx - last.x, last.vz - last.z),
          stopForwardTravelM: Math.max(0, ...projected),
          stopBacktrackM: backtrack,
          maxDisplayAuthorityGapM: Math.max(
            ...after.map((f) => Math.hypot(f.vx - f.x, f.vz - f.z)),
          ),
        });
      }
      const run = {
        latencyEachDirectionMs: latency,
        connectionLabel: await page.locator(".battle-fps").innerText(),
        trials,
        trace,
        actions,
        link: shaper.metrics,
      };
      result.runs.push(run);
      console.log(JSON.stringify({ latency, trials }));
      assert.equal(trials.length, touchAndActions || sustained ? 4 : 3);
      assert(
        trials.every(
          (t) =>
            (sustained
              ? t.frames > 100
              : t.visibleMoveMs !== null &&
                t.authorityMoveMs !== null &&
                t.stopFinalErrorM < 0.1) && t.alive,
        ),
      );
    } catch (e) {
      if (page) {
        await page.screenshot({ path: `${out}/failure-${latency}.png` });
        result.failureScreen = (await page.locator("body").innerText()).replace(
          /[a-f0-9]{32,64}/gi,
          "[redacted]",
        );
      }
      result.failureLink = shaper.metrics;
      throw e;
    } finally {
      await context.close();
      await shaper.close();
    }
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.failure = String(e);
  process.exitCode = 1;
} finally {
  writeFileSync(out + "/results.json", JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    passed: result.passed,
    errors: result.errors,
    failure: result.failure,
  }),
);
