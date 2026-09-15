import { it, expect, vi } from "vitest";
import {
  loadNetworkSession,
  NETWORK_SESSION_KEY,
  Network,
} from "../src/client/network";
import { randomBytes } from "node:crypto";
import { creationAccess, turnstileAccess } from "../server/auth";
import { troopCount, stageFor } from "../src/shared/stages";
import { WAVE_INTERVAL } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  start,
  step,
  spawn,
  loot,
  neutral,
} from "../src/shared/game";
function fixture() {
  const w = createWorld("p1", 53),
    p = addPlayer(w, "p"),
    ally = addPlayer(w, "ally");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  return { w, p, ally };
}
it("accepts only a versioned same-tab reconnect session", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
  };
  const valid = {
    version: 1,
    endpoint: "https://play.example/api",
    code: "a".repeat(32),
    token: "b".repeat(32),
  };
  values.set(NETWORK_SESSION_KEY, JSON.stringify(valid));
  expect(loadNetworkSession(storage)).toEqual(valid);
  values.set(
    NETWORK_SESSION_KEY,
    JSON.stringify({ ...valid, token: "visible-or-invalid" }),
  );
  expect(loadNetworkSession(storage)).toBeNull();
  expect(values.has(NETWORK_SESSION_KEY)).toBe(false);
});
it("disconnected combat state and individual pickups freeze for ten seconds", () => {
  const { w, p } = fixture();
  Object.assign(p, {
    connected: false,
    hp: 50,
    safe: 8,
    cool: 0.8,
    reload: 1,
    evade: 0.2,
    evadeCd: 2,
    swapCd: 0.3,
    ammo: [1, 1],
  });
  const before = structuredClone(p),
    weapon = loot(w);
  w.drops.push({ id: weapon.id, x: p.x, z: p.z, owner: p.id, weapon });
  const input = {
    ...neutral(),
    mx: 1,
    mz: 1,
    fire: true,
    reload: true,
    dodge: true,
    swap: true,
  };
  for (let n = 0; n < 200; n++) step(w, { p: input });
  expect(p).toEqual(before);
  expect(w.drops).toHaveLength(1);
  expect(w.pending.p).toEqual([]);
  p.connected = true;
  step(w, {});
  expect(p.cool).toBeCloseTo(0.75);
  expect(p.reload).toBeCloseTo(0.95);
  expect(w.pending.p).toHaveLength(1);
});
it("connected squad wipe defeats even with a disconnected living member", () => {
  const { w, p, ally } = fixture();
  p.connected = false;
  ally.hp = 0;
  step(w, {});
  expect(w.phase).toBe("defeat");
});
it("all disconnected pauses the complete world, including downed players", () => {
  const { w, p, ally } = fixture();
  p.connected = false;
  ally.connected = false;
  p.hp = 0;
  p.down = 20;
  const before = structuredClone(w);
  for (let n = 0; n < 200; n++) step(w, {});
  expect(w).toEqual(before);
  expect(w.phase).toBe("battle");
});
it("quota and no living enemies are required, then a four second interval advances once", () => {
  const { w, p } = fixture();
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(1);
  expect(w.waveClearAt).toBeNull();
  w.spawned = troopCount(stageFor(w).waves[0]);
  spawn(w, "crawler", 0, -50);
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(1);
  expect(w.waveClearAt).toBeNull();
  w.enemies[0].hp = 0;
  p.hp = 50;
  p.safe = -100; // isolate wave healing from the separate passive regeneration rule
  const ended = w.time;
  for (let n = 0; n < 79; n++) step(w, {});
  expect(w.wave).toBe(1);
  expect(p.hp).toBe(50);
  for (let n = 0; n < 5; n++) step(w, {});
  expect(w.wave).toBe(2);
  expect(p.hp).toBe(95);
  expect(w.time - ended).toBeLessThanOrEqual(5);
  expect(WAVE_INTERVAL).toBeGreaterThanOrEqual(3);
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(2);
  expect(p.hp).toBe(95);
});
it("cleared opening of stage 4 spawns a boss with escorts and heals only once", () => {
  const { w, p } = fixture();
  w.stage = 4;
  w.wave = 1;
  w.spawned = troopCount(stageFor(w).waves[0]);
  p.hp = 50;
  p.safe = -100;
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(2);
  expect(w.enemies.filter((e) => e.kind === "boss")).toHaveLength(1);
  expect(p.hp).toBe(95);
  for (let n = 0; n < 40; n++) step(w, {});
  expect(w.enemies.filter((e) => e.kind === "boss")).toHaveLength(1);
  expect(p.hp).toBe(95);
});
it("creation credentials fail closed when unset, empty, wrong or oversized", async () => {
  const key = randomBytes(32).toString("hex");
  expect(await creationAccess(undefined, key)).toBe(503);
  expect(await creationAccess("", key)).toBe(503);
  expect(await creationAccess(key, null)).toBe(401);
  expect(await creationAccess(key, "wrong")).toBe(401);
  expect(await creationAccess(key, "x".repeat(257))).toBe(401);
  expect(await creationAccess(key, key)).toBe(200);
});
it("Turnstile room admission fails closed and validates only a successful response", async () => {
  const request = vi.fn(async () => Response.json({ success: true }));
  expect(await turnstileAccess(undefined, "proof", null, request)).toBe(503);
  expect(await turnstileAccess("x".repeat(20), null, null, request)).toBe(401);
  expect(request).not.toHaveBeenCalled();
  expect(
    await turnstileAccess("x".repeat(20), "proof", "127.0.0.1", request),
  ).toBe(200);
  const [, options] = request.mock.calls[0];
  expect(String(options.body)).toContain("response=proof");
  expect(
    await turnstileAccess("x".repeat(20), "proof", null, async () =>
      Response.json({ success: false }),
    ),
  ).toBe(401);
});
it("ignores malformed JSON and invalid message types without invoking UI callbacks", () => {
  class Socket {
    readyState = 1;
    onmessage: ((e: { data: string }) => void) | undefined;
    send() {}
    close() {}
  }
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const network = new Network("http://127.0.0.1:8787");
  try {
    network.onWorld = vi.fn();
    network.onLobby = vi.fn();
    network.ready = vi.fn();
    network.onStatus = vi.fn();
    network.connect("a".repeat(32));
    const socket = network.ws as unknown as Socket;
    for (const data of [
      "{",
      "null",
      "[]",
      '{"type":3}',
      '{"type":"welcome"}',
      '{"type":"state","members":[]}',
      '{"type":"lobby","members":[null]}',
      '{"type":"lobby","members":[],"preparationGeneration":-1}',
      '{"type":"lobby","members":[]}',
      '{"type":"error","reason":7}',
    ]) {
      expect(() => socket.onmessage!({ data })).not.toThrow();
    }
    expect(network.onWorld).not.toHaveBeenCalled();
    expect(network.ready).not.toHaveBeenCalled();
    expect(network.onLobby).not.toHaveBeenCalled();
    expect(network.onStatus).not.toHaveBeenCalled();
    socket.onmessage!({
      data: JSON.stringify({
        type: "lobby",
        preparationGeneration: 1,
        members: [{ id: "p", ready: true, connected: true }],
      }),
    });
    expect(network.onLobby).toHaveBeenCalledOnce();
  } finally {
    clearInterval(network.timer);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("reward replacement protects LR rewards and equipped weapons and frees only the selected family", async () => {
  const { fresh } = await import("../src/client/save");
  const { replaceForRewards, canReplace, weaponDetails } =
    await import("../src/client/reward-choice");
  const save = fresh();
  const shotgun = save.inventory.find((w) => w.kind === "shotgun")!;
  for (let i = 1; i < 8; i++)
    save.inventory.push({
      ...shotgun,
      id: `held-${i}`,
      rarity: i === 1 ? 3 : 0,
    });
  const lr = { ...shotgun, id: "reward-lr", rarity: 3 };
  const original = structuredClone(save);
  expect(canReplace(save, [lr], [lr], save.equipped[0])).toBe(false);
  expect(canReplace(save, [lr], [lr], "reward-lr")).toBe(false);
  const rifle = save.inventory.find((w) => w.kind === "rifle")!;
  expect(canReplace(save, [lr], [lr], rifle.id)).toBe(false);
  expect(() => replaceForRewards(save, "run", [lr], rifle.id)).toThrow();
  const next = replaceForRewards(save, "run", [lr], "held-2");
  expect(next.inventory.some((w) => w.id === "held-2")).toBe(false);
  expect(next.inventory.some((w) => w.id === "held-1" && w.rarity === 3)).toBe(
    true,
  );
  expect(
    next.inventory.some((w) => w.id === "reward-lr" && w.rarity === 3),
  ).toBe(true);
  expect(next.receipts).toContain("run");
  expect(save).toEqual(original);
  expect(weaponDetails(lr)).toContain("LR");
  for (const label of ["威力", "装弾", "装填", "射程", "連射"])
    expect(weaponDetails(lr)).toContain(label);
});
