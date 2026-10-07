import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

// 調査専用。製品src・既存テスト・勝敗条件には書き込まない。
const root = process.cwd();
const out = path.resolve("dist-validation/stage25-observation-20261007");
fs.mkdirSync(out, { recursive: true });
const journalPath = path.join(out, "execution-journal.json");
if (fs.existsSync(journalPath))
  throw new Error("実行済みjournalがあります。同条件を自動再試行しません。");
const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (source !== "1c2f4ba44348ab95558ca0362f4f50a561e900d0")
  throw new Error("計画した対象mainと異なります。");
const productDiff = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "src", "server", "tests", "package.json", "package-lock.json"], { encoding: "utf8" });
if (productDiff.trim()) throw new Error("対象製品/試験に未保存の変更があります。");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const copy = (v) => structuredClone(v);
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + "\n");
const plan = { source, node: process.version, platform: process.platform, atUtc: new Date().toISOString(), fullRuns: 2, maxTicksPerFullRun: 12001, dt: 0.05, stage: 25, seed: 814, worldName: "clear-25", optionalReplayRuns: 1, maxReplayTicks: 40, modelId: "未確認", reasoningEffort: "未確認" };
write("plan.json", plan);
const journal = { startedAtUtc: new Date().toISOString(), fullRunsStarted: 0, replayRunsStarted: 0, status: "building" };
const saveJournal = () => write("execution-journal.json", journal);
saveJournal();

const patches = [];
const observations = [
  ["game.ts", "hurtPlayer(w, target, q.damage)", "foundry-laser", "target", "q.damage", "false", "q"],
  ["game.ts", "hurtPlayer(w, p, def.damage, true)", "boss-burst", "p", "def.damage", "true", "e"],
  ["game.ts", "hurtPlayer(w, p, def.damage)", "crawler-melee", "p", "def.damage", "false", "e"],
  ["game.ts", "hurtPlayer(w, t, def.damage)", "normal-melee", "t", "def.damage", "false", "e"],
  ["game.ts", "hurtPlayer(w, p, q.damage)", "enemy-projectile", "p", "q.damage", "false", "q"],
  ["harrow.ts", "hurtPlayer(w, p, m.damage)", "harrow-missile", "p", "m.damage", "false", "m"],
  ["harrow.ts", "hurtPlayer(w, p, damage, true)", "harrow-area", "p", "damage", "true", "({ enemy: e, point, radius })"],
  ["calyx.ts", "hurtPlayer(w, p, damage)", "pollen", "p", "damage", "false", "clouds"],
  ["calyx.ts", "hurtPlayer(w, p, 24)", "calyx-melee", "p", "24", "false", "e"],
];
const plugin = {
  name: "stage25-read-only-observation",
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]shared[\\/](game|harrow|calyx)\.ts$/ }, ({ path: file }) => {
      const original = fs.readFileSync(file, "utf8");
      let text = original;
      const changes = [];
      for (const [module, call, kind, player, damage, heavy, detail] of observations) {
        if (path.basename(file) !== module) continue;
        if (text.split(call).length !== 2) throw new Error(`観測アンカーが一意でありません: ${module}/${call}`);
        const line = original.slice(0, original.indexOf(call)).split("\n").length;
        text = text.replace(call, `globalThis.__stage25Damage({ kind: ${JSON.stringify(kind)}, module: ${JSON.stringify(module)}, line: ${line}, detail: ${detail} }, w, ${player}, ${damage}, ${heavy}, () => ${call})`);
        changes.push({ call, kind, line });
      }
      if (path.basename(file) !== "harrow.ts") {
        const anchor = 'owner: "enemy",';
        if (text.split(anchor).length !== 2) throw new Error(`弾生成アンカーが一意でありません: ${file}`);
        text = text.replace(anchor, 'owner: (globalThis.__stage25Spawn(w, e), "enemy"),');
        changes.push({ call: anchor, kind: "projectile-origin" });
      }
      patches.push({ file: path.relative(root, file).replaceAll("\\", "/"), sourceSha256: sha(original), instrumentedSha256: sha(text), changes });
      return { contents: text, loader: "ts" };
    });
  },
};
const entry = `export * from "./src/shared/game.ts";
export { STARTERS, validWeapon, MOVE_SPEED, EVADE_DURATION } from "./src/shared/defs.ts";
export { mapFor, stageFor } from "./src/shared/stages.ts";
export { pilot } from "./tests/bot.ts";`;
async function runtime(name, observed) {
  const outfile = path.join(out, name + ".mjs");
  const result = await build({ stdin: { contents: entry, resolveDir: root, loader: "ts" }, outfile, bundle: true, platform: "node", format: "esm", sourcemap: "external", metafile: true, plugins: observed ? [plugin] : [] });
  write(name + "-inputs.json", Object.keys(result.metafile.inputs).filter(p => p !== "<stdin>").map(file => ({ file, sha256: sha(fs.readFileSync(file)) })));
  return import(pathToFileURL(outfile).href);
}
const normal = await runtime("normal-runtime", false);
const observed = await runtime("observed-runtime", true);
if (patches.reduce((n, p) => n + p.changes.length, 0) !== 11) throw new Error("観測箇所が11箇所と一致しません。");
write("instrumentation.json", patches);

