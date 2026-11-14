import { STARTERS, stats } from "../src/shared/defs";
import type { FrontRun } from "../src/shared/front-run";

export type FireCadenceWeapon = "rifle" | "smg";

/**
 * ローカル検査専用。連射間隔の比較条件（seed・武器・人数以外の差）を揃える。
 * 射撃・入力・通信・描画は製品の経路をそのまま通す。
 * - quiet: 敵と出現を止め、被弾・撃破・カード選択で射撃が途切れないようにする。
 * - keep: 敵の状態は変えない（別の密集fixtureと組み合わせる）。
 * 武器は強化前の標準値へ置き換える。通常のプレイで起きる状態ではない。
 */
export function fireCadenceFixture(
  run: FrontRun,
  weapon: FireCadenceWeapon,
  mode: "quiet" | "keep" = "quiet",
  seed = 4520,
) {
  const w = run.world;
  w.seed = seed;
  if (run.survivalSpawnSeed !== undefined) run.survivalSpawnSeed = seed;
  if (mode === "quiet") {
    w.enemies = [];
    w.projectiles = [];
    run.pendingSpawns = [];
    run.pendingBoss = null;
    run.nextSpawnAt = 1e9;
    if (w.front) w.front.enemyCap = 0;
    if (w.defense) w.defense.nextSpawn = 1e9;
  }
  run.phase = "combat";
  run.resumeUntil = 0;
  for (const p of w.players) {
    p.weapons = [{ ...STARTERS[0], kind: weapon, id: `cadence-${p.id}` }];
    p.slot = 0;
    p.ammo = [stats(p.weapons[0]).mag];
    p.reload = 0;
    p.cool = 0;
    p.swapCd = 0;
    p.hp = 100000;
    if (w.front?.players[p.id]) w.front.players[p.id].maxHp = 100000;
  }
  const s = stats(w.players[0].weapons[0]);
  return {
    seed,
    weapon,
    mode,
    intervalMs: s.interval * 1000,
    mag: s.mag,
    reloadMs: s.reload * 1000,
    players: w.players.length,
    enemies: w.enemies.length,
  };
}
