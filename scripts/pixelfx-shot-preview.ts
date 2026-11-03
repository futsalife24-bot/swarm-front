import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";
import { pixelFxFrame } from "../src/client/pixelfx-atlas";

const scope = window as Window & {
  shotFxReady?: boolean;
  sampleShotFx?: (t: number) => unknown;
};
const scenes: T.Scene[] = [],
  cameras: T.PerspectiveCamera[] = [],
  renderers: T.WebGLRenderer[] = [],
  effects: CombatEffects[] = [];
for (let i = 0; i < 3; i++) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x29353b);
  scene.add(new T.HemisphereLight(0xd8efff, 0x4c4739, 2));
  const floor = new T.Mesh(
    new T.PlaneGeometry(18, 18),
    new T.MeshStandardMaterial({ color: 0x65705e }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor, new T.GridHelper(18, 18, 0x7f8a78, 0x6e7968));
  if (i === 1) {
    const enemy = new T.Mesh(
      new T.BoxGeometry(0.8, 1.5, 0.6),
      new T.MeshStandardMaterial({ color: 0x555c58 }),
    );
    enemy.position.y = 0.75;
    scene.add(enemy);
  }
  const camera = new T.PerspectiveCamera(42, 4 / 3, 0.1, 50);
  camera.position.set(3, 2.5, 6);
  camera.lookAt(0, 0.8, 0);
  const renderer = new T.WebGLRenderer({
    canvas: document.querySelectorAll("canvas")[i],
    antialias: true,
  });
  renderer.setSize(400, 300, false);
  scenes.push(scene);
  cameras.push(camera);
  renderers.push(renderer);
  effects.push(new CombatEffects(scene));
}
scope.sampleShotFx = (time) => {
  for (const fx of effects) fx.clear();
  effects[0].event({
    id: 1,
    type: "shot",
    x: 0,
    y: 0.8,
    z: 0,
    tx: 6,
    ty: 0.8,
    tz: 0,
    weapon: "rifle",
  });
  effects[1].event({ id: 2, type: "hit", x: 0, y: 0.85, z: 0, amount: 5 });
  effects[2].event({ id: 3, type: "acid", x: 0, y: 0.15, z: 0 });
  effects.forEach((fx, i) => fx.update(time, cameras[i]));
  renderers.forEach((renderer, i) => renderer.render(scenes[i], cameras[i]));
  const kinds = ["muzzle", "impact", "pixel-acid"];
  const names = ["muzzle", "impact", "acid"] as const;
  return kinds.map((kind, i) => {
    const effect = effects[i].items.find((item) => item.kind === kind);
    return {
      exists: !!effect,
      mapped:
        !!effect &&
        effect.mesh.material.map ===
          pixelFxFrame(names[i], time / effect.duration),
    };
  });
};
Object.defineProperty(scope, "shotFxReady", {
  get: () => !!pixelFxFrame("impact", 0),
});
