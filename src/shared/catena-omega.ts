import { hurtPlayer, event, type Enemy, type World } from "./game";
import { enemySize, enemyStatSize } from "./enemy-size";
import { mapFor } from "./stages";
import { supportHeight } from "./terrain";
import { foundryGroundLine } from "./foundry-navigation";
import { caveCeiling } from "./cave";
import { wormNodes, wormChains } from "./worm";

// 独立監査前の仮調整値。総HP・レーザー・増援とは別枠で管理する。
export const OMEGA = {
  brace: 0.7,
  warn: 0.9,
  flight: 1.8,
  cooldown: 16,
  retry: 3,
  damage: 10,
  radius: 2.2,
} as const;
export type OmegaPoint = { x: number; y: number; z: number; heading: number };
export interface OmegaState {
  at: number;
  ground: OmegaPoint[];
  peak: OmegaPoint[];
}
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
export function omegaPhase(e: Enemy, time: number) {
  if (!e.omega) return undefined;
  const age = time - e.omega.at;
  return age < OMEGA.brace
    ? "brace"
    : age < OMEGA.brace + OMEGA.warn
      ? "warn"
      : "flight";
}
export function omegaPads(e: Enemy, time: number) {
  if (!e.omega || omegaPhase(e, time) === "brace") return [];
  return e.omega.ground.map((p, i) => ({
    ...p,
    radius: (i === 0 ? 4 : OMEGA.radius) * enemySize(e),
  }));
}
export function omegaPose(s: OmegaState, time: number): OmegaPoint[] {
  const age = time - s.at - OMEGA.brace - OMEGA.warn;
  // The stored peak still bounds the original obstacle sweep. The body jumps
  // above its own landing marks, with takeoff traveling from head to tail.
  const lift = Math.max(...s.peak.map((p, i) => p.y - s.ground[i].y)) * 0.9;
  return s.ground.map((p, i) => {
    const delay = (0.5 * i) / (s.ground.length - 1);
    const progress = Math.max(
      0,
      Math.min(1, (age - delay) / (OMEGA.flight - delay)),
    );
    const height = lift * smooth(2 * Math.min(progress, 1 - progress));
    return { x: p.x, y: p.y + height, z: p.z, heading: p.heading };
  });
}
/** 同じ支持面へ戻るΩ。通路・地形・天井に余裕がなければ発動しない。 */
export function planOmega(w: World, e: Enemy): OmegaState | undefined {
  const nodes = wormNodes(e),
    size = enemySize(e),
    map = mapFor(w);
  if (
    e.fractured ||
    nodes.length < 8 ||
    wormChains(e)[0]?.length !== nodes.length
  )
    return;
  const ground = nodes.map((n) => ({
    x: n.x,
    y: n.y,
    z: n.z,
    heading: n.heading ?? 0,
  }));
  const mid = ground[Math.floor(ground.length / 2)];
  const yaw = Math.atan2(
    ground[0].x - ground.at(-1)!.x,
    ground[0].z - ground.at(-1)!.z,
  );
  const r = ((nodes.length - 1) * 3.2 * size) / ((Math.PI * 4) / 3 + 1.3);
  const peak = ground.map((p, i) => {
    const t = (i - 1) / (nodes.length - 3),
      a = -Math.PI / 6 + (t * Math.PI * 4) / 3;
    const edge = i === 0 || i === nodes.length - 1;
    const x = edge ? (i === 0 ? 1 : -1) * r * 1.25 : Math.cos(a) * r;
    const y = edge ? 0 : (Math.sin(a) + 0.5) * r;
    return {
      x: mid.x + Math.sin(yaw) * x,
      y: mid.y + 2 * size + y,
      z: mid.z + Math.cos(yaw) * x,
      heading: yaw,
    };
  });
  const lift = Math.max(...peak.map((p, i) => p.y - ground[i].y)) * 0.9;
  if (
    map.biome === "cave" &&
    ground.some((p) => p.y + lift + 4 * size > caveCeiling(p.x, p.z))
  )
    return;
  for (const [i, p] of ground.entries()) {
    // 水平掃引を地上の広い通行判定でも通す。飛行で建物を越える仕様は追加しない。
    if (
      Math.abs(p.y - mid.y) > 0.2 * size ||
      !foundryGroundLine(map, p, peak[i])
    )
      return;
    for (let j = 0; j <= 20; j++) {
      const f = j / 20,
        x = p.x + (peak[i].x - p.x) * f,
        z = p.z + (peak[i].z - p.z) * f,
        y = p.y + (peak[i].y - p.y) * f;
      if (
        y + 0.05 < supportHeight(x, z, map.blocks) ||
        (map.biome === "cave" && y + 4 * size > caveCeiling(x, z))
      )
        return;
    }
  }
  return { at: w.time, ground, peak };
}
export function cancelOmega(e: Enemy) {
  if (!e.omega) return;
  wormNodes(e).forEach((n, i) => Object.assign(n, e.omega!.ground[i]));
  e.omega = undefined;
}
/** trueの間は地上移動とレーザーを止める。判定は権威側の一回の和集合。 */
export function stepOmega(w: World, e: Enemy): boolean {
  const nodes = wormNodes(e);
  if (
    e.omega &&
    (e.hp <= 0 ||
      e.fractured ||
      nodes.some((n) => n.partHp === 0) ||
      !w.players.some((p) => p.hp > 0 && p.connected))
  ) {
    cancelOmega(e);
    e.omegaReadyAt = w.time + OMEGA.cooldown;
    return false;
  }
  if (!e.omega) {
    e.omegaReadyAt ??= w.time + OMEGA.cooldown;
    if (
      w.time < e.omegaReadyAt ||
      !w.players.some((p) => p.hp > 0 && p.connected)
    )
      return false;
    e.omega = planOmega(w, e);
    e.omegaReadyAt = w.time + (e.omega ? OMEGA.cooldown : OMEGA.retry);
    if (!e.omega) return false;
    for (const n of nodes) {
      n.pulseAim = undefined;
      n.acidAt = w.time + OMEGA.brace + OMEGA.warn + OMEGA.flight + 0.8;
    }
  }
  const s = e.omega;
  if (w.time < s.at + OMEGA.brace + OMEGA.warn + OMEGA.flight) {
    omegaPose(s, w.time).forEach((p, i) => Object.assign(nodes[i], p));
    return true;
  }
  s.ground.forEach((p, i) => Object.assign(nodes[i], p));
  const pads = omegaPads(e, w.time);
  for (const p of pads)
    event(w, { type: "burst", x: p.x, y: p.y, z: p.z, radius: p.radius });
  for (const p of w.players)
    if (
      p.hp > 0 &&
      p.connected &&
      pads.some(
        (n) =>
          Math.hypot(n.x - p.x, n.z - p.z) <= n.radius &&
          Math.abs((p.y ?? 0) - n.y) < 1.8,
      )
    )
      hurtPlayer(w, p, OMEGA.damage * enemyStatSize(e), true);
  e.omega = undefined;
  e.omegaReadyAt = w.time + OMEGA.cooldown;
  return true;
}
