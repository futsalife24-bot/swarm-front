import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

// Real, independent browser contexts and local Durable Object/WebSocket traffic.
// The load fixture shortens setup; this is not a phone or Internet measurement.
const origin = process.env.PERF_ORIGIN || "http://127.0.0.1:5196";
const endpoint = process.env.PERF_ENDPOINT || "http://127.0.0.1:8796";
const label = process.argv[2] || "current";
assert.match(label, /^[a-z0-9-]+$/);
const out = `dist-validation/coop-performance/${label}`;
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Local credential required");
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
});
assert.ok(response.ok, `Room creation ${response.status}`);
const { code } = await response.json();
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const pages = [],
  errors = [],
  samples = [],
  messages = [[], [], []],
  sent = [[], [], []];
let measuring = false;
const percentile = (xs, p) =>
  [...xs].sort((a, b) => a - b)[
    Math.min(xs.length - 1, Math.floor(xs.length * p))
  ] ?? 0;
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    pages.push(page);
    await page.addInitScript(
      (name) => localStorage.setItem("swarm-front-player-name-v1", name),
      `計測隊員${i + 1}`,
    );
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (ws) => {
      if (!new URL(ws.url()).pathname.startsWith("/rooms/")) return;
      ws.on("framesent", ({ payload }) => {
        const m = JSON.parse(payload.toString());
        sent[i].push({ at: performance.now(), type: m.type });
      });
      ws.on("framereceived", ({ payload }) => {
        const m = JSON.parse(payload.toString());
        if (m.type === "error") errors.push(m.reason);
        if (!measuring) return;
        if (m.type === "state")
          messages[i].push({
            at: performance.now(),
            bytes: Buffer.byteLength(payload),
            time: m.world.time,
          });
      });
    });
    await page.goto(`${origin}/#${code}`);
    await page.locator(".coop-advanced summary").click();
    await page.locator("#endpoint").fill(endpoint);
    await page.locator("#launch").click();
    await page.locator(".lobby").waitFor();
  }
  await pages[0].waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 3,
  );
  await pages[0].locator("#begin:not(:disabled)").click();
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          window.__swarm?.screen === "battle" && window.__swarm.trooper.loaded,
      ),
    ),
  );
  assert.ok(
    (
      await fetch(`${endpoint}/fixtures/${code}/performance`, {
        method: "POST",
      })
    ).ok,
  );
  await pages[0].waitForTimeout(2000);
  for (const p of pages) {
    await p.evaluate(() => {
      window.__perfFrames = [];
      let last = performance.now();
      window.__perfRecording = true;
      function frame(now) {
        if (!window.__perfRecording) return;
        window.__perfFrames.push(now - last);
        last = now;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const fire = await p.locator("#fire").boundingBox();
    assert.ok(fire);
    const touch = await p.context().newCDPSession(p);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 7, x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 },
      ],
    });
  }
  const cdp = await pages[0].context().newCDPSession(pages[0]);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  measuring = true;
  for (let i = 0; i < 15; i++) {
    await pages[0].waitForTimeout(1000);
    samples.push(
      await pages[0].evaluate(() => {
        const d = window.__swarm;
        return {
          fps: d.fps,
          drawCalls: d.drawCalls,
          players: d.world.players.length,
          enemies: d.world.enemies.length,
          phase: d.world.phase,
          quality: d.performance,
          firing: d.input.fire,
        };
      }),
    );
  }
  measuring = false;
  const { profile } = await cdp.send("Profiler.stop");
  fs.writeFileSync(`${out}/client.cpuprofile`, JSON.stringify(profile));
  const hot = profile.nodes
    .filter((n) => n.hitCount)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 25)
    .map((n) => ({
      name: n.callFrame.functionName,
      url: n.callFrame.url.replace(origin, ""),
      hits: n.hitCount,
    }));
  const clients = [];
  for (const [i, p] of pages.entries()) {
    const result = await p.evaluate(() => {
      window.__perfRecording = false;
      const d = window.__swarm;
      return {
        frames: window.__perfFrames,
        run: d.world.run,
        players: d.world.players.map((p) => p.id),
        loaded: d.trooper.loaded,
        performance: d.performance,
        screen: d.screen,
        firing: d.input.fire,
      };
    });
    assert.equal(result.players.length, 3);
    assert.ok(result.loaded);
    assert.equal(result.screen, "battle");
    assert.ok(messages[i].length > 50, "All three clients must keep receiving");
    const ms = messages[i],
      gaps = ms.slice(1).map((m, j) => m.at - ms[j].at);
    clients.push({
      frames: result.frames.length,
      frameMedian: percentile(result.frames, 0.5),
      frameP95: percentile(result.frames, 0.95),
      messages: ms.length,
      meanBytes: ms.reduce((a, m) => a + m.bytes, 0) / ms.length,
      gapP95: percentile(gaps, 0.95),
      run: result.run,
      performance: result.performance,
      firing: result.firing,
    });
    await p.screenshot({ path: `${out}/player-${i + 1}.png` });
  }
  assert.equal(new Set(clients.map((c) => c.run)).size, 1);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/report.json`,
    JSON.stringify(
      {
        label,
        environment:
          "Windows Chrome D3D11, 844x390 x3, local Worker, 40-enemy fixture, 15s simultaneous fire",
        clients,
        samples,
        hot,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ label, clients, hot: hot.slice(0, 10), errors }, null, 2),
  );
} catch (error) {
  fs.writeFileSync(
    `${out}/failure.json`,
    JSON.stringify({ errors, sent, samples }, null, 2),
  );
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: `${out}/failure-${i}.png` });
    console.error(await p.locator("#ui").innerText());
  }
  throw error;
} finally {
  await browser.close();
}
