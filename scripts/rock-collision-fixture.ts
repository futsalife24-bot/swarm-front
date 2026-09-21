import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS, ELEVATED_MAPS, mapFor } from "../src/shared/stages";
import { liftMap } from "../src/client/terrain-view";
import { supportHeight } from "../src/shared/terrain";
import * as g from "../src/shared/game";
import { Renderer } from "../src/client/render";
import { prepareBattle } from "../src/client/battle-loading";
import { ARENA_X, ARENA_Z } from "../src/shared/arena";

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
      maxError = 0,
      maxRockError = 0;
    let worst: unknown;
    for (const b of map.blocks) {
      const points: number[][] = [];
      for (const fx of [-0.45, -0.3, -0.1, 0, 0.1, 0.3, 0.45])
        for (const fz of [-0.45, -0.3, -0.1, 0, 0.1, 0.3, 0.45])
          points.push([b.x + b.w * fx, b.z + b.d * fz]);
      const ring = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
      ].map(([sx, sz], i) => {
        const scale = 0.35 * (1 + 0.1 * Math.sin(i * 4 + 10 + b.x));
        return [b.x + ((sx * b.w) / 2) * scale, b.z + ((sz * b.d) / 2) * scale];
      });
      for (let i = 0; i < 8; i++) {
        const a = ring[i],
          c = ring[(i + 1) % 8],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          length = Math.hypot(dx, dz);
        for (const t of [0.25, 0.5, 0.75])
          for (const offset of [-0.05, -0.025, 0.025, 0.05])
            points.push([
              a[0] + dx * t + (dz / length) * offset,
              a[1] + dz * t - (dx / length) * offset,
            ]);
      }
      for (const [x, z] of points) {
        const y = b.h + 5;
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
        if (!["meadow_ground", "granular_snow"].includes(hit.object.name))
          maxRockError = Math.max(
            maxRockError,
            Math.abs(collision - hit.distance),
          );
        for (const direction of [
          new T.Vector3(0.2, -1, 0.1),
          new T.Vector3(-0.15, -1, 0.2),
        ]) {
          direction.normalize();
          const origin = new T.Vector3(x, b.h, z).addScaledVector(
            direction,
            -6,
          );
          ray.set(origin, direction);
          // Distant scenery and decorative trees are deliberately non-solid.
          // Compare inside the playable arena and omit those decorations.
          const limit = Math.min(
            100,
            (Math.sign(direction.x) * ARENA_X - origin.x) / direction.x,
            (Math.sign(direction.z) * ARENA_Z - origin.z) / direction.z,
          );
          ray.far = limit;
          const oblique = ray
            .intersectObject(scene, true)
            .find((hit) => !["foliage", "tree_bark"].includes(hit.object.name));
          const contact = g.wallDistance(
            origin.x,
            origin.y,
            origin.z,
            direction.x,
            direction.y,
            direction.z,
            limit,
            map.blocks,
          );
          const error = Math.abs(contact - (oblique?.distance ?? limit));
          if (
            oblique &&
            !["meadow_ground", "granular_snow"].includes(oblique.object.name)
          )
            maxRockError = Math.max(maxRockError, error);
          if (error > maxError)
            worst = {
              x,
              z,
              origin: origin.toArray(),
              direction: direction.toArray(),
              contact,
              visual: oblique?.distance ?? limit,
              object: oblique?.object.name,
              point: oblique?.point.toArray(),
            };
          maxError = Math.max(maxError, error);
        }
        samples++;
      }
    }
    results.push({
      map: map.name,
      samples,
      rays: samples * 3,
      maxError,
      maxRockError,
      worst,
    });
    // Terrain uses the existing 1.5cm under-surface threshold and mesh
    // interpolation; an oblique ray can amplify its distance error.
    // Keep the rock tolerance separate so terrain cannot hide a rock defect.
    if (maxRockError > 0.001 || maxError > 0.05)
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
