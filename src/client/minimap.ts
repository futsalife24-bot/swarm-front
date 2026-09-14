import { markerAbove, groundHeight, terrainProps } from "../shared/terrain";
import { ARENA_X, ARENA_Z } from "../shared/arena";
import { CAVE_BLOCKS, caveClearance } from "../shared/cave";
import { mapFor } from "../shared/stages";
import type { World } from "../shared/game";
// Mirrors the arena bounds enforced in src/shared/game.ts (blocked()).

// How far the rotating view reaches. Turning the map means centring it on the
// player, so it becomes a window rather than the whole district.
const VIEW_RADIUS = 42;
const COLORS = {
  ground: "#0d1c25e6",
  block: "#28414d",
  edge: "#4d7b88",
  crawler: "#ff8b6b",
  spitter: "#ffd479",
  boss: "#ff5f8f",
  hornet: "#ffb347",
  ant: "#df7844",
  spider: "#bf99ff",
  mate: "#8fe3d8",
  downed: "#ffd479",
  self: "#d9f4ff",
};
export class Minimap {
  canvas = document.getElementById("minimap") as HTMLCanvasElement;
  ctx = this.canvas.getContext("2d")!;
  drawnAt = 0;
  scale = 0;
  rotates = false;
  // Buildings never move, so they are baked once per resize instead of per frame.
  base = document.createElement("canvas");
  map = mapFor({});
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
    if (this.map.blocks === CAVE_BLOCKS) {
      b.fillStyle = "#39414a";
      b.fillRect(0, 0, this.base.width, this.base.height);
      b.fillStyle = "#101c25";
      for (let x = -ARENA_X; x < ARENA_X; x += 1)
        for (let z = -ARENA_Z; z < ARENA_Z; z += 1)
          if (caveClearance(x + 0.5, z + 0.5) >= 0)
            b.fillRect(
              this.px(x),
              this.pz(z),
              this.scale + 0.5,
              this.scale + 0.5,
            );
    }
    for (let x = -ARENA_X; x < ARENA_X; x += 2)
      for (let z = -ARENA_Z; z < ARENA_Z; z += 2) {
        if (this.map.blocks === CAVE_BLOCKS && caveClearance(x, z) < 0)
          continue;
        const h = groundHeight(x, z, this.map.blocks);
        if (h < 0.3) continue;
        b.fillStyle = `rgba(130,170,150,${Math.min(0.42, Math.ceil(h) * 0.035)})`;
        b.fillRect(
          this.px(x),
          this.pz(z),
          2 * this.scale + 0.5,
          2 * this.scale + 0.5,
        );
      }
    b.fillStyle = "#77908d";
    for (const prop of terrainProps(this.map.blocks))
      b.fillRect(
        this.px(prop.x - prop.w / 2),
        this.pz(prop.z - prop.d / 2),
        Math.max(1, prop.w * this.scale),
        Math.max(1, prop.d * this.scale),
      );
    b.fillStyle = COLORS.block;
    for (const k of this.map.blocks)
      b.fillRect(
        this.px(k.x - k.w / 2),
        this.pz(k.z - k.d / 2),
        k.w * this.scale,
        k.d * this.scale,
      );
  }
  px = (x: number) => (x + ARENA_X) * this.scale;
  pz = (z: number) => (z + ARENA_Z) * this.scale;
  ring(x: number, y: number, r: number, color: string, width: number) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width * devicePixelRatio;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r * devicePixelRatio, 0, 7);
    this.ctx.stroke();
  }
  dot(x: number, y: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r * devicePixelRatio, 0, 7);
    this.ctx.fill();
  }
  arrow(x: number, y: number, fx: number, fz: number) {
    const c = this.ctx,
      s = 5 * devicePixelRatio;
    c.fillStyle = COLORS.self;
    c.beginPath();
    c.moveTo(x + fx * s, y + fz * s);
    c.lineTo(x - fz * s * 0.7 - fx * s * 0.5, y + fx * s * 0.7 - fz * s * 0.5);
    c.lineTo(x + fz * s * 0.7 - fx * s * 0.5, y - fx * s * 0.7 - fz * s * 0.5);
    c.closePath();
    c.fill();
  }
  draw(w: World, id: string, yaw: number, now: number) {
    if (now - this.drawnAt < 100) return;
    this.drawnAt = now;
    const map = mapFor(w);
    if (map !== this.map) {
      this.map = map;
      this.canvas.width = 0;
    }
    this.fit();
    if (!this.scale) return;
    const c = this.ctx,
      cw = this.canvas.width,
      ch = this.canvas.height,
      self = w.players.find((p) => p.id === id);
    const turning = this.rotates && !!self;
    this.canvas.classList.toggle("round", turning);
    const zoom = cw / 2 / (VIEW_RADIUS * this.scale),
      cos = Math.cos(-yaw),
      sin = Math.sin(-yaw);
    // World position to a pixel on this canvas, under whichever view is active.
    const at = (x: number, z: number): [number, number] => {
      if (!turning) return [this.px(x), this.pz(z)];
      const dx = (this.px(x) - this.px(self!.x)) * zoom,
        dz = (this.pz(z) - this.pz(self!.z)) * zoom;
      return [cw / 2 + dx * cos - dz * sin, ch / 2 + dx * sin + dz * cos];
    };
    c.clearRect(0, 0, cw, ch);
    c.save();
    if (turning) {
      c.beginPath();
      c.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2, 0, 7);
      c.clip();
      c.translate(cw / 2, ch / 2);
      c.rotate(-yaw);
      c.scale(zoom, zoom);
      c.translate(-this.px(self!.x), -this.pz(self!.z));
    }
    c.drawImage(this.base, 0, 0);
    c.restore();
    // Keep the complete enemy mark inside the rim, preserving its bearing.
    const enemyAt = (
      wx: number,
      wz: number,
      radius: number,
    ): [number, number] => {
      const [x, y] = at(wx, wz);
      const margin = (radius + 1) * devicePixelRatio;
      const dx = x - cw / 2,
        dy = y - ch / 2;
      const rx = Math.max(0, cw / 2 - margin);
      const ry = Math.max(0, ch / 2 - margin);
      const factor = turning
        ? Math.min(1, Math.min(rx, ry) / (Math.hypot(dx, dy) || 1))
        : Math.min(1, rx / (Math.abs(dx) || 1), ry / (Math.abs(dy) || 1));
      return [cw / 2 + dx * factor, ch / 2 + dy * factor];
    };
    for (const e of w.enemies) {
      for (const segment of e.segments ?? []) {
        if (segment.partHp === 0) continue;
        const [sx, sy] = enemyAt(
          segment.x,
          segment.z,
          markerAbove(segment, self) ? 3.05 : 2.5,
        );
        if (markerAbove(segment, self))
          this.ring(sx, sy, 2.5, COLORS.boss, 1.1);
        else this.dot(sx, sy, 2.5, COLORS.boss);
      }
      if (e.partHp === 0) continue;
      const r = e.kind === "boss" ? 4 : 1.6,
        [x, y] = enemyAt(
          e.x,
          e.z,
          markerAbove(e, self) ? r + 0.8 + 1.1 / 2 : r,
        );
      // Airborne reads as a hollow mark. A flat map cannot say how high something
      // is, and pretending otherwise makes "overhead" look like "on top of you".
      if (markerAbove(e, self)) this.ring(x, y, r + 0.8, COLORS[e.kind], 1.1);
      else this.dot(x, y, r, COLORS[e.kind]);
    }
    for (const p of w.players) {
      if (!p.connected || p.id === id) continue;
      const [x, y] = at(p.x, p.z);
      if (p.hp > 0) this.dot(x, y, 2.4, COLORS.mate);
      // A downed mate is the one thing on this map worth walking towards.
      else if (p.down > 0) this.ring(x, y, 4, COLORS.downed, 1.4);
    }
    if (!self) return;
    // Turning the map puts forward at the top, so the arrow stops turning.
    if (turning) this.arrow(cw / 2, ch / 2, 0, -1);
    else {
      const [x, y] = at(self.x, self.z);
      // Forward is (sin yaw, -cos yaw); the same basis move() uses in game.ts.
      this.arrow(x, y, Math.sin(yaw), -Math.cos(yaw));
    }
    c.strokeStyle = COLORS.edge;
    c.lineWidth = devicePixelRatio;
    if (turning) {
      c.beginPath();
      c.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2 - devicePixelRatio / 2, 0, 7);
      c.stroke();
    } else c.strokeRect(0, 0, cw, ch);
  }
}
