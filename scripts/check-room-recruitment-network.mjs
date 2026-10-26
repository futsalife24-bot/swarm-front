// 隔離ローカルWorkerへ実接続する。本人のセーブ・公開サーバーは使わない。
import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8788";
assert.equal(new URL(base).hostname, "127.0.0.1");
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key, "既存のローカル試験キーが必要です");
const sockets = [];
const front = !process.argv.includes("--campaign");
const query = front ? "?ruleset=front-v1" : "";
const record = { operation: front ? "生存" : "進撃", checks: [], rooms: [] };
async function connect(code) {
  const ws = new WebSocket(
    `${base.replace("http", "ws")}/rooms/${code}${query}`,
  );
  sockets.push(ws);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("入室応答なし")), 7000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "hello",
          ...(front
            ? { frontGrowth: 3, frontCatalog: 2, frontOpening: 2 }
            : {}),
        }),
      );
    ws.onmessage = (event) => {
      const m = JSON.parse(String(event.data));
      if (m.type === "error") {
        clearTimeout(timeout);
        reject(Error(m.reason));
      }
      if (m.type === "welcome") {
        clearTimeout(timeout);
        resolve(m);
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(Error("WebSocket接続失敗"));
    };
  });
}
try {
  for (const listed of [false, true]) {
    const response = await fetch(`${base}/rooms`, {
      method: "POST",
      headers: { "X-Room-Creation-Key": key },
      body: JSON.stringify({
        name: listed ? "検証フリー部隊" : "検証招待部隊",
        listed,
        ...(front ? { ruleset: "front-v1", mode: "survival" } : {}),
      }),
    });
    assert.equal(response.status, 200);
    const entry = await response.json();
    const host = await connect(entry.code);
    assert.equal(host.roomId, entry.roomId);
    const resolved = await fetch(`${base}/rooms/${entry.roomId}${query}`);
    assert.equal(resolved.status, 200);
    const { code } = await resolved.json();
    assert.equal(code, entry.code);
    await connect(code);
    record.rooms.push({ listed, roomId: entry.roomId });
    record.checks.push(
      listed
        ? "フリー作成・8文字解決・実2接続"
        : "招待作成・8文字解決・実2接続",
    );
  }
  // ディレクトリ更新はRoomから非同期で届くため、上限付きで待つ。
  let rooms = [];
  for (let i = 0; i < 30; i++) {
    rooms = (await (await fetch(`${base}/rooms${query}`)).json()).rooms;
    if (
      rooms.some((r) => r.roomId === record.rooms[1].roomId && r.players === 2)
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(!rooms.some((r) => r.roomId === record.rooms[0].roomId));
  assert(
    rooms.some((r) => r.roomId === record.rooms[1].roomId && r.players === 2),
  );
  assert(rooms.every((r) => !Object.hasOwn(r, "code")));
  record.checks.push(
    "非公開部屋は一覧に出ない",
    "公開部屋は2人で一覧に出る",
    "内部コードは一覧に出ない",
  );
  const other = await fetch(
    `${base}/rooms/${record.rooms[0].roomId}${front ? "" : "?ruleset=front-v1"}`,
  );
  assert.equal(other.status, 404);
  record.checks.push("進撃・生存のルール分離を維持");
  fs.mkdirSync("dist-validation/coop-recruitment", { recursive: true });
  fs.writeFileSync(
    `dist-validation/coop-recruitment/network-${front ? "survival" : "campaign"}.json`,
    JSON.stringify(record, null, 2),
  );
  console.log(`${record.checks.length}条件成功（実Worker・実WebSocket）`);
  if (process.argv.includes("--hold")) {
    console.log("画面検証用に合成部隊の接続を維持します");
    const timer = setInterval(
      () =>
        sockets.forEach((ws) => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
        }),
      5000,
    );
    await new Promise((resolve) => setTimeout(resolve, 20 * 60 * 1000));
    clearInterval(timer);
  }
} finally {
  for (const ws of sockets) ws.close();
}
