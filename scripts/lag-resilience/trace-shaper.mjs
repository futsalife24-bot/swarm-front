// 調査専用のローカルWebSocket中継。製品コードからは参照しない。
// 片道遅延・帯域・一時停止窓を方向別に与え、全データメッセージの時刻を記録する。
// 記録は型・stateId・stateAck・入力seq・networkTimingなど許可した項目だけで、
// token・名前・入力内容・本文は保存しない。
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import WebSocket, { WebSocketServer } from "ws";

const epoch = () => performance.timeOrigin + performance.now();
const TIMING_KEYS = [
  "tickMs",
  "previousEncodeMs",
  "clockDroppedMs",
  "stateInFlight",
];

function describe(direction, buffer) {
  const meta = { bytes: buffer.length };
  let m;
  try {
    m = JSON.parse(buffer.toString("utf8"));
  } catch {
    meta.type = "unparsed";
    return meta;
  }
  if (!m || typeof m !== "object") return meta;
  if (typeof m.type === "string") meta.type = m.type.slice(0, 24);
  if (Number.isSafeInteger(m.stateId)) meta.stateId = m.stateId;
  if (Number.isSafeInteger(m.stateAck)) meta.stateAck = m.stateAck;
  if (Number.isSafeInteger(m.inputAck)) meta.inputAck = m.inputAck;
  if (m.type === "stateChunk") {
    meta.snapshot = m.snapshot;
    meta.index = m.index;
    meta.total = m.total;
  }
  if (
    direction === "up" &&
    m.type === "input" &&
    Number.isSafeInteger(m.input?.seq)
  )
    meta.seq = m.input.seq;
  const timing = m.networkTiming;
  if (timing && typeof timing === "object")
    meta.timing = Object.fromEntries(
      TIMING_KEYS.filter((k) => typeof timing[k] === "number").map((k) => [
        k,
        timing[k],
      ]),
    );
  return meta;
}

/**
 * pauses: [{ direction: "down"|"up", startMs, durationMs }] 接続開始からの相対時刻。
 * 停止窓に入ったメッセージは順序を保って窓の終わりまで保留する（TCPの再送待ちの模擬）。
 */
export async function createTraceShaper({
  upstream,
  origin,
  downDelayMs = 0,
  upDelayMs = 0,
  downBytesPerSecond = Infinity,
  upBytesPerSecond = Infinity,
  pauses = [],
}) {
  const log = [];
  const connections = [];
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 4 << 20,
  });
  const server = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  const sockets = new Set();

  function connect(browser, request) {
    const id = connections.length + 1;
    const openedAt = epoch();
    const record = {
      id,
      openedAt,
      closedAt: null,
      browserClose: null,
      upstreamClose: null,
    };
    connections.push(record);
    const target = new URL(request.url, upstream);
    target.protocol = "ws:";
    const peer = new WebSocket(target, {
      origin,
      perMessageDeflate: false,
      maxPayload: 4 << 20,
    });
    const lanes = {};
    for (const direction of ["up", "down"]) {
      const delay = direction === "up" ? upDelayMs : downDelayMs;
      const rate = direction === "up" ? upBytesPerSecond : downBytesPerSecond;
      const windows = pauses
        .filter((p) => p.direction === direction)
        .map((p) => [
          openedAt + p.startMs,
          openedAt + p.startMs + p.durationMs,
        ]);
      const destination = direction === "up" ? peer : browser;
      const queue = [];
      let wireFree = 0,
        lastDue = 0,
        timer;
      const pump = () => {
        clearTimeout(timer);
        timer = undefined;
        while (queue.length && queue[0].due <= epoch()) {
          if (destination.readyState === WebSocket.CONNECTING) break;
          const item = queue.shift();
          if (destination.readyState === WebSocket.OPEN) {
            destination.send(item.data, {
              binary: item.binary,
              compress: false,
            });
            item.entry.sent = epoch();
          } else item.entry.dropped = true;
        }
        if (queue.length)
          timer = setTimeout(pump, Math.max(1, queue[0].due - epoch()));
      };
      lanes[direction] = {
        pump,
        add(data, binary) {
          const buffer = Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data);
          const now = epoch();
          const wireEnd =
            Math.max(now, wireFree) + (buffer.length / rate) * 1000;
          wireFree = wireEnd;
          let due = Math.max(wireEnd + delay, lastDue);
          for (const [start, end] of windows)
            if (due >= start && due < end) due = end;
          lastDue = due;
          const entry = {
            c: id,
            dir: direction,
            recv: now,
            due,
            sent: null,
            ...describe(direction, buffer),
          };
          log.push(entry);
          queue.push({ data: buffer, binary, due, entry });
          pump();
        },
        cancel() {
          clearTimeout(timer);
          for (const item of queue) item.entry.dropped = true;
          queue.length = 0;
        },
      };
    }
    browser.on("message", (data, binary) => lanes.up.add(data, binary));
    peer.on("message", (data, binary) => lanes.down.add(data, binary));
    peer.on("open", () => lanes.up.pump());
    browser.on("close", (code) => {
      record.browserClose = code;
      record.closedAt ??= epoch();
      lanes.down.cancel();
      setTimeout(
        () => peer.readyState === WebSocket.OPEN && peer.close(1000),
        upDelayMs + 50,
      );
    });
    peer.on("close", (code) => {
      record.upstreamClose = code;
      record.closedAt ??= epoch();
      setTimeout(
        () =>
          browser.readyState === WebSocket.OPEN &&
          browser.close(
            code >= 1000 && code < 5000 && code !== 1005 && code !== 1006
              ? code
              : 1001,
          ),
        downDelayMs + 50,
      );
    });
    for (const s of [browser, peer]) s.on("error", () => {});
  }

  server.on("upgrade", (req, socket, head) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    if (
      req.socket.remoteAddress !== "127.0.0.1" ||
      !/^\/rooms\/[a-f0-9]{32}\?ruleset=front-v1$/.test(req.url ?? "")
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (browser) => connect(browser, req));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    endpoint: `http://127.0.0.1:${server.address().port}`,
    log,
    connections,
    async close() {
      for (const s of sockets) s.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
