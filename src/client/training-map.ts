import * as T from "three";
import { TRAINING_MAP } from "../shared/stages";
export function trainingMapScene() {
  const group = new T.Group();
  group.name = "TRAINING_RANGE";
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  box(0, -0.1, -12, 50, 0.2, 74, TRAINING_MAP.ground);
  for (const b of TRAINING_MAP.blocks)
    box(b.x, b.h / 2, b.z, b.w, b.h, b.d, TRAINING_MAP.color);
  // Painted firing lanes and distance bands, flush with the floor.
  for (const x of [-16, -8, 0, 8, 16])
    box(x, 0.008, -12, 0.06, 0.01, 70, 0xb0c5bf);
  for (const distance of [10, 20, 30, 40, 50]) {
    const z = 16 - distance;
    box(0, 0.015, z, 46, 0.015, 0.1, 0xd7bc70);
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#d7bc70";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(distance + " m", 128, 48);
    const label = new T.Mesh(
      new T.PlaneGeometry(4, 1),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(19, 0.03, z + 1);
    group.add(label);
  }
  return group;
}
