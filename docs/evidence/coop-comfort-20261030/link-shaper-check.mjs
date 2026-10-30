import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import WebSocket, { WebSocketServer } from "ws";
import { createLocalWebSocketShaper } from "../../../scripts/local-websocket-shaper.mjs";
const out =
  process.env.SWARM_SHAPER_OUTPUT ??
  "dist-validation/coop-comfort-20261030/link-shaper-recheck";
fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:5186";
const room = "/rooms/" + "a".repeat(32) + "?ruleset=front-v1";
const echo = new WebSocketServer({
  host: "127.0.0.1",
  port: 0,
  perMessageDeflate: false,
});
await once(echo, "listening");
const upstream = "http://127.0.0.1:" + echo.address().port;
const peers = new Set(),
  helpers = new Set(),
  clients = new Set();
echo.on("connection", (socket) => {
  peers.add(socket);
  socket.on("close", () => peers.delete(socket));
  socket.on("message", (data, binary) => {
    socket.send(data, { binary });
    if (!binary && data.toString() === "final") socket.close(1000, "complete");
  });
});
const result = { passed: false, tests: [], errors: [] };
const open = async (endpoint, suffix = room, from = origin) => {
  const ws = new WebSocket(endpoint.replace(/^http/, "ws") + suffix, {
    origin: from,
    perMessageDeflate: false,
  });
  clients.add(ws);
  await once(ws, "open");
  return ws;
};
const helper = async (options) => {
  const h = await createLocalWebSocketShaper({ upstream, origin, ...options });
  helpers.add(h);
  return h;
};
async function test(name, fn) {
  const start = performance.now();
  const data = await fn();
  result.tests.push({ name, ms: performance.now() - start, ...data });
}
async function rejection(endpoint, suffix, from = origin) {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(endpoint.replace(/^http/, "ws") + suffix, {
      origin: from,
    });
    clients.add(ws);
    ws.on("unexpected-response", (_req, res) => {
      res.resume();
      ws.terminate();
      resolve(res.statusCode);
    });
    ws.on("error", () => {});
    ws.on("open", () => reject(Error("unexpected accepted connection")));
  });
}
try {
  await test("loopback configuration constraints", async () => {
    for (const bad of [
      { upstream: "http://example.com" },
      { origin: "http://example.com" },
      { upstream: "http://user:pass@127.0.0.1:8793" },
      { origin: "http://127.0.0.1:5186/path" },
      { latencyMs: -1 },
      { bytesPerSecond: 0 },
    ])
      await assert.rejects(() =>
        createLocalWebSocketShaper({ upstream, origin, ...bad }),
      );
    return { rejected: 6 };
  });
  await test("HTTP and Origin/path/query rejection", async () => {
    const h = await helper({});
    assert.equal((await fetch(h.endpoint + "/rooms")).status, 404);
    for (const [path, from] of [
      ["/api/health", origin],
      [room + "&extra=1", origin],
      [room, "http://127.0.0.1:5187"],
      ["/rooms/not-hex?ruleset=front-v1", origin],
    ])
      assert.equal(await rejection(h.endpoint, path, from), 403);
    await h.close();
    return { metrics: h.metrics };
  });
  await test("FIFO text/binary contents with bandwidth and latency", async () => {
    const h = await helper({ latencyMs: 35, bytesPerSecond: 20000 });
    const ws = await open(h.endpoint);
    const payloads = [
      Buffer.from("1".repeat(1000)),
      Buffer.from("2".repeat(1000)),
      Buffer.alloc(1000, 7),
    ];
    const received = [];
    const started = performance.now();
    const done = new Promise((resolve) =>
      ws.on("message", (data, binary) => {
        received.push({
          data: Buffer.from(data),
          binary,
          ms: performance.now() - started,
        });
        if (received.length === 3) resolve();
      }),
    );
    payloads.forEach((data, i) => ws.send(data, { binary: i === 2 }));
    await done;
    received.forEach((r, i) => {
      assert.deepEqual(r.data, payloads[i]);
      assert.equal(r.binary, i === 2);
    });
    assert.ok(received[0].ms >= 140);
    assert.ok(received[2].ms >= 220);
    assert.equal(h.metrics.connections[0].up.sentBytes, 3000);
    assert.equal(h.metrics.connections[0].down.sentBytes, 3000);
    assert.equal(h.metrics.connections[0].browserExtensions, "");
    assert.equal(h.metrics.connections[0].upstreamExtensions, "");
    ws.close();
    await once(ws, "close");
    await h.close();
    return { receivedMs: received.map((x) => x.ms), metrics: h.metrics };
  });
  await test("latency is pipelined rather than compounded per message", async () => {
    const h = await helper({ latencyMs: 60, bytesPerSecond: Infinity });
    const ws = await open(h.endpoint);
    const times = [];
    const started = performance.now();
    const done = new Promise((resolve) =>
      ws.on("message", () => {
        times.push(performance.now() - started);
        if (times.length === 5) resolve();
      }),
    );
    for (let i = 0; i < 5; i++) ws.send(String(i));
    await done;
    assert.ok(times[0] >= 100);
    assert.ok(times.at(-1) - times[0] < 90);
    await h.close();
    return {
      receivedMs: times,
      spreadMs: times.at(-1) - times[0],
      metrics: h.metrics,
    };
  });
  await test("uplink and downlink bandwidth limits remain independent", async () => {
    for (const bad of [{ upBytesPerSecond: 0 }, { downBytesPerSecond: -1 }])
      await assert.rejects(
        createLocalWebSocketShaper({ upstream, origin, ...bad }),
      );
    const h = await helper({
      latencyMs: 10,
      bytesPerSecond: 20000,
      upBytesPerSecond: 2000,
    });
    const ws = await open(h.endpoint);
    const received = [];
    const done = new Promise((resolve) =>
      ws.on("message", (data) => {
        received.push(Buffer.from(data));
        if (received.length === 2) resolve();
      }),
    );
    ws.send("a".repeat(1000));
    ws.send("b".repeat(1000));
    await done;
    assert.equal(received[0].toString(), "a".repeat(1000));
    assert.equal(received[1].toString(), "b".repeat(1000));
    const record = h.metrics.connections[0];
    assert.equal(record.up.sentBytes, 2000);
    assert.equal(record.down.sentBytes, 2000);
    assert.ok(record.up.maxScheduledDelayMs > 900);
    assert.ok(record.down.maxScheduledDelayMs < 150);
    await h.close();
    return { metrics: h.metrics };
  });
  await test("upstream final payload drains before normal close", async () => {
    const h = await helper({ latencyMs: 45, bytesPerSecond: 20000 });
    const ws = await open(h.endpoint);
    const received = [];
    ws.on("message", (data) => received.push(data.toString()));
    const done = once(ws, "close");
    ws.send("final");
    const [code] = await done;
    assert.deepEqual(received, ["final"]);
    assert.equal(code, 1000);
    await h.close();
    return { messages: received.length, code, metrics: h.metrics };
  });
  await test("over-30-second scheduled backlog fails explicitly", async () => {
    const h = await helper({ latencyMs: 0, bytesPerSecond: 1 });
    const ws = await open(h.endpoint);
    const done = once(ws, "close");
    ws.send("x".repeat(31));
    const [code] = await done;
    assert.equal(code, 1013);
    assert.equal(h.metrics.connections[0].up.overflows, 1);
    assert.equal(h.metrics.connections[0].failure.kind, "overflow");
    await h.close();
    assert.equal(h.metrics.activeConnections, 0);
    return { code, metrics: h.metrics };
  });
  await test("4MiB queue boundary rejects a third 2MiB message", async () => {
    const h = await helper({ latencyMs: 1500, bytesPerSecond: Infinity });
    const ws = await open(h.endpoint);
    const done = once(ws, "close");
    const data = Buffer.alloc(2 * 1024 * 1024, 1);
    ws.send(data);
    ws.send(data);
    ws.send(data);
    const [code] = await done;
    assert.equal(code, 1013);
    const c = h.metrics.connections[0];
    assert.equal(c.up.overflows, 1);
    assert.ok(c.up.queuedPeakBytes <= 4 * 1024 * 1024);
    assert.equal(c.browserExtensions, "");
    await h.close();
    assert.equal(c.up.queuedBytes, 0);
    return { code, metrics: h.metrics };
  });
  await test("normal browser closing race discards pending downlink without transport failure", async () => {
    const h = await helper({ latencyMs: 40, bytesPerSecond: 20000 });
    const ws = await open(h.endpoint);
    const warm = once(ws, "message");
    ws.send("warmup");
    await warm;
    const peer = [...peers].find((p) => p.readyState === WebSocket.OPEN);
    assert.ok(peer);
    const done = once(ws, "close");
    ws._socket.pause();
    ws.close(1000, "normal");
    await new Promise((resolve) => setTimeout(resolve, 10));
    peer.send("payload-during-browser-closing");
    await new Promise((resolve) => setTimeout(resolve, 20));
    ws._socket.resume();
    const [code] = await done;
    assert.equal(code, 1000);
    for (let i = 0; i < 100 && h.metrics.activeConnections; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    await h.close();
    const c = h.metrics.connections[0];
    assert.equal(c.browserCloseCode, 1000);
    assert.equal(c.failure, null);
    assert.ok(c.down.droppedBytes > 0);
    assert.equal(c.down.queuedBytes, 0);
    assert.equal(h.metrics.activeConnections, 0);
    return { code, metrics: h.metrics };
  });
  await test("close cancels pending timers/sockets and releases bound port", async () => {
    const h = await helper({ latencyMs: 500, bytesPerSecond: 1000 });
    const ws = await open(h.endpoint);
    ws.send("pending");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const started = performance.now();
    await h.close();
    await h.close();
    assert.ok(performance.now() - started < 1000);
    assert.equal(h.metrics.activeConnections, 0);
    for (const c of h.metrics.connections) {
      assert.equal(c.up.queuedBytes, 0);
      assert.equal(c.down.queuedBytes, 0);
    }
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(Number(new URL(h.endpoint).port), "127.0.0.1", resolve);
    });
    await new Promise((resolve) => probe.close(resolve));
    return { closeMs: performance.now() - started, metrics: h.metrics };
  });
  assert.equal(peers.size, 0);
  result.passed = true;
} catch (error) {
  result.errors.push({ message: error.message, stack: error.stack });
  process.exitCode = 1;
} finally {
  for (const ws of clients)
    if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
  for (const h of helpers) await h.close();
  for (const ws of peers) ws.terminate();
  await new Promise((resolve) => echo.close(resolve));
  fs.writeFileSync(
    out + "/self-test-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: result.passed,
      tests: result.tests.map(
        ({ name, ms, receivedMs, spreadMs, code, closeMs }) => ({
          name,
          ms,
          receivedMs,
          spreadMs,
          code,
          closeMs,
        }),
      ),
      errors: result.errors.map((e) => e.message),
    }),
  );
}
