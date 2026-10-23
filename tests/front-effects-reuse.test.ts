import { expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";

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
