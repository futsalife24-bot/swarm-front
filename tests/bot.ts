import { neutral, visible, type World, type Input } from "../src/shared/game";
// Test pilot only: sends ordinary movement and aim inputs; never modifies HP, timing or rewards.
export function pilot(w: World, id: string): Input {
  const p = w.players.find((p) => p.id === id)!;
  const i = neutral();
  i.seq = Math.round(w.time * 20) + 1;
  const enemies = w.enemies
    .filter((e) => e.hp > 0 && visible(p, e))
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    );
  const e = enemies[0];
  if (!e) return i;
  const d = Math.hypot(e.x - p.x, e.z - p.z);
  i.yaw = Math.atan2(e.x - p.x, -(e.z - p.z));
  i.pitch = Math.atan2((e.kind === "boss" ? 3 : 1.4) - 1.5, d);
  i.fire = true;
  let vx = Math.cos(w.time * 0.7) * 4,
    vz = Math.sin(w.time * 0.7) * 2;
  for (const a of w.enemies) {
    const dist = Math.max(1, Math.hypot(a.x - p.x, a.z - p.z));
    if (dist < 14) {
      vx += ((p.x - a.x) / dist) * (14 - dist);
      vz += ((p.z - a.z) / dist) * (14 - dist);
    }
  }
  if (
    e.kind === "boss" &&
    e.wind > 0 &&
    Math.hypot(p.x - e.tx, p.z - e.tz) < 9
  ) {
    vx += p.x <= e.tx ? -12 : 12;
    vz += 5;
  }
  // Keep the pilot in the clear central boulevard and away from the boundary.
  vx += p.x > 7 ? (7 - p.x) * 7 : p.x < -7 ? (-7 - p.x) * 7 : 0;
  vz += p.z > 42 ? (42 - p.z) * 7 : p.z < -42 ? (-42 - p.z) * 7 : 0;
  if (d > 25) {
    vx += (e.x - p.x) * 0.4;
    vz += (e.z - p.z) * 0.4;
  }
  const norm = Math.max(1, Math.hypot(vx, vz));
  vx /= norm;
  vz /= norm;
  i.mx = Math.max(-1, Math.min(1, vx * Math.cos(i.yaw) + vz * Math.sin(i.yaw)));
  i.mz = Math.max(-1, Math.min(1, vx * Math.sin(i.yaw) - vz * Math.cos(i.yaw)));
  i.dodge = d < 5 || (e.kind === "boss" && e.wind > 0);
  i.revive = true;
  return i;
}
