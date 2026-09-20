import type { Enemy, World } from "../shared/game";
import { stats } from "../shared/defs";

/** Provisional AR hit palette, based on the visible surface of each enemy. */
const AR_HITS: Record<Enemy["kind"], string> = {
  calyx: "impactShell",
  crawler: "impactShell", // PLEAT: dry layered shell — HIT-05.
  ant: "impactShell", // HOUND / VOLLEY.
  spider: "impactShell", // HOUND / LEAPER.
  spitter: "impactHard", // PRISM: hard facets — HIT-07.
  boss: "impactHard", // FOUNDRY ZERO, including linked segments.
  hornet: "impactSoft", // RAY: flexible covering — HIT-10.
};

export interface Cue {
  type: string;
  x?: number;
  z?: number;
  owner?: string;
  key?: string;
}
/** Audio observes authoritative state; it never changes combat or sends input. */
export class CombatAudio {
  private run = "";
  private event = 0;
  private players = new Map<
    string,
    { slot: number; evade: number; reload: number; ammo: number; hp: number }
  >();
  private enemies = new Map<
    number,
    { wind: number; cool: number; jump: number; lunge: number }
  >();
  private projectiles = new Set<number>();
  collect(w: World, active = true): Cue[] {
    const fresh = this.run !== w.run;
    if (fresh) {
      this.run = w.run;
      this.event = 0;
      this.players.clear();
      this.enemies.clear();
      this.projectiles.clear();
    }
    const cues: Cue[] = [];
    const shots = new Set<string>();
    for (const e of w.events) {
      if (e.id <= this.event) continue;
      this.event = Math.max(this.event, e.id);
      if (!active || fresh) continue;
      if (e.type === "shot") {
        const key = `${e.owner}:${e.weapon}`;
        if (!shots.has(key)) {
          cues.push({ ...e, type: e.weapon ?? "rifle", key });
          shots.add(key);
        }
        const p = w.players.find((p) => p.id === e.owner);
        const weapon = p?.weapons.find((v) => v.kind === e.weapon);
        if (
          weapon &&
          !(e.weapon === "rifle" && e.enemyKind) &&
          e.weapon !== "rocket" &&
          e.tx !== undefined &&
          e.tz !== undefined &&
          Math.hypot(e.tx - e.x, e.tz - e.z, (e.ty ?? e.y) - e.y) <
            stats(weapon).range - 0.1
        )
          cues.push({
            type: "impact",
            x: e.tx,
            z: e.tz,
            key: `impact:${e.owner}`,
          });
      } else
        cues.push({
          ...e,
          type:
            e.type === "hit"
              ? e.weapon === "rifle" && e.enemyKind
                ? (AR_HITS[e.enemyKind] ?? "impact")
                : "impact"
              : e.type === "burst" && e.weapon === "rocket"
                ? "rocketBurst"
                : e.type === "burst" && !e.owner && (e.radius ?? 7) < 2
                  ? "melee"
                  : e.type,
          key: e.type === "hit" ? `impact:${e.owner}` : undefined,
        });
    }
    for (const p of w.players) {
      const prev = this.players.get(p.id),
        next = {
          slot: p.slot,
          evade: p.evade,
          reload: p.reload,
          ammo: p.ammo[p.slot],
          hp: p.hp,
        };
      if (prev && active && p.hp > 0) {
        const push = (type: string) =>
          cues.push({
            type,
            x: p.x,
            z: p.z,
            owner: p.id,
            key: `${type}:${p.id}`,
          });
        if (p.slot !== prev.slot) push("switch");
        if (p.evade > 0 && prev.evade <= 0) push("dodge");
        if (p.reload > 0 && prev.reload <= 0) push("reload");
        if (
          p.reload <= 0 &&
          prev.reload > 0 &&
          p.slot === prev.slot &&
          next.ammo > prev.ammo
        )
          push("ready");
        if (p.hp < prev.hp) push("hurt");
      }
      this.players.set(p.id, next);
    }
    const enemyIds = new Set<number>();
    for (const e of w.enemies) {
      enemyIds.add(e.id);
      const prev = this.enemies.get(e.id);
      if (prev && active && e.hp > 0) {
        const push = (type: string) =>
          cues.push({ type, x: e.x, z: e.z, key: `${type}:${e.id}` });
        if (e.wind > 0 && prev.wind <= 0)
          push(e.kind === "boss" ? "charge" : "warning");
        if (
          e.cool > prev.cool &&
          prev.wind > 0 &&
          e.wind <= 0 &&
          ["spider", "ant"].includes(e.kind) &&
          Math.hypot(e.tx - e.x, e.tz - e.z) <= 2.6
        )
          push("melee");
        if ((e.jump ?? 0) > 0 && prev.jump <= 0) push("leap");
        if ((e.jump ?? 0) <= 0 && prev.jump > 0) push("land");
        if ((e.lunge ?? 0) > 0 && prev.lunge <= 0) push("lunge");
      }
      this.enemies.set(e.id, {
        wind: e.wind,
        cool: e.cool,
        jump: e.jump ?? 0,
        lunge: e.lunge ?? 0,
      });
    }
    for (const id of this.enemies.keys())
      if (!enemyIds.has(id)) this.enemies.delete(id);
    for (const id of this.players.keys())
      if (!w.players.some((p) => p.id === id)) this.players.delete(id);
    for (const q of w.projectiles)
      if (
        active &&
        !fresh &&
        q.owner === "enemy" &&
        !this.projectiles.has(q.id)
      )
        cues.push({
          type:
            q.style === "laser"
              ? "laser"
              : q.style === "stake"
                ? "stake"
                : "spit",
          x: q.x,
          z: q.z,
          key: q.style ?? "spit",
        });
    this.projectiles = new Set(w.projectiles.map((q) => q.id));
    return cues;
  }
}
