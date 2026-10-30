import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const out = "dist-validation/coop-comfort-20261030/world-bound";
const target = path.resolve(out, "bound-runtime.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: `
export {denseWireFixture} from './scripts/state-wire-fixture';
export {prepareState} from './src/shared/state-wire';
export {encodeStateChunks} from './src/shared/state-chunks';
export {restoreStateTuples} from './src/shared/state-tuples';
export {createPleat} from './src/shared/pleat-locomotion';
export {getFrontRunView} from './src/shared/front-run';
export {createWorld,addPlayer,spawn,finish} from './src/shared/game';
export {makeWeapon} from './src/shared/progression';
export {finalizeFrontSurvivalRewards} from './src/shared/front-survival';
export {STAGES} from './src/shared/stages';
`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: target,
  logLevel: "silent",
});
const {
  denseWireFixture,
  prepareState,
  encodeStateChunks,
  restoreStateTuples,
  createPleat,
  createWorld,
  addPlayer,
  spawn,
  finish,
  finalizeFrontSurvivalRewards,
  makeWeapon,
  STAGES,
} = await import(pathToFileURL(target));
const bytes = (v) =>
  Buffer.byteLength(typeof v === "string" ? v : JSON.stringify(v));
const results = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  method:
    "Readonly product; independent count/field envelopes, not jointly reachable gameplay states",
  stageBastionCounts: STAGES.map((s) => ({
    stage: s.id,
    total: s.waves.reduce((n, w) => n + (w.troops.bastion ?? 0), 0),
    worms: s.waves.reduce(
      (n, w) => n + w.bosses.filter((b) => b === "worm").length,
      0,
    ),
  })),
  scenarios: [],
};
const ids = Array.from({ length: 4 }, (_, i) => String(i).repeat(32));
const weapon = (id, kind = "grenade") => ({
  ...makeWeapon(
    id.padEnd(100, "x"),
    kind,
    4,
    { power: 20, reload: 20, range: 20, rate: 20 },
    false,
    0,
  ),
  level: 60,
  mods: { damage: 10, speed: 0, mag: 5 },
});
function longPlayers(w) {
  for (const [i, p] of w.players.entries()) {
    p.weapons = [weapon(`first${i}`), weapon(`second${i}`, "heavy")];
    p.ack = Number.MAX_SAFE_INTEGER;
    p.yaw = 3.14;
    p.pitch = 0.78;
    p.x = -123.45;
    p.z = 123.45;
    p.hp = 216;
  }
}
function pleatEnemy(w, i) {
  const e = spawn(w, "crawler", 0, 0);
  if (!e) throw Error("enemy cap");
  Object.assign(e, {
    x: -123.45,
    y: 12.34,
    z: 123.45,
    tx: 123.45,
    ty: 12.34,
    tz: -123.45,
    heading: 3.14,
    targetId: ids[i % 4],
    active: true,
    hp: 12345.67,
    maxHp: 12345.67,
    cool: 1.23,
    wind: 1.23,
    hurt: 0.12,
  });
  e.pleat = createPleat(
    { x: e.x, y: e.y, z: e.z },
    { x: 0.57735, y: 0.57735, z: 0.57735 },
    1.75,
    { ray: () => undefined },
  );
  for (const f of e.pleat.feet) {
    f.point = { x: -126.78, y: 12.34, z: 126.78 };
    f.normal = { x: 0.57735, y: 0.57735, z: 0.57735 };
  }
  for (const k of ["up", "forward", "poseForward"])
    e.pleat[k] = { x: 0.57735, y: 0.57735, z: 0.57735 };
  return e;
}
function rounds(w, n) {
  w.projectiles = Array.from({ length: n }, (_, i) => ({
    id: 90000 + i,
    x: -123.45,
    y: 123.45,
    z: -123.45,
    dx: -123.45,
    dy: 123.45,
    dz: -123.45,
    life: 10.58,
    owner: ids[i % 4],
    damage: 12345.67,
    rocket: true,
    chain: true,
    gravity: 14,
    radius: 11,
    family: "grenade",
    frontShot: 20000 + i,
    frontSlot: 1,
  }));
}
function additions(w, withFront) {
  w.harrowMissiles = Array.from({ length: 40 }, (_, i) => ({
    id: 30000 + i,
    owner: 90000,
    origin: { x: -123.45, y: 123.45, z: -123.45 },
    target: { x: 123.45, y: 12.34, z: 123.45 },
    launch: 3599.55,
    impact: 3601.35,
    damage: 123.45,
    radius: 2.5,
    trajectory: "straight",
    lastChecked: 3599.45,
  }));
  w.pollen = Array.from({ length: 16 }, (_, i) => ({
    id: 40000 + i,
    x: -123.45,
    y: 12.34,
    z: 123.45,
    born: 3599.55,
    damage: 12.34,
  }));
  if (withFront) {
    w.front.orbs = Array.from({ length: 160 }, (_, i) => ({
      id: 50000 + i,
      x: -123.45,
      y: 12.34,
      z: 123.45,
      value: 12345,
    }));
    w.front.mines = ids.flatMap((owner) =>
      Array.from({ length: 8 }, (_, i) => ({
        id: 60000 + i,
        owner,
        x: -123.45,
        y: 12.34,
        z: 123.45,
        expires: 3689.55,
      })),
    );
    const p = w.front.players[ids[0]];
    p.statuses = Object.fromEntries(
      w.enemies.map((e) => [
        e.id,
        { marked: true, hits: 100000, lastShot: 100000 },
      ]),
    );
  }
}
function metadata(w) {
  return {
    members: ids.map((id) => ({
      id,
      name: "🧑".repeat(20),
      ready: true,
      connected: true,
      ...(w.phase !== "battle"
        ? { weapons: w.players.find((p) => p.id === id).weapons }
        : {}),
    })),
    stage: 20,
    clearedStage: 20,
    preparationGeneration: 100000,
    ruleset: "front-v1",
    mode: "survival",
  };
}
function measure(label, classification, w, recipient) {
  const p = prepareState(w, 0, metadata(w));
  for (const equipmentCached of [false, true]) {
    const text = p.packet(
      ids[0],
      equipmentCached,
      Number.MAX_SAFE_INTEGER,
      recipient,
      true,
      true,
      true,
    );
    const obj = JSON.parse(text);
    let numericWidthEnvelope = bytes(text),
      numbers = 0,
      nodes = 0;
    JSON.stringify(obj, (_k, v) => {
      nodes++;
      if (typeof v === "number") {
        numbers++;
        numericWidthEnvelope += 25 - String(v).length;
      }
      return v;
    });
    const chunks = encodeStateChunks(text, 1);
    results.scenarios.push({
      label,
      classification,
      equipmentCached,
      bytes: bytes(text),
      numericTokenStress25: numericWidthEnvelope,
      numericWidthHypothesis16: numericWidthEnvelope - 9 * numbers,
      numbers,
      rawJsonNodes: nodes,
      enemies: w.enemies.length,
      projectiles: w.projectiles.length,
      segments: w.enemies.reduce((n, e) => n + (e.segments?.length ?? 0), 0),
      omitted: obj.omitted ?? null,
      chunks: chunks?.length ?? null,
      chunkMax: chunks ? Math.max(...chunks.map(bytes)) : null,
      tupleRestore: restoreStateTuples(structuredClone(obj)),
      worldFields: Object.fromEntries(
        Object.entries(obj.world)
          .map(([k, v]) => [k, bytes(JSON.stringify(v))])
          .sort((a, b) => b[1] - a[1]),
      ),
      metadataBytes: bytes({ ...obj, world: undefined }),
    });
  }
}
const { w } = denseWireFixture(328);
w.enemies = [];
w.events = [];
w.players.forEach((p, i) => (p.id = ids[i]));
w.front.players = Object.fromEntries(
  Object.values(w.front.players).map((p, i) => [ids[i], p]),
);
for (let i = 0; i < 97; i++) pleatEnemy(w, i);
longPlayers(w);
rounds(w, 328);
additions(w, true);
const frontView = {
  phase: "combat",
  clearedStage: 20,
  weaponLevel: 21,
  rewardCount: 30,
  rewardEligible: true,
  maxPicks: 120,
  growthVersion: 3,
  returnAt: null,
  mode: "survival",
  day: "2026-10-30",
  combatTime: 3599.55,
  xp: 100000,
  nextXpThreshold: 100000,
  picks: 120,
  levels: { ...w.front.players[ids[0]].levels },
  evolved: ["explosion", "piercing", "interception"],
  maxHp: 216,
  maxChain: 100000,
  rightsPending: 0,
  rerollsRemaining: 0,
  canReroll: false,
  selectionDeadline: null,
  resumeUntil: 1793329183.22,
  bossId: 99999,
  spawnWarnings: Array.from({ length: 9 }, (_, i) => ({
    x: -123.45,
    z: 123.45,
    at: 3599.55 + i,
    radius: 2,
  })),
  offer: null,
};
measure(
  "survival-independent-count-envelope",
  "97 PLEAT +328 rounds +160 orbs +32 mines +40 HARROW missiles +16 pollen; several components cannot co-occur in survival",
  w,
  { frontView, serverNow: 1793329183.22, expiresAt: 1793332783.22 },
);
const c = createWorld("r".repeat(32), 123, 20);
c.phase = "battle";
c.campaignPlan = STAGES[19];
ids.forEach((id) => addPlayer(c, id));
for (let i = 0; i < 38; i++) pleatEnemy(c, i);
spawn(c, "boss", 0, 0, "worm");
spawn(c, "boss", 0, 0, "harrow");
longPlayers(c);
rounds(c, 315);
additions(c, false);
c.foundrySpawns = Array.from({ length: 3 }, (_, i) => ({
  source: 1000 + i,
  time: 3599.55,
  x: -90.12,
  z: 100.12,
  parts: [1, 2, 3, 4, 5, 6, 7],
  kinds: Array(7).fill("crawler"),
}));
c.drops = Array.from({ length: 3 }, (_, i) => ({
  id: "drop" + i,
  x: -90.12,
  z: 100.12,
  owner: ids[0],
  weapon: weapon("dropweapon" + i),
}));
c.events = [];
c.pending[ids[0]] = Array.from({ length: 3 }, (_, i) => weapon("pending" + i));
c.rewards[ids[0]] = Array.from({ length: 3 }, (_, i) => weapon("reward" + i));
measure(
  "campaign-independent-count-envelope",
  "40 enemies including 1 WORM/1 HARROW,315 rounds,40 missiles,16 pollen; component bounds, not one legal joint state",
  c,
);
const terminal = structuredClone(w);
terminal.time = 3600;
terminal.players.forEach((p) => (p.kills = 1000));
finish(terminal, false, "部隊が全滅しました");
finalizeFrontSurvivalRewards(terminal, 20, ids);
measure(
  "survival-terminal-rewards-envelope",
  "Actual finish + reward generator applied to component envelope; 30 private reward weapons, no duplicated other-recipient rewards",
  terminal,
  {
    frontView: { ...frontView, phase: "defeat", combatTime: 3600 },
    serverNow: 1793332783.22,
  },
);
const stress = structuredClone(w);
const worm = c.enemies.find((e) => e.segments);
stress.enemies = Array.from({ length: 512 }, (_, i) => ({
  ...structuredClone(worm),
  id: 100000 + i,
}));
for (const e of stress.enemies) {
  Object.assign(e, {
    x: -123.45,
    y: 12.34,
    z: 123.45,
    heading: 3.14,
    acidAt: 3599.55,
    pulseAim: { x: 123.45, y: 12.34, z: -123.45 },
  });
  for (const n of e.segments)
    Object.assign(n, {
      x: -123.45,
      y: 12.34,
      z: 123.45,
      partHp: 12345.67,
      heading: 3.14,
      acidAt: 3599.55,
      pulseAim: { x: 123.45, y: 12.34, z: -123.45 },
    });
}
measure(
  "decoder-only-512-worm-stress",
  "Outside legal spawn/roster; format-level synthetic stress only",
  stress,
  { frontView, serverNow: 1793329183.22 },
);
fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    results.scenarios.map(({ worldFields, ...r }) => r),
    null,
    2,
  ),
);
