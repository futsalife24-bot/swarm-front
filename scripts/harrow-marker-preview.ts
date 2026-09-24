import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MapAssets, VIEW_MAPS } from "../src/client/map-assets";
import { HarrowEffects } from "../src/client/harrow-effects";
import { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";
import { HARROW } from "../src/shared/harrow";
import { MAPS, TRAINING_MAP, stageFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

const scene = new T.Scene();
const renderer = new T.WebGLRenderer({
  canvas: document.querySelector("canvas")!,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const camera = new T.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 0.6;
scene.add(new T.HemisphereLight(0xdcecff, 0x787158, 2));
const sun = new T.DirectionalLight(0xfff0d9, 2.5);
sun.position.set(60, 100, 40);
scene.add(sun);
const maps = new MapAssets(scene);
const effects = new HarrowEffects();
scene.add(effects.root);
const sites = {
  slope: { map: MAPS[3], index: 3, x: 4, z: -35, radius: HARROW.spinRadius },
  rock: { map: MAPS[4], index: 4, x: -65.5, z: -10, radius: 2.5 },
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
  effects.update({
    time,
    stage: 20,
    training: selected === "flat",
    campaignPlan: { ...stageFor({ stage: 20 }), map: site.index },
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
  const mesh = effects.root.children[0] as TerrainProjectedMarkers;
  const position = mesh.geometry.getAttribute("position");
  const ray = new T.Raycaster();
  const samples = [];
  for (let i = 0; i < 72; i++) {
    const vertex = Math.floor((i / 72) * TerrainProjectedMarkers.segments) * 2;
    const x = position.getX(vertex),
      y = position.getY(vertex),
      z = position.getZ(vertex);
    ray.set(new T.Vector3(x, 100, z), new T.Vector3(0, -1, 0));
    const hit = ray.intersectObject(
      maps.groups[VIEW_MAPS.indexOf(site.map)],
      true,
    )[0];
    samples.push({
      angle: i * 5,
      markerY: y,
      support: supportHeight(x, z, site.map.blocks),
      mesh: hit?.object.name,
      renderY: hit?.point.y,
      buried: hit ? hit.point.y - y : null,
    });
  }
  document.getElementById("surface")!.textContent = JSON.stringify(
    {
      buried: samples.filter((s) => s.buried !== null && s.buried > 0),
      maxGap: Math.max(...samples.map((s) => s.buried ?? 0)),
      first: samples[0],
    },
    null,
    2,
  );
};
function frame() {
  controls.update();
  renderer.render(scene, camera);
  const site = sites[selected],
    marker = effects.root.children[0] as TerrainProjectedMarkers;
  status.textContent = JSON.stringify(
    {
      site: selected,
      map: site.map.name,
      model: maps.status[VIEW_MAPS.indexOf(site.map)],
      time,
      radius: site.radius,
      targetHeight: supportHeight(site.x, site.z, site.map.blocks),
      requested: count,
      markerCount: marker.count,
      markerIndices: marker.geometry.drawRange.count,
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
