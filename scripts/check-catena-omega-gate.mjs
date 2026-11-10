// Local Worker: old browser capability never receives a 14-body state.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8797";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const sockets = [];
const wait = async (fn, label) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const value = fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw Error(`待機期限: ${label}`);
};
const room = async () => {
  const response = await fetch(base + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  return (await response.json()).code;
};
function connect(code, version, token) {
  const peer = {
    version,
    token,
    id: undefined,
    lobby: undefined,
    states: [],
    notices: [],
    errors: [],
    closeCode: undefined,
  };
  peer.ws = new WebSocket(base.replace("http", "ws") + "/rooms/" + code);
  peer.ws.onopen = () =>
    peer.ws.send(
      JSON.stringify({
        type: "hello",
        stateTuples: version,
        ...(token ? { token } : {}),
      }),
    );
  peer.ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "welcome") {
      peer.id = message.id;
      peer.token = message.token;
    }
    if (message.type === "lobby") peer.lobby = message;
    if (message.type === "state") peer.states.push(message);
    if (message.type === "notice") peer.notices.push(message.reason);
    if (message.type === "error") peer.errors.push(message.reason);
  };
  peer.ws.onclose = (event) => (peer.closeCode = event.code);
  sockets.push(peer.ws);
  return peer;
}
const equip = ["rifle", "shotgun"].map((kind) => ({
  id: `starter-${kind}`,
  kind,
  rarity: 0,
  power: 1,
  effect: "none",
}));
try {
  const code = await room();
  const old = connect(code, 1);
  await wait(() => old.id, "旧v1入室");
  const modern = connect(code, 2);
  await wait(() => modern.id, "新v2入室");
  const fixture = await fetch(`${base}/fixtures/${code}/catena-omega`, {
    method: "POST",
  });
  assert.equal(fixture.status, 200, await fixture.text());
  await wait(() => old.closeCode, "旧v1更新案内");
  assert.equal(old.closeCode, 4000);
  assert.ok(old.notices.some((reason) => reason.includes("再読み込み")));
  assert.ok(
    old.states.every((packet) =>
      packet.world.enemies.every((enemy) => enemy.segments?.length !== 14),
    ),
  );
  await wait(
    () =>
      modern.states.some(
        (packet) =>
          packet.stateEncoding === "tuples-v2" &&
          packet.world.enemies[0]?.at(-1)?.ground?.length === 15,
      ),
    "新v2のΩ飛行",
  );
  const oldAgain = connect(code, 1, old.token);
  await wait(() => oldAgain.closeCode, "旧v1再接続更新案内");
  assert.equal(oldAgain.closeCode, 4000);
  assert.equal(oldAgain.id, undefined);
  assert.equal(oldAgain.states.length, 0);
  assert.ok(oldAgain.notices.some((reason) => reason.includes("再読み込み")));
  const modernAgain = connect(code, 2, modern.token);
  await wait(() => modernAgain.id && modernAgain.states.length, "新v2再接続");
  assert.equal(modernAgain.id, modern.id);

  const compatible = await room();
  const oldCompatible = connect(compatible, 1);
  await wait(() => oldCompatible.id, "互換Room入室");
  const safeFixture = await fetch(`${base}/fixtures/${compatible}/bastion`, {
    method: "POST",
  });
  assert.equal(safeFixture.status, 200, await safeFixture.text());
  await wait(
    () => oldCompatible.states.some((packet) => packet.world.enemies.length),
    "互換Room戦闘state",
  );
  assert.equal(oldCompatible.states.at(-1).stateEncoding, "tuples-v1");
  assert.equal(oldCompatible.closeCode, undefined);
  assert.equal(oldCompatible.notices.length, 0);

  const stageCode = await room();
  const oldStage = connect(stageCode, 1);
  await wait(() => oldStage.id, "旧v1出撃Room入室");
  const newStage = connect(stageCode, 2);
  await wait(() => newStage.id, "新v2出撃Room入室");
  for (const peer of [oldStage, newStage])
    peer.ws.send(JSON.stringify({ type: "equip", weapons: equip }));
  await wait(
    () => newStage.lobby?.members.every((m) => m.weapons.length === 2),
    "装備",
  );
  oldStage.ws.send(JSON.stringify({ type: "stage", stage: 6 }));
  await wait(
    () => oldStage.lobby?.stage === 6 && newStage.lobby?.stage === 6,
    "stage6",
  );
  for (const peer of [oldStage, newStage])
    peer.ws.send(
      JSON.stringify({
        type: "ready",
        ready: true,
        stage: 6,
        preparationGeneration: peer.lobby.preparationGeneration,
      }),
    );
  await wait(
    () => oldStage.lobby?.members.every((m) => m.ready),
    "全員準備完了",
  );
  oldStage.ws.send(JSON.stringify({ type: "start", stage: 6 }));
  await wait(() => oldStage.notices.length, "旧v1の出撃拒否");
  assert.equal(oldStage.states.length, 0);
  assert.equal(newStage.states.length, 0);
  assert.ok(oldStage.notices.at(-1).includes("再読み込み"));
  assert.ok(
    [
      old,
      modern,
      oldAgain,
      modernAgain,
      oldCompatible,
      oldStage,
      newStage,
    ].every((p) => p.errors.length === 0),
  );
  const result = {
    pass: true,
    oldClosedBefore14State: true,
    oldReconnectNotice: true,
    newReconnectSameId: true,
    compatibleOldV1Battle: true,
    wormStageStartBlocked: true,
  };
  writeFileSync(
    "dist-validation/catena-omega/network-gate.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  for (const socket of sockets) socket.close();
}
