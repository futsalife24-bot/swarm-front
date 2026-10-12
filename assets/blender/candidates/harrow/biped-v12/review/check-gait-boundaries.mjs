import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const glb = path.resolve(dir, "../harrow.glb");
const bytes = readFileSync(glb);
const loader = new GLTFLoader().register(() => ({
  name: "HEADLESS_GEOMETRY_ONLY",
  loadTexture: async () => new T.Texture(),
}));
const { scene, animations } = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
scene.rotation.y = -Math.PI / 2;
scene.updateMatrixWorld(true);
const mixer = new T.AnimationMixer(scene);
const clips = new Map(animations.map((clip) => [clip.name, clip]));
const bones = [];
const feetMeshes = {};
scene.traverse((object) => {
  if (object instanceof T.Bone) bones.push(object);
  if (object instanceof T.SkinnedMesh && object.name.startsWith("Hindlimb"))
    feetMeshes[object.name.includes("L") ? "L" : "R"] = object;
});
assert.equal(bones.length, 39);
assert.ok(feetMeshes.L && feetMeshes.R, "two skinned hindlimbs");
const SCALE = 1.95;
const SPEED = 0.64;
const STEP = 1 / 60;
function pose(name, t) {
  mixer.stopAllAction();
  const clip = clips.get(name);
  assert.ok(clip, name);
  const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(Math.min(clip.duration, t));
  scene.updateMatrixWorld(true);
}
const toe = {};
for (const side of ["L", "R"]) {
  const mesh = feetMeshes[side];
  let lowest = Infinity,
    index = -1;
  for (const time of [0, 0.7, 1.4]) {
    pose("Locomotion", time);
    mesh.skeleton.update();
    for (
      let vertex = 0;
      vertex < mesh.geometry.getAttribute("position").count;
      vertex++
    ) {
      const p = mesh
        .getVertexPosition(vertex, new T.Vector3())
        .applyMatrix4(mesh.matrixWorld);
      if (p.y < lowest) {
        lowest = p.y;
        index = vertex;
      }
    }
  }
  toe[side] = { vertex: index, selectionY: lowest * SCALE };
}
const gait = [];
const duration = clips.get("Locomotion").duration;
for (let frame = 0; frame <= Math.round(duration / STEP); frame++) {
  const time = Math.min(duration, frame * STEP);
  pose("Locomotion", time);
  const feet = Object.fromEntries(
    ["L", "R"].map((side) => {
      const mesh = feetMeshes[side];
      mesh.skeleton.update();
      const p = mesh
        .getVertexPosition(toe[side].vertex, new T.Vector3())
        .applyMatrix4(mesh.matrixWorld);
      // Renderer rotates the authored -Z forward by PI; authority advances +Z.
      return [
        side,
        { x: -p.x * SCALE, y: p.y * SCALE, z: -p.z * SCALE + SPEED * time },
      ];
    }),
  );
  gait.push({ time, feet });
}
const contact = {};
for (const side of ["L", "R"]) {
  const low = Math.min(...gait.map((frame) => frame.feet[side].y));
  const threshold = low + 0.08;
  const intervals = [];
  let begin = -1;
  for (let i = 0; i <= gait.length; i++) {
    const touching = i < gait.length && gait[i].feet[side].y <= threshold;
    if (touching && begin < 0) begin = i;
    if (!touching && begin >= 0) {
      if ((i - begin) * STEP >= 0.18) {
        const points = gait.slice(begin, i).map((frame) => frame.feet[side]);
        const origin = points[0];
        const distance = points.map((p) =>
          Math.hypot(p.x - origin.x, p.z - origin.z),
        );
        intervals.push({
          startTime: gait[begin].time,
          endTime: gait[i - 1].time,
          worldDriftMeters: Math.max(...distance),
          startPosition: points[0],
          finishPosition: points.at(-1),
        });
      }
      begin = -1;
    }
  }
  contact[side] = {
    toeVertex: toe[side].vertex,
    lowestToeY: low,
    stanceThresholdY: threshold,
    intervals,
    maximumWorldDriftMeters: Math.max(
      0,
      ...intervals.map((x) => x.worldDriftMeters),
    ),
  };
}
function snapshot(name, time) {
  pose(name, time);
  return new Map(
    bones.map((bone) => [
      bone.name,
      bone.getWorldPosition(new T.Vector3()).multiplyScalar(SCALE),
    ]),
  );
}
const pairs = [
  ["Idle", "Locomotion"],
  ["Locomotion", "Idle"],
  ...["Takeoff", "TakeoffB", "TakeoffC", "TakeoffD"].flatMap((name) => [
    ["Idle", name],
    [name, "Flight"],
  ]),
  ["Flight", "Glide"],
  ["Glide", "Dive"],
  ["Dive", "Land"],
  ["Land", "Idle"],
];
const boundaries = pairs.map(([from, to]) => {
  const previous = snapshot(from, clips.get(from).duration);
  const next = snapshot(to, 0);
  const displacement = [...previous]
    .map(([bone, p]) => ({
      bone,
      gameMeters: p.distanceTo(next.get(bone)),
    }))
    .sort((a, b) => b.gameMeters - a.gameMeters);
  return {
    from,
    to,
    maximumGameMeters: displacement[0].gameMeters,
    largestBones: displacement.slice(0, 6),
  };
});
const report = {
  asset: path.relative(path.resolve(dir, ".."), glb),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  method:
    "60 Hz animation samples; fixed lowest skinned toe vertex selected from each Hindlimb mesh at 0/0.7/1.4s; authority +Z at 0.64 m/s, scale 1.95; stance when toe vertex is within 0.08m of its cycle minimum for at least 0.18s; boundaries compare all 39 bone origins at source end and destination start in game meters with common root translation.",
  gait: { duration, authorityDistanceMeters: SPEED * duration, contact },
  boundaries,
};
writeFileSync(
  path.join(dir, "gait-boundaries.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    gait: report.gait,
    boundaries: boundaries.map(
      ({ from, to, maximumGameMeters, largestBones }) => ({
        from,
        to,
        maximumGameMeters,
        bone: largestBones[0].bone,
      }),
    ),
  }),
);
