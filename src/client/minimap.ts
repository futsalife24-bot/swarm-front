import { BLOCKS } from "../shared/defs";
import type { World } from "../shared/game";
// Mirrors the arena bounds enforced in src/shared/game.ts (blocked()).
const ARENA_X = 47,
  ARENA_Z = 52;
const COLORS = {
  ground: "#0d1c25e6",
  block: "#28414d",
  edge: "#4d7b88",
  crawler: "#ff8b6b",
  spitter: "#ffd479",
  boss: "#ff5f8f",
  mate: "#8fe3d8",
  downed: "#ffd479",
  self: "#d9f4ff",
};
// North-up on purpose: the district never rotates, so players can learn it.
export class Minimap {
  canvas = document.getElementById("minimap") as HTMLCanvasElement;
  ctx = this.canvas.getContext("2d")!;
  drawnAt = 0;
  scale = 0;
  // Buildings never move, so they are baked once per resize instead of per frame.
  base = document.createElement("canvas");
  fit() {
    const size = this.canvas.clientWidth * devicePixelRatio;
    if (!size || this.canvas.width === Math.round(size)) return;
    this.canvas.width = Math.round(size);
    this.canvas.height = Math.round((size * ARENA_Z) / ARENA_X);
    this.scale = this.canvas.width / (ARENA_X * 2);
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    const b = this.base.getContext("2d")!;
    b.fillStyle = COLORS.ground;
    b.fillRect(0, 0, this.base.width, this.base.height);
    b.fillStyle = COLORS.block;
    for (const k of BLOCKS)
      b.fillRect(
        this.px(k.x - k.w / 2),
        this.pz(k.z - k.d / 2),
        k.w * this.scale,
        k.d * this.scale,
      );
    b.strokeStyle = COLORS.edge;
    b.lineWidth = devicePixelRatio;
    b.strokeRect(0, 0, this.base.width, this.base.height);
  }
  px = (x: number) => (x + ARENA_X) * this.scale;
  pz = (z: number) => (z + ARENA_Z) * this.scale;
  dot(x: number, z: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(this.px(x), this.pz(z), r * devicePixelRatio, 0, 7);
    this.ctx.fill();
  }
  draw(w: World, id: string, yaw: number, now: number) {
    if (now - this.drawnAt < 100) return;
    this.drawnAt = now;
    this.fit();
    if (!this.scale) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.base, 0, 0);
    for (const e of w.enemies)
      this.dot(e.x, e.z, e.kind === "boss" ? 4 : 1.6, COLORS[e.kind]);
    for (const p of w.players) {
      if (!p.connected || p.id === id) continue;
      if (p.hp > 0) this.dot(p.x, p.z, 2.4, COLORS.mate);
      else if (p.down > 0) {
        // A downed mate is the one thing on this map worth walking towards.
        c.strokeStyle = COLORS.downed;
        c.lineWidth = 1.4 * devicePixelRatio;
        c.beginPath();
        c.arc(this.px(p.x), this.pz(p.z), 4 * devicePixelRatio, 0, 7);
        c.stroke();
      }
    }
    const self = w.players.find((p) => p.id === id);
    if (!self) return;
    const x = this.px(self.x),
      z = this.pz(self.z),
      s = 5 * devicePixelRatio,
      // Forward is (sin yaw, -cos yaw); the same basis move() uses in game.ts.
      fx = Math.sin(yaw),
      fz = -Math.cos(yaw);
    c.fillStyle = COLORS.self;
    c.beginPath();
    c.moveTo(x + fx * s, z + fz * s);
    c.lineTo(x - fz * s * 0.7 - fx * s * 0.5, z + fx * s * 0.7 - fz * s * 0.5);
    c.lineTo(x + fz * s * 0.7 - fx * s * 0.5, z - fx * s * 0.7 - fz * s * 0.5);
    c.closePath();
    c.fill();
  }
}
