import { expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";

it("連鎖の光線は端点間に留まり、短い寿命の後に描画資源を再利用する", () => {
  const scene = new T.Scene(),
    fx = new CombatEffects(scene);
  const event = {
    id: 1,
    type: "burst" as const,
    frontEffect: "chain-lightning" as const,
    x: 0,
    y: 2,
    z: 0,
    tx: 4,
    ty: 2,
    tz: 1,
  };
  fx.event(event);
  const arcs = fx.items.filter((item) => item.kind === "arc");
  expect(arcs).toHaveLength(4);
  const transforms = arcs.map((item) => ({
    position: item.mesh.position.clone(),
    scale: item.mesh.scale.clone(),
    rotation: item.mesh.quaternion.clone(),
  }));
  fx.update(0.05, new T.PerspectiveCamera());
  arcs.forEach((item, i) => {
    expect(item.mesh.position.equals(transforms[i].position)).toBe(true);
    expect(item.mesh.scale.equals(transforms[i].scale)).toBe(true);
    expect(item.mesh.quaternion.equals(transforms[i].rotation)).toBe(true);
  });
  fx.update(0.3);
  expect(scene.children).toHaveLength(0);
  fx.event(event);
  expect(
    fx.items
      .filter((item) => item.kind === "arc")
      .every((item) => arcs.some((old) => old.mesh === item.mesh)),
  ).toBe(true);
  fx.clear();
});

it("途中で寿命が切れた演出だけを除き、残りの順序・移動・再利用を守る", () => {
  const scene = new T.Scene();
  const fx = new CombatEffects(scene);
  fx.add("spark", 0, 0, 0, 1, 1, 0xffffff, new T.Vector3(1, 0, 0));
  fx.add("spark", 1, 0, 0, 1, 0.1, 0xffffff);
  fx.add("spark", 2, 0, 0, 1, 1, 0xffffff);
  const list = fx.items,
    [first, expired, last] = list;
  fx.update(0.2);
  expect(fx.items).toBe(list);
  expect(fx.items).toEqual([first, last]);
  expect(first.mesh.position.x).toBeCloseTo(0.2);
  expect(scene.children).not.toContain(expired.mesh);
  fx.add("spark", 3, 0, 0, 1, 1, 0xffffff);
  expect(fx.items[2].mesh).toBe(expired.mesh);
  fx.update(2);
  expect(fx.items).toHaveLength(0);
  expect(scene.children).toHaveLength(0);
  fx.clear();
});
