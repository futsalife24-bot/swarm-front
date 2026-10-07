import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

// 完了済み観測から末尾2秒だけを1回分岐。勝利までの探索はしない。
const out = path.resolve("dist-validation/stage25-observation-20261007");
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + "\n");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const journal = read("execution-journal.json");
const comparison = read("comparison.json");
if (journal.status !== "observed-awaiting-analysis" || journal.fullRunsStarted !== 2 || journal.replayRunsStarted !== 0 || !comparison.sameEveryTickAndInput || !comparison.previousFailureMatch)
  throw new Error("観測一致・初回分岐の前提を満たしません。");
for (const source of read("observed-runtime-inputs.json"))
  if (sha(fs.readFileSync(source.file)) !== source.sha256)
    throw new Error(`観測後に対象ソースが変更されています: ${source.file}`);
const api = await import(pathToFileURL(path.join(out, "observed-runtime.mjs")).href);
const saved = read("final-window.json");
const reference = read("observation.json");
const lethal = reference.damage.findLast(d => d.applied > 0 && d.after.hp === 0);
if (lethal?.kind !== "harrow-area" || lethal.detail.enemy.harrow?.kind !== "Spin")
  throw new Error("観測した致死原因がSpinではありません。");
const startTick = reference.ticks - 40;
const checkpoint = saved.checkpoints.find(c => c.tick === startTick);
if (!checkpoint) throw new Error("40tick前の実checkpointがありません。");
const w = structuredClone(checkpoint.world);
const frames = [];
const damage = [];
const changes = [];
let tick = startTick;
let input;
let sentDodge = false;
const view = p => ({ x: p.x, y: p.y, z: p.z, hp: p.hp, evade: p.evade, evadeCd: p.evadeCd });
globalThis.__stage25Spawn = () => {};
globalThis.__stage25Damage = (meta, world, player, amount, heavy, apply) => {
  const before = structuredClone(view(player));
  const detail = structuredClone(meta);
  const result = apply();
  damage.push({ tick, time: world.time, ...detail, baseDamage: amount, heavy, input: structuredClone(input), before, after: structuredClone(view(player)), applied: before.hp - player.hp });
  return result;
};
// 実行前の1案を保存。公開定数spinWind=1.15に基づく入力だけの変更。
write("replay-plan.json", { source: reference.source, startTick, endExclusive: reference.ticks, maxTicks: 40, startTime: w.time, checkpointSha256: sha(JSON.stringify(checkpoint.world)), strategy: "同じ記録入力を再生。対象Spin中は早期dodgeを抑止し、開始から1.15秒の衝突開始まで残り0.10秒以下となる最初の受付可能tickに1回だけdodge=true。それ以外の入力/製品状態は変更しない。", spinWind: 1.15, tolerance: 1e-8 });
journal.replayRunsStarted = 1;
journal.status = "replaying-one-dodge-timing";
write("execution-journal.json", journal);
try {
  for (; tick < reference.ticks && w.phase === "battle"; tick++) {
    const recorded = saved.inputs[tick - saved.checkpoints[0].tick];
    if (!recorded) throw new Error("記録入力がありません。");
    input = structuredClone(recorded);
    const p = w.players[0];
    const boss = w.enemies.find(e => e.id === lethal.detail.enemy.id);
    if (boss?.harrow?.kind === "Spin") {
      const until = boss.harrow.started + 1.15 - (w.time + 0.05);
      input.dodge = !sentDodge && until <= 0.10 + 1e-8 && until >= -1e-8 && p.evadeCd <= 0.05;
      if (input.dodge) sentDodge = true;
    }
    if (!api.validInput(input)) throw new Error(`分岐入力が不正です: tick ${tick}`);
    if (input.dodge !== recorded.dodge) changes.push({ tick, nextTime: w.time + 0.05, from: recorded.dodge, to: input.dodge });
    api.step(w, { p: input });
    frames.push(structuredClone({ tick, time: w.time, phase: w.phase, input, player: view(p), boss: boss ? { id: boss.id, x: boss.x, y: boss.y, z: boss.z, hp: boss.hp, harrow: boss.harrow } : null }));
  }
  write("replay.json", { source: reference.source, startTick, steps: frames.length, sentDodge, phase: w.phase, time: w.time, kills: w.totalKills, player: view(w.players[0]), originalAtSameTime: { phase: reference.phase, time: reference.time, kills: reference.kills, player: view(reference.player) }, changes, damage, frames, conclusionLimit: "末尾2秒・1入力案の比較だけ。既存pilotの修正、ST25通し勝利、全攻撃/人の操作での回避可能性は未検証。" });
  journal.status = "completed-with-one-bounded-replay";
  journal.finishedAtUtc = new Date().toISOString();
  write("execution-journal.json", journal);
  console.log(JSON.stringify({ steps: frames.length, sentDodge, phase: w.phase, time: w.time, hp: w.players[0].hp, damageAttempts: damage.length, appliedDamage: damage.reduce((sum, d) => sum + d.applied, 0), changedInputFields: ["dodge"] }));
} catch (error) {
  journal.status = "replay-error-stop";
  journal.error = String(error.stack ?? error);
  write("execution-journal.json", journal);
  throw error;
} finally {
  delete globalThis.__stage25Damage;
  delete globalThis.__stage25Spawn;
}
