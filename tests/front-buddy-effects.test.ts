import { expect, it, vi } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";
import type { Event } from "../src/shared/game";

it("バディの弾は兵士の銃口へ補正せず、指定された始点から敵へ進む", () => {
  const scene = new T.Scene(),
    fx = new CombatEffects(scene);
  const soldier = new T.Vector3(20, 3, 40);
  const muzzle = vi.fn((out: T.Vector3) => out.set(22, 4, 39));
  const shot: Event = {
    id: 1,
    type: "shot",
    buddyEffect: "attack",
    owner: "soldier-one",
    x: -3,
    y: 0.5,
    z: 2,
    tx: -3,
    ty: 0.5,
    tz: -10,
  };
  fx.event(shot, soldier, muzzle);
  const bullet = fx.items.find((item) => item.kind === "bullet")!;
  expect(bullet.mesh.position.toArray()).toEqual([-3, 0.5, 2]);
  expect(muzzle).not.toHaveBeenCalled();
  expect(fx.items.every((item) => !item.shotAnchor && !item.shotFollow)).toBe(
    true,
  );
  soldier.set(100, 100, 100);
  fx.update(0.01);
  expect(bullet.mesh.position.x).toBe(-3);
  expect(bullet.mesh.position.y).toBe(0.5);
  expect(bullet.mesh.position.z).toBeCloseTo(0.8);
  fx.clear();
  // 兵士自身の既存射撃は、引き続き描画済み銃口へ追従する。
  fx.event({ ...shot, buddyEffect: undefined }, soldier, muzzle);
  expect(muzzle).toHaveBeenCalledOnce();
  expect(
    fx.items.find((item) => item.kind === "bullet")!.mesh.position.toArray(),
  ).toEqual([22, 4, 39]);
  fx.clear();
});

it("4属性の固有スキルは足元の輪だけを出し、寿命後に再利用して終了時は解放する", () => {
  const scene = new T.Scene(),
    fx = new CombatEffects(scene);
  const colors = {
    fire: 0xff993e,
    wind: 0x8eeac9,
    ice: 0x8fd7ff,
    lightning: 0xd4bbff,
  };
  let previous: T.Mesh | undefined;
  let material: T.Material | undefined;
  for (const buddyEffect of ["fire", "wind", "ice", "lightning"] as const) {
    fx.event({
      id: 1,
      type: buddyEffect === "wind" ? "heal" : "burst",
      buddyEffect,
      x: 2,
      y: 3,
      z: 4,
      radius: 5,
    });
    expect(fx.items.map((item) => item.kind)).toEqual(["ring"]);
    const effect = fx.items[0];
    expect(effect.mesh.position.toArray()).toEqual([2, 3.06, 4]);
    expect(effect.mesh.material.color.getHex()).toBe(colors[buddyEffect]);
    expect(effect.mesh.material.depthWrite).toBe(false);
    if (previous) expect(effect.mesh).toBe(previous);
    previous = effect.mesh;
    material = effect.mesh.material;
    fx.update(0.2, new T.PerspectiveCamera());
    expect(effect.mesh.scale.x).toBeCloseTo(5);
    expect(scene.children).toEqual([effect.mesh]);
    fx.update(0.7);
    expect(fx.items).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  }
  const disposed = vi.spyOn(material!, "dispose");
  fx.clear();
  expect(disposed).toHaveBeenCalledOnce();
  expect(scene.children).toHaveLength(0);
});