const playerView = p => ({ id: p.id, x: p.x, y: p.y, z: p.z, hp: p.hp, evade: p.evade, evadeCd: p.evadeCd, safe: p.safe, yaw: p.yaw, pitch: p.pitch, ammo: p.ammo, slot: p.slot, reload: p.reload, cool: p.cool });
const enemyView = e => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, z: e.z, hp: e.hp, size: e.size, wind: e.wind, cool: e.cool, tx: e.tx, ty: e.ty, tz: e.tz, targetId: e.targetId, lunge: e.lunge, lungeWait: e.lungeWait, harrow: e.harrow });
let active = null;
let currentInput = null;
let currentTick = 0;
const origins = new Map();
globalThis.__stage25Spawn = (w, e) => {
  origins.set(w.serial, { projectileId: w.serial, time: w.time, enemy: copy(enemyView(e)) });
};
globalThis.__stage25Damage = (meta, w, p, damage, heavy, apply) => {
  const before = copy(playerView(p));
  const details = copy(meta);
  const input = copy(currentInput);
  const origin = origins.get(meta.detail?.id) ?? null;
  const enemies = copy(w.enemies.filter(e => e.hp > 0 && (e.kind === "harrow" || Math.hypot(e.x - p.x, e.z - p.z) < 25)).map(enemyView));
  const result = apply(); // 元のhurtPlayerを1回だけ呼ぶ。
  const after = copy(playerView(p));
  active.damage.push({ tick: currentTick, time: w.time, wave: w.wave, kills: w.totalKills, ...details, origin: copy(origin), input, baseDamage: damage, stageDamage: observed.stageFor(w).damage, heavy, before, after, applied: before.hp - after.hp, nearbyEnemies: enemies });
  return result;
};
function create(api) {
  const w = api.createWorld("clear-25", 814, 25);
  const gear = api.STARTERS.slice(0, 2).map(item => ({ ...item, power: 1.36, rarity: 3, effect: "pierce", rolls: { power: 1.25, mag: 1.25, reload: 0.8, range: 1.25, rate: 1.25 } }));
  if (!gear.every(api.validWeapon)) throw new Error("既存fixture装備が合法ではありません。");
  api.addPlayer(w, "p", gear);
  api.start(w);
  return { w, gear };
}
function run(api, instrumented, baseline) {
  if (++journal.fullRunsStarted > plan.fullRuns) throw new Error("全走行上限");
  journal.status = instrumented ? "observing" : "baseline";
  saveJournal();
  const { w, gear } = create(api);
  const data = { damage: [], frames: [], ring: [], inputs: [], worldHashes: [], invalidInputs: [] };
  active = data;
  origins.clear();
  const timeline = crypto.createHash("sha256");
  let mismatch = null;
  let n = 0;
  for (; n < plan.maxTicksPerFullRun && w.phase === "battle"; n++) {
    const input = api.pilot(w, "p");
    if (!api.validInput(input)) data.invalidInputs.push({ tick: n, input: copy(input) });
    if (instrumented) {
      data.ring.push({ tick: n, world: copy(w) });
      if (data.ring.length > 41) data.ring.shift();
    }
    currentInput = input;
    currentTick = n;
    data.inputs.push(copy(input));
    api.step(w, { p: input });
    const stateHash = sha(JSON.stringify(w));
    const inputHash = sha(JSON.stringify(input));
    data.worldHashes.push({ stateHash, inputHash });
    timeline.update(stateHash + inputHash);
    if (instrumented) {
      data.frames.push(copy({ tick: n, time: w.time, phase: w.phase, wave: w.wave, kills: w.totalKills, input, player: playerView(w.players[0]), enemies: w.enemies.filter(e => e.hp > 0).map(enemyView), projectiles: w.projectiles.filter(q => q.owner === "enemy"), missiles: w.harrowMissiles }));
      const reference = baseline.worldHashes[n];
      if (!reference || reference.stateHash !== stateHash || reference.inputHash !== inputHash) {
        mismatch = { tick: n, reference, actual: { stateHash, inputHash } };
        break;
      }
    }
  }
  const summary = { source, ticks: n, phase: w.phase, time: w.time, kills: w.totalKills, wave: w.wave, reason: w.reason, gear, player: copy(w.players[0]), liveEnemies: copy(w.enemies.filter(e => e.hp > 0)), timelineSha256: timeline.digest("hex"), invalidInputs: data.invalidInputs, mismatch };
  return { data, summary };
}
try {
  const baseline = run(normal, false);
  write("baseline.json", baseline.summary);
  const traced = run(observed, true, baseline.data);
  write("observation.json", { ...traced.summary, damage: traced.data.damage });
  fs.writeFileSync(path.join(out, "trace.jsonl.gz"), gzipSync(traced.data.frames.map(f => JSON.stringify(f)).join("\n") + "\n"));
  write("final-window.json", { checkpoints: traced.data.ring, inputs: traced.data.inputs.slice(traced.data.ring[0]?.tick ?? 0), origins: [...origins] });
  const same = !traced.summary.mismatch && baseline.summary.ticks === traced.summary.ticks && baseline.summary.timelineSha256 === traced.summary.timelineSha256;
  write("comparison.json", { sameEveryTickAndInput: same, ticks: baseline.summary.ticks, baseline: baseline.summary.timelineSha256, observed: traced.summary.timelineSha256, previousFailureMatch: traced.summary.phase === "defeat" && Math.abs(traced.summary.time - 128.15) < 1e-7 && traced.summary.kills === 78 });
  journal.status = same ? "observed-awaiting-analysis" : "observation-diverged-stop";
  saveJournal();
  console.log(JSON.stringify({ source, sameEveryTickAndInput: same, phase: traced.summary.phase, time: traced.summary.time, kills: traced.summary.kills, damageAttempts: traced.data.damage.length, appliedHits: traced.data.damage.filter(d => d.applied > 0).length, invalidInputTicks: traced.data.invalidInputs.length }));
} catch (error) {
  journal.status = "error-stop";
  journal.error = String(error.stack ?? error);
  saveJournal();
  throw error;
} finally {
  delete globalThis.__stage25Spawn;
  delete globalThis.__stage25Damage;
}
