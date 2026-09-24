import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VIEW_MAPS } from "../src/client/map-assets";
import { HarrowEffects } from "../src/client/harrow-effects";
import { Renderer } from "../src/client/render";
import { createWorld } from "../src/shared/game";
import type { Block } from "../src/shared/defs";
import { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";
import { HARROW } from "../src/shared/harrow";
import { MAPS, TRAINING_MAP, stageFor, mapFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";
import { ARENA_X, ARENA_Z } from "../src/shared/arena";

// Comparison fixture only: exact fad580b ring implementation, renamed to isolate it.

/** One draw call for a bounded pool of rings, with no per-frame geometry allocation. */
class LegacyTerrainProjectedMarkers extends T.Mesh<
  T.BufferGeometry,
  T.MeshBasicMaterial
> {
  static readonly segments = 512;
  private readonly verticesPerRing =
    (LegacyTerrainProjectedMarkers.segments + 1) * 2;
  private readonly indicesPerRing = LegacyTerrainProjectedMarkers.segments * 6;
  private readonly cache: Array<{
    x: number;
    y: number;
    z: number;
    radius: number;
    blocks?: Block[];
  }> = [];
  constructor(
    material: T.MeshBasicMaterial,
    readonly capacity: number,
  ) {
    const geometry = new T.BufferGeometry();
    const segments = LegacyTerrainProjectedMarkers.segments;
    const positions = new Float32Array(capacity * (segments + 1) * 2 * 3);
    const indices = new Uint32Array(capacity * segments * 6);
    for (let ring = 0; ring < capacity; ring++)
      for (let segment = 0; segment < segments; segment++) {
        const a = ring * (segments + 1) * 2 + segment * 2;
        indices.set(
          [a, a + 2, a + 1, a + 1, a + 2, a + 3],
          (ring * segments + segment) * 6,
        );
      }
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
    );
    geometry.setIndex(new T.BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    super(geometry, material);
    this.count = 0;
    this.frustumCulled = false;
  }
  setCount(value: number) {
    this.count = Math.min(this.capacity, Math.max(0, value));
    this.geometry.setDrawRange(0, this.count * this.indicesPerRing);
  }
  setRing(
    index: number,
    point: { x: number; y: number; z: number },
    radius: number,
    blocks?: Block[],
  ) {
    if (index >= this.capacity) return;
    const old = this.cache[index];
    if (
      old &&
      old.x === point.x &&
      old.y === point.y &&
      old.z === point.z &&
      old.radius === radius &&
      old.blocks === blocks
    )
      return;
    this.cache[index] = { ...point, radius, blocks };
    const position = this.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    for (
      let segment = 0;
      segment <= LegacyTerrainProjectedMarkers.segments;
      segment++
    ) {
      // Reuse angle zero for the seam so its two ends are exactly coincident.
      const angle =
        ((segment % LegacyTerrainProjectedMarkers.segments) /
          LegacyTerrainProjectedMarkers.segments) *
        Math.PI *
        2;
      for (let edge = 0; edge < 2; edge++) {
        const r = radius * (edge ? 1.055 : 0.945);
        const x = point.x + Math.cos(angle) * r;
        const z = point.z + Math.sin(angle) * r;
        const y = blocks ? supportHeight(x, z, blocks, point.y) : point.y;
        position.setXYZ(
          index * this.verticesPerRing + segment * 2 + edge,
          x,
          y + 0.12,
          z,
        );
      }
    }
    position.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
  }
}

const product = new Renderer(document.querySelector("canvas")!, 1);
const scene = product.scene,
  renderer = product.renderer,
  camera = product.camera;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 0.6;
const maps = product.mapAssets;
// Local fixture inspection only; the production Renderer owns and updates this view.
const effects = (product as unknown as { harrowEffects: HarrowEffects })
  .harrowEffects;
const legacyView = new LegacyTerrainProjectedMarkers(
  (effects.root.children[0] as TerrainProjectedMarkers).material,
  40,
);
scene.add(legacyView);
const world = createWorld("harrow-marker-qa", 723, 20);
world.phase = "battle";
let legacy = false;
const sites = {
  slope: { map: MAPS[3], index: 3, x: 4, z: -35, radius: HARROW.spinRadius },
  audit: {
    map: MAPS[3],
    index: 3,
    x: -68.972786,
    z: -51.436221,
    radius: HARROW.spinRadius,
  },
  rock: { map: MAPS[4], index: 4, x: -65.5, z: -10, radius: 2.5 },
  ridge: {
    map: MAPS[4],
    index: 4,
    x: -91.2,
    z: -77.54,
    radius: HARROW.spinRadius,
  },
  innerRidge: {
    map: MAPS[4],
    index: 4,
    x: -70,
    z: -73.4,
    radius: HARROW.diveRadius,
  },
  roof: { map: MAPS[1], index: 1, x: -58, z: -64, radius: 2.5 },
  flat: { map: TRAINING_MAP, index: 0, x: 0, z: 0, radius: 2.5 },
};
let selected: keyof typeof sites = "slope",
  time = 1,
  count = 1;
const status = document.querySelector("#status")!;
window.addEventListener("error", (event) => {
  document.querySelector("#errors")!.textContent += `${event.message}\n`;
});
window.addEventListener("unhandledrejection", (event) => {
  document.querySelector("#errors")!.textContent += `${event.reason}\n`;
});
function cameraView(view: "top" | "low" | "oblique") {
  const site = sites[selected];
  const y = supportHeight(site.x, site.z, site.map.blocks);
  const distance = Math.max(10, site.radius * 3.5);
  controls.target.set(site.x, y, site.z);
  camera.position.set(
    site.x + (view === "top" ? 0 : distance * 0.55),
    y + distance * (view === "top" ? 1 : view === "low" ? 0.18 : 0.75),
    site.z + (view === "top" ? 0.01 : distance * 0.6),
  );
  controls.update();
}
function update() {
  const site = sites[selected],
    blocks = site.map.blocks;
  const y = supportHeight(site.x, site.z, blocks);
  Object.assign(world, {
    time,
    stage: 20,
    training: selected === "flat",
    campaignPlan: {
      ...stageFor({ stage: 20 }),
      map: site.index,
      elevated: false,
    },
    harrowMissiles: Array.from({ length: count }, (_, id) => ({
      id,
      owner: 1,
      origin: { x: site.x, y: y + 10, z: site.z },
      target: { x: site.x, y: y + 0.06, z: site.z },
      launch: 2,
      impact: 5,
      damage: 0,
      radius: site.radius,
    })),
  });
  effects.update(world);
  for (let i = 0; i < Math.min(count, 40); i++)
    legacyView.setRing(
      i,
      { x: site.x, y: y + 0.06, z: site.z },
      site.radius,
      blocks,
    );
  legacyView.setCount(time < 5 ? count : 0);
  effects.root.visible = !legacy;
  legacyView.visible = legacy;
}
function select(site: keyof typeof sites) {
  selected = site;
  time = 1;
  count = 1;
  const data = sites[selected];
  maps.select(VIEW_MAPS.indexOf(data.map), true, false);
  renderer.setClearColor(data.map.sky);
  cameraView("oblique");
  update();
}
document
  .querySelectorAll<HTMLButtonElement>("[data-site]")
  .forEach((button) => {
    button.onclick = () => select(button.dataset.site as keyof typeof sites);
  });
for (const mode of ["top", "low", "oblique"] as const)
  document.getElementById(mode)!.onclick = () => cameraView(mode);
document.getElementById("orbit")!.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
};
document.getElementById("comparison")!.onclick = () => {
  legacy = !legacy;
  document.getElementById("comparison")!.textContent = legacy
    ? "新リングへ切替"
    : "旧リングへ切替";
  document.getElementById("surface")!.textContent = "";
  update();
};
for (const [id, value] of [
  ["warning", 1],
  ["flight", 2.5],
  ["impact", 5],
] as const)
  document.getElementById(id)!.onclick = () => {
    time = value;
    count = 1;
    update();
  };
document.getElementById("capacity")!.onclick = () => {
  time = 2.5;
  count = 50;
  update();
};
window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
select("slope");
document.getElementById("surface-check")!.onclick = () => {
  scene.updateMatrixWorld(true);
  const site = sites[selected];
  const mesh = legacy
    ? legacyView
    : (effects.root.children[0] as TerrainProjectedMarkers);
  const position = mesh.geometry.getAttribute("position");
  mesh.geometry.computeBoundingSphere();
  const ray = new T.Raycaster();
  const samples = [];
  for (let i = 0; i < 72; i++) {
    const triangle = Math.floor(((i / 72) * mesh.geometry.drawRange.count) / 3);
    const ids = mesh.geometry.index!;
    const a = ids.getX(triangle * 3),
      b = ids.getX(triangle * 3 + 1),
      c = ids.getX(triangle * 3 + 2);
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    ray.set(new T.Vector3(x, 100, z), new T.Vector3(0, -1, 0));
    const markerHit = ray.intersectObject(mesh, false)[0];
    const hit = ray.intersectObject(
      maps.groups[VIEW_MAPS.indexOf(site.map)],
      true,
    )[0];
    samples.push({
      triangle,
      x,
      z,
      offArena: Math.abs(x) > ARENA_X || Math.abs(z) > ARENA_Z,
      markerY: markerHit?.point.y,
      support: supportHeight(x, z, site.map.blocks),
      mesh: hit?.object.name,
      renderY: hit?.point.y,
      buried: hit && markerHit ? hit.point.y - markerHit.point.y : null,
    });
  }
  document.getElementById("surface")!.textContent = JSON.stringify(
    {
      buried: samples.filter((s) => s.buried !== null && s.buried > 0),
      playableBuried: samples.filter(
        (s) => !s.offArena && s.buried !== null && s.buried > 0,
      ),
      offArenaSamples: samples.filter((s) => s.offArena),
      maxGap: samples.some((s) => s.buried !== null)
        ? Math.max(
            ...samples.filter((s) => s.buried !== null).map((s) => s.buried!),
          )
        : null,
      maxPlayableGap: samples.some((s) => !s.offArena && s.buried !== null)
        ? Math.max(
            ...samples
              .filter((s) => !s.offArena && s.buried !== null)
              .map((s) => s.buried!),
          )
        : null,
      first: samples[0],
      missingMarker: samples.filter((s) => s.markerY === undefined),
      missingSurface: samples.filter((s) => s.renderY === undefined),
      modelReady: maps.status[VIEW_MAPS.indexOf(site.map)].state === "ready",
      worldMapMatches: mapFor(world) === site.map,
    },
    null,
    2,
  );
};
document.getElementById("save-evidence")!.onclick = async () => {
  const saved = document.getElementById("saved")!;
  saved.textContent = "saving";
  try {
    if (
      maps.status[VIEW_MAPS.indexOf(sites[selected].map)].state !== "ready" ||
      mapFor(world) !== sites[selected].map
    )
      throw new Error(
        "Selected production map must be ready before saving evidence",
      );
    document.getElementById("surface-check")!.click();
    const surface = JSON.parse(
      document.getElementById("surface")!.textContent!,
    );
    if (surface.missingMarker.length || surface.missingSurface.length)
      throw new Error(
        "Missing marker/surface intersections: evidence was not saved",
      );
    renderer.render(scene, camera);
    const png = await new Promise<Blob>((resolve, reject) =>
      renderer.domElement.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG capture failed")),
        "image/png",
      ),
    );
    const site = sites[selected];
    const metadata = JSON.stringify({
      site: selected,
      mode: legacy ? "before-fad580b" : "after-clipped",
      position: {
        x: site.x,
        y: supportHeight(site.x, site.z, site.map.blocks),
        z: site.z,
      },
      radius: site.radius,
      surface: JSON.parse(document.getElementById("surface")!.textContent!),
      status: JSON.parse(status.textContent!),
    }).replace(
      /[^\x00-\x7f]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    const response = await fetch("/__harrow-marker", {
      method: "POST",
      headers: {
        "x-harrow-marker-name": `${selected.toLowerCase()}-${legacy ? "before" : "after"}`,
        "x-harrow-metadata": encodeURIComponent(metadata),
      },
      body: png,
    });
    const result = await response.text();
    if (!response.ok) throw new Error(result);
    saved.textContent = result;
  } catch (error) {
    saved.textContent = String(error);
  }
};
const heldPosition = new T.Vector3(),
  heldRotation = new T.Quaternion();
function frame() {
  controls.update();
  heldPosition.copy(camera.position);
  heldRotation.copy(camera.quaternion);
  product.render(world, "", 1 / 60, 0, 0, undefined, false);
  camera.position.copy(heldPosition);
  camera.quaternion.copy(heldRotation);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  const site = sites[selected],
    marker = effects.root.children[0] as TerrainProjectedMarkers;
  status.textContent = JSON.stringify(
    {
      site: selected,
      mode: legacy ? "before-fad580b" : "after-clipped",
      rendererPath: "production Renderer.render with diagnostic camera",
      map: site.map.name,
      worldMap: mapFor(world).name,
      worldMapMatches: mapFor(world) === site.map,
      model: maps.status[VIEW_MAPS.indexOf(site.map)],
      time,
      radius: site.radius,
      targetHeight: supportHeight(site.x, site.z, site.map.blocks),
      requested: count,
      markerCount: marker.count,
      markerIndices: legacy
        ? legacyView.geometry.drawRange.count
        : marker.geometry.drawRange.count,
      markerTriangles: marker.ringInfo(0)?.triangles,
      markerWidthFactor: marker.ringInfo(0)?.widthFactor,
      missileCount: (effects.root.children[1] as T.InstancedMesh).count,
      effectObjects: effects.root.children.length,
      depthTest: marker.material.depthTest,
      camera: camera.position.toArray().map((v) => +v.toFixed(2)),
    },
    null,
    2,
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
