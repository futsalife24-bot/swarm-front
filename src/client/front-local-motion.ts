import { move, blocked, type Input, type World } from "../shared/game";
import { MOVE_SPEED, type Block } from "../shared/defs";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";

export interface LocalMotionPoint {
  x: number;
  y: number;
  z: number;
}
type Movement = Pick<Input, "mx" | "mz" | "yaw">;
const LEAD = MOVE_SPEED.walk * 0.45;
const FLOOR_EPSILON = 0.025; // wireの高さ丸めを許容し、段差は予測しない。
const distance = (a: LocalMotionPoint, b: LocalMotionPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** 自分の接地歩行表示だけを予測する。World・命中判定・入力ACKは変更しない。 */
export class FrontLocalMotion {
  private authority: LocalMotionPoint | undefined;
  private position: LocalMotionPoint | undefined;
  private blocks: Block[] = [];
  private run = "";
  private id = "";
  private receivedAt = -Infinity;
  private updatedAt: number | undefined;
  private ack = 0;
  private alive = false;
  private safe = false;
  private fallback = false;
  private kick = false;
  private special = false;
  private blockedSeq: number | undefined;
  private latestSeq = -1;
  private sampledMoving = false;
  private moving = false;
  private stopSeq: number | undefined;
  private stoppedAt: number | undefined;

  reset() {
    this.authority = this.position = undefined;
    this.blocks = [];
    this.run = this.id = "";
    this.receivedAt = -Infinity;
    this.updatedAt = undefined;
    this.ack = 0;
    this.alive = this.safe = this.fallback = this.kick = this.special = false;
    this.blockedSeq = this.stopSeq = this.stoppedAt = undefined;
    this.latestSeq = -1;
    this.sampledMoving = this.moving = false;
  }

  receive(world: World, id: string, nowMs: number) {
    const p = world.players.find((player) => player.id === id);
    if (
      !p ||
      world.phase !== "battle" ||
      !p.connected ||
      !Number.isFinite(nowMs)
    ) {
      this.reset();
      return;
    }
    const fresh = !this.authority || world.run !== this.run || id !== this.id;
    if (fresh) this.reset();
    const previous = this.authority;
    const wasAlive = this.alive;
    this.run = world.run;
    this.id = id;
    this.blocks = mapFor(world).blocks;
    const point = { x: p.x, y: p.y ?? 0, z: p.z };
    this.authority = point;
    this.receivedAt = nowMs;
    this.ack = p.ack;
    this.alive = p.hp > 0;
    this.kick = p.weapons[p.slot]?.kind === "kick";
    this.safe =
      this.alive &&
      p.evade <= 0 &&
      Math.abs(p.verticalSpeed ?? 0) < 0.001 &&
      !p.jumpHeld &&
      this.flat(point);
    if (
      this.blockedSeq !== undefined &&
      this.ack >= this.blockedSeq &&
      this.safe &&
      !this.special
    )
      this.blockedSeq = undefined;
    if (!this.safe || this.blockedSeq !== undefined || this.special) {
      this.position = undefined;
      return;
    }
    const displaced =
      previous &&
      (distance(previous, point) > LEAD ||
        Math.abs(previous.y - point.y) > FLOOR_EPSILON);
    const invalid =
      this.position &&
      (distance(this.position, point) > LEAD + 1e-6 ||
        !this.reachable(this.position, point));
    if (
      fresh ||
      !this.position ||
      wasAlive !== this.alive ||
      displaced ||
      invalid
    ) {
      this.position = { ...point };
      this.fallback = !fresh;
      this.moving = false;
      this.stopSeq = this.stoppedAt = undefined;
      this.updatedAt = nowMs;
    } else if (
      !this.moving &&
      !this.sampledMoving &&
      this.stoppedAt === undefined &&
      this.stopSeq === undefined
    ) {
      // 予測歩行を開始していない間の権威変位は、そのまま採用する。
      this.position = { ...point };
    }
  }

  sample(input: Input) {
    if (!Number.isSafeInteger(input.seq) || input.seq <= this.latestSeq) return;
    this.latestSeq = input.seq;
    const moving = Math.hypot(input.mx, input.mz) > 0.001;
    this.special = input.dodge || !!input.jump || (this.kick && input.fire);
    if (this.special) {
      this.blockedSeq = input.seq;
      this.position = undefined;
      this.moving = false;
      this.stopSeq = this.stoppedAt = undefined;
    } else if (moving) {
      this.stopSeq = this.stoppedAt = undefined;
    } else if (
      (this.sampledMoving || this.moving) &&
      this.stopSeq === undefined
    ) {
      this.stopSeq = input.seq;
    }
    this.sampledMoving = moving;
  }

  update(
    movement: Movement,
    dt: number,
    active: boolean,
    nowMs: number,
  ): LocalMotionPoint | undefined {
    if (
      !active ||
      !Number.isFinite(nowMs) ||
      !Number.isFinite(dt) ||
      dt < 0 ||
      dt > 0.1 ||
      nowMs < this.receivedAt ||
      nowMs - this.receivedAt > 500 ||
      (this.updatedAt !== undefined &&
        (nowMs < this.updatedAt || nowMs - this.updatedAt > 100)) ||
      ![movement.mx, movement.mz, movement.yaw].every(Number.isFinite)
    ) {
      this.reset();
      return;
    }
    const elapsed =
      this.updatedAt === undefined
        ? dt
        : Math.min(dt, (nowMs - this.updatedAt) / 1000);
    this.updatedAt = nowMs;
    if (
      !this.authority ||
      !this.position ||
      !this.safe ||
      this.special ||
      this.blockedSeq !== undefined
    )
      return;
    if (this.fallback) {
      this.fallback = false;
      return;
    }
    dt = Math.min(0.05, elapsed);
    const norm = Math.max(1, Math.hypot(movement.mx, movement.mz));
    const ux =
      (movement.mx * Math.cos(movement.yaw) +
        movement.mz * Math.sin(movement.yaw)) /
      norm;
    const uz =
      (movement.mx * Math.sin(movement.yaw) -
        movement.mz * Math.cos(movement.yaw)) /
      norm;
    if (Math.hypot(ux, uz) > 0.001) {
      this.moving = true;
      this.stopSeq = this.stoppedAt = undefined;
      const next = this.advance(
        this.position,
        ux * MOVE_SPEED.walk * dt,
        uz * MOVE_SPEED.walk * dt,
      );
      if (!next) return this.invalidateDisplay();
      if (distance(next, this.authority) > LEAD) {
        // 先行円の境界までだけ進める。古いsnapshot方向へ引き戻さない。
        const dx = next.x - this.position.x,
          dz = next.z - this.position.z;
        const x = this.position.x - this.authority.x,
          z = this.position.z - this.authority.z;
        const a = dx * dx + dz * dz,
          b = x * dx + z * dz;
        const c = x * x + z * z - LEAD * LEAD;
        const t =
          a > 0
            ? Math.max(
                0,
                Math.min(1, (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a),
              )
            : 0;
        this.position = this.advance(this.position, dx * t, dz * t) ?? {
          ...this.authority,
        };
      } else this.position = next;
    } else {
      if (this.moving) {
        this.moving = false;
        this.stoppedAt = nowMs;
      }
      if (
        this.stoppedAt !== undefined &&
        ((this.stopSeq !== undefined &&
          this.stopSeq > 0 &&
          this.ack >= this.stopSeq) ||
          nowMs - this.stoppedAt >= 600)
      ) {
        const error = distance(this.position, this.authority);
        if (error > 0.0001) {
          const factor = Math.min(1, (MOVE_SPEED.walk * dt) / error);
          const next = this.advance(
            this.position,
            (this.authority.x - this.position.x) * factor,
            (this.authority.z - this.position.z) * factor,
          );
          if (
            !next ||
            (distance(next, this.authority) >= error - 1e-6 && dt > 0)
          )
            return this.invalidateDisplay();
          this.position = next;
        } else this.position = { ...this.authority };
      }
    }
    return { ...this.position };
  }

  private flat(point: LocalMotionPoint) {
    return (
      [point.x, point.y, point.z].every(Number.isFinite) &&
      Math.abs(
        point.y - supportHeight(point.x, point.z, this.blocks, point.y, 0.55),
      ) <= FLOOR_EPSILON &&
      !blocked(point.x, point.z, 0.55, point.y, this.blocks)
    );
  }
  private advance(point: LocalMotionPoint, dx: number, dz: number) {
    const next = { ...point };
    move(next, dx, dz, 0.55, this.blocks, false, true);
    return Math.abs(next.y - point.y) <= FLOOR_EPSILON && this.flat(next)
      ? next
      : undefined;
  }
  private reachable(from: LocalMotionPoint, to: LocalMotionPoint) {
    const probe = this.advance(from, to.x - from.x, to.z - from.z);
    return (
      !!probe &&
      distance(probe, to) < 0.001 &&
      Math.abs(probe.y - to.y) <= FLOOR_EPSILON
    );
  }
  private invalidateDisplay() {
    this.position = undefined;
    this.moving = false;
    this.stopSeq = this.stoppedAt = undefined;
    return undefined;
  }
}
