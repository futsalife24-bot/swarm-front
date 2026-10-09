import { describe, expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";
import type { Event } from "../src/shared/game";
import { addPlayer, createWorld, fire, neutral } from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";

const shot = (overrides: Partial<Event> = {}): Event => ({
  id: 1,
  type: "shot",
  weapon: "rifle",
  owner: "p1",
  x: 4,
  y: 3.5,
  z: 6,
  tx: 4,
  ty: 3.5,
  tz: -30,
  ...overrides,
});

describe("fixed body-centre shot presentation", () => {
  it("retains the authority's fixed body-centre origin when firing to either side", () => {
    for (const x of [-0.4, 0, 0.4]) {
      const world = createWorld("shot-origin", 42);
      const player = addPlayer(world, "p1", [STARTERS[0], STARTERS[2]]);
      player.x = x;
      player.z = 0;
      player.y = 2;
      fire(world, player, { ...neutral(), cameraAim: true, yaw: 0, pitch: 0 });
      const event = world.events.find((e) => e.type === "shot")!;
      expect(event).toBeDefined();
      expect([event.x, event.y, event.z]).toEqual([x, 3.5, 0]);
    }
  });
  for (const lag of [-0.4, 0, 0.4]) {
    it(`keeps emission fixed to the rendered body with lateral lag ${lag}`, () => {
      const fx = new CombatEffects(new T.Scene());
      const body = new T.Vector3(4 + lag, 2, 6);
      const event = shot();
      const original = { ...event };
      fx.event(event, body);
      const bullet = fx.items.find((item) => item.kind === "bullet")!;
      const flash = fx.items.find((item) => item.kind === "flash")!;
      const start = new T.Vector3(body.x, body.y + 1.5, body.z);
      expect(bullet.mesh.position.distanceTo(start)).toBeLessThan(1e-9);
      expect(flash.mesh.position.distanceTo(start)).toBeLessThan(1e-9);
      // The original authority hit endpoint is preserved, including spread.
      const endpoint = start
        .clone()
        .addScaledVector(bullet.velocity, bullet.duration);
      expect(
        endpoint.distanceTo(new T.Vector3(event.tx, event.ty, event.tz)),
      ).toBeLessThan(1e-9);
      const velocity = bullet.velocity.clone();
      body.x += lag < 0 ? -0.25 : 0.25;
      body.y += 0.1;
      fx.update(0.02);
      expect(
        flash.mesh.position.distanceTo(
          new T.Vector3(body.x, body.y + 1.5, body.z),
        ),
      ).toBeLessThan(1e-9);
      expect(
        bullet.mesh.position.distanceTo(start.addScaledVector(velocity, 0.02)),
      ).toBeLessThan(1e-9);
      expect(event).toEqual(original);
    });
  }

  it("preserves world-space effects when no body exists, for enemies and secondary shots", () => {
    for (const event of [
      shot(),
      shot({ owner: "enemy" }),
      shot({ frontEffect: "ricochet" }),
    ]) {
      const fx = new CombatEffects(new T.Scene());
      const body = new T.Vector3(100, 10, 100);
      fx.event(
        event,
        event.owner === "p1" && !event.frontEffect ? undefined : body,
      );
      const bullet = fx.items.find((item) => item.kind === "bullet")!;
      const flash = fx.items.find((item) => item.kind === "flash")!;
      expect(bullet.mesh.position.toArray()).toEqual([4, 3.5, 6]);
      expect(flash.mesh.position.toArray()).toEqual([4, 3.5, 5.2]);
      body.x = 200;
      fx.update(0.02);
      expect(flash.mesh.position.toArray()).toEqual([4, 3.5, 5.2]);
    }
  });

  it("clears a pooled flash's body anchor when reused for a world-space event", () => {
    const fx = new CombatEffects(new T.Scene());
    const body = new T.Vector3(4, 2, 6);
    fx.event(shot({ weapon: "rocket" }), body);
    const oldFlash = fx.items[0];
    fx.update(0.1);
    fx.event(shot({ weapon: "rocket", owner: "enemy" }));
    expect(fx.items[0]).toBe(oldFlash);
    body.x = 100;
    fx.update(0.01);
    expect(fx.items[0].mesh.position.toArray()).toEqual([4, 3.5, 5.2]);
  });
});
