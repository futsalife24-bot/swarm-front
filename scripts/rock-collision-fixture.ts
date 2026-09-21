import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS, ELEVATED_MAPS, mapFor } from "../src/shared/stages";
import { liftMap } from "../src/client/terrain-view";
import { supportHeight } from "../src/shared/terrain";
import * as g from "../src/shared/game";
import { Renderer } from "../src/client/render";
import { prepareBattle } from "../src/client/battle-loading";

const output = document.querySelector("#result")!;
const results: unknown[] = [];
try {
  for (const map of [MAPS[3], ELEVATED_MAPS[3], MAPS[4], ELEVATED_MAPS[4]]) {
    const index = map.biome === "grass" ? 3 : 4;
    const { scene } = await new GLTFLoader().loadAsync(
      `/assets/maps/map_${index}_v1.glb`,
    );
    liftMap(scene, map);
    scene.updateMatrixWorld(true);
    let samples = 0,
      maxError = 0;
    for (const b of map.blocks)
      for (const fx of [-0.45, -0.3, -0.1, 0, 0.1, 0.3, 0.45])
        for (const fz of [-0.45, -0.3, -0.1, 0, 0.1, 0.3, 0.45]) {
          const x = b.x + b.w * fx,
            z = b.z + b.d * fz,
            y = b.h + 5;
          const ray = new T.Raycaster(
            new T.Vector3(x, y, z),
            new T.Vector3(0, -1, 0),
          );
          const hit = ray.intersectObject(scene, true)[0];
          if (!hit) throw Error("No GLB surface");
          const collision = g.wallDistance(x, y, z, 0, -1, 0, 100, map.blocks);
          maxError = Math.max(
            maxError,
            Math.abs(collision - hit.distance),
            Math.abs(supportHeight(x, z, map.blocks) - hit.point.y),
          );
          samples++;
        }
    results.push({ map: map.name, samples, maxError });
    if (maxError > 0.025)
      throw Error("Rendered rock mismatch: " + JSON.stringify(results));
    scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
  const view = new Renderer(document.querySelector("canvas")!);
  const world = g.createWorld("rock-proof", 42, 7),
    p = g.addPlayer(world, "p");
  world.phase = "battle";
  world.wave = 1;
  world.nextSpawn = 1e9;
  const map = mapFor(world),
    b = map.blocks[0];
  p.x = b.x - b.w / 2 - 0.8;
  p.z = b.z;
  p.y = supportHeight(p.x, p.z, map.blocks);
  await prepareBattle(view, world, "p", () => false);
  view.drone.enabled = true;
  view.drone.settings.radius = 14;
  view.drone.settings.height = 10;
  view.drone.settings.yaw = -1;
  const render = () => view.render(world, "p", 1 / 30, 0, 0, undefined, false);
  render();
  output.textContent = JSON.stringify(
    { status: "PASS", geometry: results },
    null,
    2,
  );
  document.querySelector("#jump")!.addEventListener("click", async () => {
    for (let n = 0; n < 200; n++) {
      const air = g.playerVerticalStep(
        p,
        { ...g.neutral(), jump: n < 150 && n % 24 === 0 },
        map.blocks,
        0.05,
      );
      g.move(
        p,
        Math.max(0, Math.min(0.1, b.x - p.x)),
        0,
        0.55,
        map.blocks,
        air,
        true,
      );
      render();
      await new Promise((r) => setTimeout(r, 16));
    }
    output.textContent = JSON.stringify(
      {
        status: Math.abs(p.y! - b.h) < 0.001 ? "PASS" : "FAIL",
        geometry: results,
        landing: { x: p.x, y: p.y, top: b.h, verticalSpeed: p.verticalSpeed },
      },
      null,
      2,
    );
  });
} catch (e) {
  output.textContent = "FAIL " + String(e);
  console.error(e);
}
