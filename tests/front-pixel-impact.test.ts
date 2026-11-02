import { expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";
import { pixelImpactTextures } from "../src/client/pixel-impact";
import type { Event } from "../src/shared/game";

it("通常命中を短時間表示し、終了後に再利用する", () => {
  const scene = new T.Scene();
  const fx = new CombatEffects(scene);
  const camera = new T.PerspectiveCamera();
  camera.position.set(0, 2, 10);
  const hit = { id: 1, type: "hit", x: 0, y: 1, z: 0, amount: 10 } as Event;
  fx.event(hit);
  expect(fx.items).toHaveLength(1);
  const mesh = fx.items[0].mesh;
  expect(mesh.material.depthTest).toBe(true);
  expect(mesh.material.depthWrite).toBe(false);
  expect(mesh.material.map).toBe(pixelImpactTextures[0]);
  fx.update(0, camera);
  const position = mesh.position.clone();
  fx.update(0, camera);
  expect(mesh.position.equals(position)).toBe(true);
  fx.update(0.05, camera);
  expect(mesh.material.map).toBe(pixelImpactTextures[1]);
  fx.update(0.2, camera);
  expect(scene.children).toHaveLength(0);
  fx.event(hit);
  expect(fx.items[0].mesh).toBe(mesh);
  expect(mesh.material.map).toBe(pixelImpactTextures[0]);
  fx.event({ ...hit, guard: 1 });
  expect(fx.items).toHaveLength(1);
  fx.clear();
});

it("連続命中しても演出の上限を超えず、期限後に消える", () => {
  const fx = new CombatEffects(new T.Scene());
  const hit = { id: 1, type: "hit", x: 0, y: 1, z: 0, amount: 10 } as Event;
  for (let i = 0; i < 300; i++) fx.event(hit);
  expect(fx.items.length).toBe(24);
  fx.update(0.21, new T.PerspectiveCamera());
  expect(fx.items).toHaveLength(0);
  fx.event(hit);
  expect(fx.items).toHaveLength(1);
  fx.clear();
});

it("着弾画像は透明と不透明だけで、ピクセルを補間しない", () => {
  for (const texture of pixelImpactTextures) {
    expect(texture.magFilter).toBe(T.NearestFilter);
    expect(texture.minFilter).toBe(T.NearestFilter);
    const data = texture.image.data as Uint8Array;
    const alpha = Array.from(data).filter((_, i) => i % 4 === 3);
    expect(alpha).toContain(0);
    expect(alpha).toContain(255);
    expect(alpha.every((value) => value === 0 || value === 255)).toBe(true);
  }
});
