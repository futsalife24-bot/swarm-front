import { createServer } from "vite";
import fs from "node:fs";
import assert from "node:assert/strict";
const vite = await createServer({ server: { middlewareMode: true } });
const g = await vite.ssrLoadModule("/src/shared/game.ts");
const { STARTERS } = await vite.ssrLoadModule("/src/shared/defs.ts");
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
const clients = [];
const wait = async (predicate, label) => {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const result = predicate();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error("Timeout: " + label);
};
try {
  assert.ok(key);
  const response = await fetch("http://127.0.0.1:8797/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  const { code } = await response.json();
  for (let index = 0; index < 2; index++) {
    const c = {
      ws: new WebSocket("ws://127.0.0.1:8797/rooms/" + code),
      states: [],
      id: null,
      lobby: null,
      errors: [],
    };
    clients.push(c);
    c.ws.onopen = () => c.ws.send(JSON.stringify({ type: "hello" }));
    c.ws.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.type === "welcome") {
        c.id = m.id;
        c.ws.send(
          JSON.stringify({ type: "equip", weapons: STARTERS.slice(0, 2) }),
        );
      }
      if (m.type === "lobby") {
        c.lobby = m;
        if (!m.members.find((p) => p.id === c.id)?.ready)
          c.ws.send(
            JSON.stringify({
              type: "ready",
              ready: true,
              stage: m.stage,
              preparationGeneration: m.preparationGeneration,
            }),
          );
      }
      if (m.type === "state") c.states.push(m.world);
      if (m.type === "error") c.errors.push(m.message ?? m.reason);
    };
    await wait(() => c.id, "join");
  }
  const sender = clients[0];
  sender.ws.send(JSON.stringify({ type: "stage", stage: 3 }));
  await wait(
    () =>
      clients.every(
        (c) =>
          c.lobby?.stage === 3 &&
          c.lobby.members.length === 2 &&
          c.lobby.members.every((p) => p.ready),
      ),
    "readiness",
  );
  sender.ws.send(JSON.stringify({ type: "start" }));
  await wait(() => sender.states.length, "battle");
  sender.ws.send(
    JSON.stringify({
      type: "input",
      input: { ...g.neutral(), jump: true, seq: 1 },
    }),
  );
  sender.ws.send(
    JSON.stringify({ type: "input", input: { ...g.neutral(), seq: 2 } }),
  );
  const lifted = await wait(
    () =>
      sender.states.find(
        (w) => w.players.find((p) => p.id === sender.id).y > 0.5,
      ),
    "queued jump",
  );
  const peer = await wait(
    () => clients[1].states.find((w) => w.time === lifted.time),
    "same peer snapshot",
  );
  assert.deepEqual(peer.players, lifted.players);
  await wait(
    () =>
      sender.states.find(
        (w) =>
          w.time > lifted.time + 0.5 &&
          w.players.find((p) => p.id === sender.id).y === 0,
      ),
    "landing",
  );
  assert.ok(clients.every((c) => c.errors.length === 0));
  fs.writeFileSync(
    "dist-validation/jump-maps/network.json",
    JSON.stringify(
      {
        pass: true,
        realWorker: true,
        clients: 2,
        stage: 3,
        queuedJumpSurvivesNeutralPacket: true,
        peerMatches: true,
        landed: true,
        feet: lifted.players.find((p) => p.id === sender.id).y,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: two real Worker clients, queued jump, matching altitude, landing",
  );
} finally {
  for (const c of clients) c.ws.close();
  await vite.close();
}
