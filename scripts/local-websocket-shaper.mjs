import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import WebSocket, { WebSocketServer } from "ws";

const QUEUE_BYTES = 4 * 1024 * 1024;
const QUEUE_MESSAGES = 8192;
const WAIT_MS = 30000;

function localUrl(value, label) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    url.port === "0"
  )
    throw new TypeError(
      `${label} must be a credential-free http://127.0.0.1 origin`,
    );
  return url;
}
const closeCode = (code) =>
  Number.isInteger(code) &&
  code >= 1000 &&
  code < 5000 &&
  ![1004, 1005, 1006, 1015].includes(code)
    ? code
    : 1001;
const directionMetrics = () => ({
  receivedMessages: 0,
  receivedBytes: 0,
  sentMessages: 0,
  sentBytes: 0,
  queuedBytes: 0,
  queuedPeakBytes: 0,
  queuedPeakMessages: 0,
  maxScheduledDelayMs: 0,
  overflows: 0,
  sendErrors: 0,
  droppedBytes: 0,
});

/** Local diagnostic transport only. Shapes data messages, not handshake/control frames. */
export async function createLocalWebSocketShaper({
  upstream,
  origin,
  latencyMs = 0,
  bytesPerSecond = Infinity,
}) {
  const upstreamUrl = localUrl(upstream, "upstream");
  const originUrl = localUrl(origin, "origin");
  if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > WAIT_MS)
    throw new RangeError("latencyMs must be 0..30000");
  if (!(
    bytesPerSecond === Infinity ||
    (Number.isFinite(bytesPerSecond) && bytesPerSecond > 0)
  ))
    throw new RangeError("bytesPerSecond must be positive or Infinity");
  const metrics = {
    latencyMs,
    bytesPerSecond: bytesPerSecond === Infinity ? null : bytesPerSecond,
    payloadBandwidthOnly: true,
    perMessageDeflate: false,
    queueLimitBytes: QUEUE_BYTES,
    queueLimitMessages: QUEUE_MESSAGES,
    waitLimitMs: WAIT_MS,
    accepted: 0,
    activeConnections: 0,
    rejectedUpgrades: 0,
    rejectedHttp: 0,
    closed: false,
    connections: [],
  };
  const connections = new Set();
  const upgradedSockets = new Set();
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: QUEUE_BYTES,
    perMessageDeflate: false,
  });
  const server = createServer((_req, res) => {
    metrics.rejectedHttp++;
    res.writeHead(404, { "Content-Type": "text/plain", Connection: "close" });
    res.end("Local WebSocket diagnostic endpoint only");
  });
  let closing;

  function connect(browser, request) {
    const record = {
      id: ++metrics.accepted,
      up: directionMetrics(),
      down: directionMetrics(),
      socketErrors: 0,
      closed: false,
      browserCloseCode: null,
      upstreamCloseCode: null,
      failure: null,
      browserExtensions: browser.extensions,
      upstreamExtensions: null,
    };
    metrics.connections.push(record);
    metrics.activeConnections++;
    const target = new URL(request.url, upstreamUrl);
    target.protocol = "ws:";
    const peer = new WebSocket(target, {
      origin: originUrl.origin,
      perMessageDeflate: false,
      maxPayload: QUEUE_BYTES,
      handshakeTimeout: 10000,
    });
    let ended = false,
      terminateTimer,
      closeTimer;
    const queues = [];
    const connection = { browser, peer, stop };
    connections.add(connection);

    function stop() {
      if (ended) return;
      ended = true;
      clearTimeout(terminateTimer);
      clearTimeout(closeTimer);
      for (const q of queues) q.cancel();
      for (const socket of [browser, peer])
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      record.closed = true;
      metrics.activeConnections--;
      connections.delete(connection);
    }
    function closingDeadline() {
      closeTimer ??= setTimeout(stop, WAIT_MS);
    }
    function fail(direction, kind) {
      if (ended || record.failure) return;
      record.failure = { direction, kind };
      for (const q of queues) q.cancel();
      for (const socket of [browser, peer]) {
        if (socket.readyState === WebSocket.OPEN)
          socket.close(
            kind === "overflow" ? 1013 : 1011,
            "Local transport shaping failure",
          );
        else if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      }
      terminateTimer = setTimeout(stop, 250);
    }
    function queue(direction, socket) {
      const m = record[direction];
      const items = [];
      const pending = new Set();
      let timer,
        available = 0,
        inFlight = 0,
        finishing,
        cancelled = false;
      const finishIfEmpty = () => {
        if (finishing && !items.length && !inFlight) {
          const callback = finishing;
          finishing = undefined;
          callback();
        }
      };
      function cancel() {
        if (cancelled) return;
        cancelled = true;
        clearTimeout(timer);
        timer = undefined;
        m.droppedBytes += items.reduce((n, item) => n + item.data.length, 0);
        m.queuedBytes -= items.reduce((n, item) => n + item.data.length, 0);
        m.droppedBytes += [...pending].reduce(
          (n, item) => n + item.data.length,
          0,
        );
        m.queuedBytes -= [...pending].reduce(
          (n, item) => n + item.data.length,
          0,
        );
        pending.clear();
        items.length = 0;
        finishing = undefined;
      }
      function arm(delay) {
        clearTimeout(timer);
        timer = setTimeout(pump, Math.max(1, delay));
      }
      function pump() {
        clearTimeout(timer);
        timer = undefined;
        if (cancelled || ended) return;
        const oldest = Math.min(
          items[0]?.receivedAt ?? Infinity,
          ...[...pending].map((item) => item.receivedAt),
        );
        if (performance.now() - oldest >= WAIT_MS) {
          m.overflows++;
          fail(direction, "overflow");
          return;
        }
        if (socket.readyState === WebSocket.CONNECTING) {
          if (items.length)
            arm(WAIT_MS - (performance.now() - items[0].receivedAt));
          return;
        }
        if (socket.readyState !== WebSocket.OPEN) {
          // The close handshake sets CLOSING before the close event cancels
          // this queue. Pending data cannot be delivered, but that is not a
          // shaping failure; the eventual close event retains the real code.
          closingDeadline();
          cancel();
          return;
        }
        while (items.length && items[0].due <= performance.now()) {
          const item = items.shift();
          inFlight++;
          pending.add(item);
          socket.send(
            item.data,
            { binary: item.binary, compress: false },
            (error) => {
              inFlight--;
              pending.delete(item);
              if (cancelled) return;
              m.queuedBytes -= item.data.length;
              if (error) {
                m.sendErrors++;
                m.droppedBytes += item.data.length;
                fail(direction, "send-error");
              } else {
                m.sentMessages++;
                m.sentBytes += item.data.length;
              }
              if (!cancelled && !ended) pump();
            },
          );
        }
        const waitDeadline =
          Math.min(
            items[0]?.receivedAt ?? Infinity,
            ...[...pending].map((item) => item.receivedAt),
          ) + WAIT_MS;
        const next = Math.min(items[0]?.due ?? Infinity, waitDeadline);
        if (Number.isFinite(next)) arm(next - performance.now());
        finishIfEmpty();
      }
      function add(data, binary) {
        if (cancelled || ended || record.failure || finishing) return;
        const buffer = Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(data);
        const now = performance.now();
        m.receivedMessages++;
        m.receivedBytes += buffer.length;
        const end =
          Math.max(now, available) + (buffer.length / bytesPerSecond) * 1000;
        const due = end + latencyMs,
          delay = due - now;
        m.maxScheduledDelayMs = Math.max(m.maxScheduledDelayMs, delay);
        if (
          m.queuedBytes + buffer.length > QUEUE_BYTES ||
          items.length + inFlight >= QUEUE_MESSAGES ||
          delay >= WAIT_MS
        ) {
          m.overflows++;
          m.droppedBytes += buffer.length;
          fail(direction, "overflow");
          return;
        }
        available = end;
        items.push({ data: buffer, binary, due, receivedAt: now });
        m.queuedBytes += buffer.length;
        m.queuedPeakBytes = Math.max(m.queuedPeakBytes, m.queuedBytes);
        m.queuedPeakMessages = Math.max(
          m.queuedPeakMessages,
          items.length + inFlight,
        );
        pump();
      }
      return {
        add,
        pump,
        cancel,
        finish(callback) {
          finishing = callback;
          pump();
        },
      };
    }
    const up = queue("up", peer),
      down = queue("down", browser);
    queues.push(up, down);
    browser.on("message", (data, binary) => up.add(data, binary));
    peer.on("message", (data, binary) => down.add(data, binary));
    peer.on("open", () => {
      record.upstreamExtensions = peer.extensions;
      up.pump();
    });
    for (const socket of [browser, peer])
      socket.on("error", () => {
        record.socketErrors++;
        fail(socket === peer ? "up" : "down", "socket-error");
      });
    browser.on("close", (code, reason) => {
      record.browserCloseCode = code;
      if (ended) return;
      closingDeadline();
      down.cancel();
      if (peer.readyState === WebSocket.CONNECTING) {
        stop();
        return;
      }
      up.finish(() => {
        if (peer.readyState === WebSocket.OPEN)
          peer.close(closeCode(code), reason);
        if (peer.readyState === WebSocket.CLOSED) stop();
      });
      if (peer.readyState === WebSocket.CLOSED) stop();
    });
    peer.on("close", (code, reason) => {
      record.upstreamCloseCode = code;
      if (ended) return;
      closingDeadline();
      up.cancel();
      down.finish(() => {
        if (browser.readyState === WebSocket.OPEN)
          browser.close(closeCode(code), reason);
        if (browser.readyState === WebSocket.CLOSED) stop();
      });
      if (browser.readyState === WebSocket.CLOSED) stop();
    });
  }

  server.on("upgrade", (req, socket, head) => {
    upgradedSockets.add(socket);
    socket.once("close", () => upgradedSockets.delete(socket));
    if (
      metrics.closed ||
      req.socket.remoteAddress !== "127.0.0.1" ||
      req.headers.origin !== originUrl.origin ||
      !/^\/rooms\/[a-f0-9]{32}\?ruleset=front-v1$/.test(req.url ?? "")
    ) {
      metrics.rejectedUpgrades++;
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroySoon();
      return;
    }
    wss.handleUpgrade(req, socket, head, (browser) => connect(browser, req));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    endpoint: `http://127.0.0.1:${server.address().port}`,
    metrics,
    close() {
      if (closing) return closing;
      metrics.closed = true;
      for (const connection of [...connections]) connection.stop();
      for (const socket of upgradedSockets) socket.destroy();
      closing = Promise.all([
        new Promise((resolve) => wss.close(resolve)),
        new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
      ]).then(() => undefined);
      server.closeAllConnections();
      return closing;
    },
  };
}
