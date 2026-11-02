import { expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";
import { EnemySpawnEffects } from "../src/client/enemy-spawn-effects";
import {
  pixelDebrisTexture,
  pixelDustTexture,
  pixelFireTexture,
} from "../src/client/pixel-particles";
import { createWorld, spawn, start } from "../src/shared/game";
import { MAPS, STAGES, mapFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

it("爆風の範囲表示を保ちつつ炎と煙をドット調にする", () => {
  const scene = new T.Scene();
  const effects = new CombatEffects(scene);
  effects.event({ id: 1, type: "burst", x: 0, y: 1, z: 0, radius: 3.5 });
  const billows = effects.items.filter(
    (effect) => effect.kind === "pixel-billow",
  );
  const smoke = effects.items.filter((effect) => effect.kind === "pixel-smoke");
  expect(billows).toHaveLength(36);
  expect(smoke).toHaveLength(6);
  expect(
    billows.every((effect) => effect.mesh.material.map === pixelFireTexture),
  ).toBe(true);
  expect(
    smoke.every((effect) => effect.mesh.material.map === pixelDustTexture),
  ).toBe(true);
  const ring = effects.items.find((effect) => effect.kind === "ring")!;
  effects.update(0.25, new T.PerspectiveCamera());
  expect(ring.mesh.scale.x).toBeCloseTo(Math.sqrt(3.5 ** 2 - 1));
  expect(effects.items.some((effect) => effect.kind === "shell")).toBe(true);
  effects.update(2);
  expect(effects.items).toHaveLength(0);
  effects.clear();
});

it.each([
  "crawler",
  "ant",
  "spider",
  "spitter",
  "hornet",
  "bastion",
  "calyx",
  "harrow",
  "boss",
] as const)("%sの出現をドット調にし、停止・終了と事前準備を保つ", (kind) => {
  const scene = new T.Scene();
  const effects = new EnemySpawnEffects(scene);
  const world = createWorld("pixel-arrival", 11, 1);
  start(world);
  world.enemies = [];
  spawn(world, kind, 0, 0);
  const before = JSON.stringify(world);
  const camera = new T.PerspectiveCamera();
  effects.update(world, 0, true, camera);
  const item = [...effects.items.values()][0];
  expect(item.dust.material.map).toBe(pixelDustTexture);
  expect(item.stones.material.map).toBe(pixelDebrisTexture);
  expect(item.stones.geometry).toBeInstanceOf(T.PlaneGeometry);
  expect(
    effects.preparationRoots.some((root) =>
      root.children.some(
        (mesh) =>
          (mesh as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>).material
            .map === item.stones.material.map,
      ),
    ),
  ).toBe(true);
  effects.update(world, 0.1, false, camera);
  expect(item.age).toBe(0);
  for (let i = 0; i < 12; i++) effects.update(world, 0.1, true, camera);
  expect(effects.items.size).toBe(0);
  expect(JSON.stringify(world)).toBe(before);
  effects.clear();
});

it.each(["city", "grass", "snow", "cave"] as const)(
  "%sの出現で地面の高さと地形色を保つ",
  (biome) => {
    const stage = STAGES.find((entry) => MAPS[entry.map].biome === biome)!;
    const world = createWorld(`pixel-${biome}`, 11, stage.id);
    start(world);
    world.enemies = [];
    const enemy = spawn(world, "crawler", 0, 0);
    const effects = new EnemySpawnEffects(new T.Scene());
    effects.update(world, 0, true, new T.PerspectiveCamera());
    const item = effects.items.get(enemy.id)!;
    expect(item.origin.y).toBeCloseTo(
      supportHeight(enemy.x, enemy.z, mapFor(world).blocks) + 0.08,
    );
    expect(item.dust.material.color.getHex()).toBe(
      biome === "snow" ? 0xcbd7de : 0x998370,
    );
    effects.clear();
  },
);

it("ドット素材は補間せず、煙は敵を覆い隠さない透明度を使う", () => {
  for (const texture of [
    pixelFireTexture,
    pixelDustTexture,
    pixelDebrisTexture,
  ]) {
    expect(texture.magFilter).toBe(T.NearestFilter);
    expect(texture.minFilter).toBe(T.NearestFilter);
    const alpha = Array.from(texture.image.data as Uint8Array).filter(
      (_, index) => index % 4 === 3,
    );
    expect(alpha).toContain(0);
    expect(alpha.some((value) => value > 0)).toBe(true);
    if (texture === pixelDustTexture)
      expect(Math.max(...alpha)).toBeLessThan(160);
    else
      expect(alpha.every((value) => value === 0 || value === 255)).toBe(true);
  }
});

it("多数が同時出現しても上限を守り、演出終了後に再生し直さない", () => {
  const world = createWorld("pixel-crowd", 11, 1);
  start(world);
  world.enemies = [];
  for (let i = 0; i < 40; i++) spawn(world, i % 2 ? "hornet" : "crawler", i, 0);
  const before = JSON.stringify(world);
  const effects = new EnemySpawnEffects(new T.Scene());
  const camera = new T.PerspectiveCamera();
  effects.update(world, 0, true, camera);
  expect(effects.items.size).toBe(24);
  for (let i = 0; i < 12; i++) effects.update(world, 0.1, true, camera);
  expect(effects.items.size).toBe(0);
  effects.update(world, 0.1, true, camera);
  expect(effects.items.size).toBe(0);
  expect(JSON.stringify(world)).toBe(before);
  effects.clear();
});
