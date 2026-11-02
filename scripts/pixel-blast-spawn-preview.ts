import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CombatEffects } from "../src/client/combat-effects";
import { EnemySpawnEffects } from "../src/client/enemy-spawn-effects";
import { createWorld, spawn, start } from "../src/shared/game";

type PreviewWindow = Window & {
  fxModels: Record<string, string>;
  sampleFx?: (seconds: number) => unknown;
  checkFxOcclusion?: () => boolean[];
  fxReady?: boolean;
};

async function main() {
  const scope = window as PreviewWindow;
  const loader = new GLTFLoader();
  const parse = async (name: string) => {
    const bytes = Uint8Array.from(atob(scope.fxModels[name]), (c) =>
      c.charCodeAt(0),
    );
    return (await loader.parseAsync(bytes.buffer, "")).scene;
  };
  const [hound, ray] = await Promise.all([parse("hound"), parse("ray")]);
  const scenes: T.Scene[] = [];
  const cameras: T.PerspectiveCamera[] = [];
  const renderers: T.WebGLRenderer[] = [];
  const fx: (CombatEffects | EnemySpawnEffects)[] = [];
  const worlds = ["crawler", "hornet"].map((kind) => {
    const world = createWorld(`pixel-preview-${kind}`, 11, 1);
    start(world);
    world.enemies = [];
    spawn(world, kind as "crawler" | "hornet", 0, 0);
    return world;
  });
  for (let i = 0; i < 3; i++) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x29353b);
    scene.add(new T.HemisphereLight(0xd8efff, 0x4c4739, 2));
    const floor = new T.Mesh(
      new T.PlaneGeometry(30, 30),
      new T.MeshStandardMaterial({ color: 0x65705e }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor, new T.GridHelper(30, 30, 0x7f8a78, 0x6e7968));
    if (i > 0) {
      const model = cloneSkeleton(i === 1 ? hound : ray);
      model.name = "PREVIEW_MODEL";
      const box = new T.Box3().setFromObject(model);
      const size = box.getSize(new T.Vector3());
      const center = box.getCenter(new T.Vector3());
      model.position.sub(center);
      model.scale.setScalar(2.4 / Math.max(size.x, size.y, size.z));
      model.position.multiplyScalar(model.scale.x);
      model.position.y += worlds[i - 1].enemies[0].y + 1.1;
      scene.add(model);
    }
    const camera = new T.PerspectiveCamera(42, 4 / 3, 0.1, 100);
    camera.position.set(8, i === 2 ? 10 : 5, 12);
    camera.lookAt(0, i === 2 ? worlds[1].enemies[0].y + 0.5 : 1, 0);
    const renderer = new T.WebGLRenderer({
      canvas: document.querySelectorAll("canvas")[i],
      antialias: true,
    });
    renderer.setSize(400, 300, false);
    scenes.push(scene);
    cameras.push(camera);
    renderers.push(renderer);
    fx.push(i === 0 ? new CombatEffects(scene) : new EnemySpawnEffects(scene));
  }
  scope.sampleFx = (seconds) => {
    const blast = fx[0] as CombatEffects;
    blast.clear();
    blast.event({ id: 1, type: "burst", x: 0, y: 0.2, z: 0, radius: 3.5 });
    blast.update(seconds, cameras[0]);
    for (let i = 1; i < 3; i++) {
      const arrival = fx[i] as EnemySpawnEffects;
      arrival.clear();
      arrival.update(worlds[i - 1], 0, true, cameras[i]);
      for (let elapsed = 0; elapsed < seconds - 0.001; elapsed += 0.1)
        arrival.update(
          worlds[i - 1],
          Math.min(0.1, seconds - elapsed),
          true,
          cameras[i],
        );
    }
    scenes.forEach((scene, i) => renderers[i].render(scene, cameras[i]));
    return {
      blast: blast.items.length,
      arrivals: [1, 2].map((i) => (fx[i] as EnemySpawnEffects).items.size),
      origins: [1, 2].map((i) =>
        [...(fx[i] as EnemySpawnEffects).items.values()][0]?.origin.toArray(),
      ),
      enemies: worlds.map((world) => ({
        y: world.enemies[0].y,
        kind: world.enemies[0].kind,
      })),
      modelCenters: [1, 2].map((i) =>
        new T.Box3()
          .setFromObject(scenes[i].getObjectByName("PREVIEW_MODEL")!)
          .getCenter(new T.Vector3())
          .toArray(),
      ),
      calls: renderers.map((renderer) => renderer.info.render.calls),
    };
  };
  scope.sampleFx(0.3);
  scope.checkFxOcclusion = () => {
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      scope.sampleFx!(0.3);
      const wall = new T.Mesh(
        new T.PlaneGeometry(50, 50),
        new T.MeshBasicMaterial({ color: 0x49545c, side: T.DoubleSide }),
      );
      wall.position.copy(cameras[i].position);
      wall.position.addScaledVector(
        cameras[i].getWorldDirection(new T.Vector3()),
        3,
      );
      wall.quaternion.copy(cameras[i].quaternion);
      scenes[i].add(wall);
      renderers[i].render(scenes[i], cameras[i]);
      const withEffects = renderers[i].domElement.toDataURL();
      fx[i].clear();
      renderers[i].render(scenes[i], cameras[i]);
      results.push(withEffects === renderers[i].domElement.toDataURL());
      scenes[i].remove(wall);
      wall.geometry.dispose();
      wall.material.dispose();
    }
    return results;
  };
  scope.fxReady = true;
}
main().catch((error) => {
  console.error(error);
  throw error;
});
