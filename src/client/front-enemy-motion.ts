import type { Enemy, World } from "../shared/game";

type Frame = { time: number; enemies: Map<number, Enemy> };
type Point = { x: number; y: number; z: number; heading?: number };

/** Presentation only: never feed these positions back into combat or local input. */
export class FrontEnemyMotion {
  private frames: Frame[] = [];
  private run = "";
  private receivedAt = 0;
  private offset = Infinity;
  private cursor = -Infinity;
  private time = 0;

  reset() {
    this.frames = [];
    this.offset = Infinity;
    this.cursor = -Infinity;
  }

  receive(world: World, nowMs: number) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(world.time)) return;
    const last = this.frames.at(-1);
    if (
      world.run !== this.run ||
      nowMs - this.receivedAt > 1000 ||
      (last && world.time < last.time)
    )
      this.reset();
    this.run = world.run;
    if (this.frames.at(-1)?.time === world.time) return;
    this.receivedAt = nowMs;
    // Use simulation timestamps and a monotonic local clock, not Date.now or RTT.
    // The least delayed receipt estimates the clock offset without chasing spikes.
    this.offset = Math.min(this.offset, nowMs / 1000 - world.time);
    this.frames.push({
      time: world.time,
      enemies: new Map(
        world.enemies.map((e) => [
          e.id,
          {
            ...e,
            segments: e.segments?.map((s) => ({ ...s })),
          },
        ]),
      ),
    });
    if (this.frames.length > 12) this.frames.shift();
  }

  beginFrame(nowMs: number) {
    const last = this.frames.at(-1);
    if (!last) return;
    // 100ms snapshots + 50ms jitter margin; coast at most 100ms on a lost gap.
    this.cursor = Math.max(
      this.cursor,
      Math.min(last.time + 0.1, nowMs / 1000 - this.offset - 0.15),
    );
    this.time = this.cursor;
    while (this.frames.length > 2 && this.frames[1].time <= this.time)
      this.frames.shift();
  }

  sample(latest: Enemy): Enemy {
    if (this.frames.length < 2) return latest;
    let a = this.frames[0],
      b = this.frames[1];
    for (let i = 1; i < this.frames.length - 1 && b.time < this.time; i++) {
      a = b;
      b = this.frames[i + 1];
    }
    const from = a.enemies.get(latest.id),
      to = b.enemies.get(latest.id);
    // New/dead entities follow the latest membership immediately, never resurrect.
    if (!from || !to || from.kind !== latest.kind || to.kind !== latest.kind)
      return latest;
    const span = b.time - a.time;
    const alpha = Math.max(
      0,
      Math.min(1 + 0.1 / span, (this.time - a.time) / span),
    );
    // Teleports/phase changes and segment topology changes must not sweep space.
    if (
      Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) > 8 ||
      from.segments?.length !== to.segments?.length ||
      to.segments?.length !== latest.segments?.length ||
      from.phase !== to.phase ||
      to.phase !== latest.phase ||
      !!from.omega !== !!to.omega ||
      !!to.omega !== !!latest.omega
    )
      return latest;
    const blend = (p: Point, q: Point): Point => ({
      x: p.x + (q.x - p.x) * alpha,
      y: p.y + (q.y - p.y) * alpha,
      z: p.z + (q.z - p.z) * alpha,
      heading:
        p.heading == null || q.heading == null
          ? q.heading
          : p.heading +
            Math.atan2(
              Math.sin(q.heading - p.heading),
              Math.cos(q.heading - p.heading),
            ) *
              Math.min(alpha, 1),
    });
    return {
      ...latest,
      ...blend(from, to),
      segments: latest.segments?.map((s, i) => {
        const p = from.segments?.[i],
          q = to.segments?.[i];
        return p && q && p.partHp === q.partHp && q.partHp === s.partHp
          ? { ...s, ...blend(p, q) }
          : s;
      }),
    };
  }

  get enabled() {
    return this.frames.length > 0;
  }
}
