import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const assetPath = fileURLToPath(
  new URL("../public/assets/enemies/harrow_motion_v14.glb", import.meta.url),
);
const outputPath = fileURLToPath(
  new URL("../src/client/harrow-report-camera-profile.ts", import.meta.url),
);
const bytes = readFileSync(assetPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
// Geometry and bones suffice; Node does not decode the embedded 4K textures.
const loader = new GLTFLoader().register(() => ({
  name: "HEADLESS_GEOMETRY_ONLY",
  loadTexture: async () => new T.Texture(),
}));
const asset = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const rotationY = -Math.PI / 2;
asset.scene.rotation.y = rotationY;
asset.scene.updateMatrixWorld(true);
const viewDirection = [0.65, 0.4, -0.65];
const forward = new T.Vector3(...viewDirection).normalize();
const right = new T.Vector3(forward.z, 0, -forward.x).normalize();
const up = forward.clone().cross(right);
const steps = 12;
const binCount = 256;
const spinSteps = 60;
const motionSteps = 48;
const motionBuckets = 512;
const spinWind = 1.15;
const spinTurn = 1.05;
const yAxis = new T.Vector3(0, 1, 0);
const reportClips = [
  "Spin",
  "Dash",
  "Snipe",
  "Threat",
  "Takeoff",
  "Flight",
  "AirThreat",
  "BombPass",
  "Glide",
  "Dive",
  "Land",
  "TakeoffB",
  "TakeoffC",
  "TakeoffD",
  "StaggerFall",
];
const motionClips = ["Idle", "Locomotion", ...reportClips];
const loopingClips = new Set(["Idle", "Locomotion", "Flight"]);
function spinRotation(age) {
  const turn = Math.max(0, Math.min(1, (age - spinWind) / spinTurn));
  return Math.PI * 2 * turn * turn * (3 - 2 * turn);
}

function clipProfile(clipName, sampleSteps = steps, buckets = binCount) {
  const model = cloneSkeleton(asset.scene);
  const meshes = [];
  model.traverse((object) => {
    if (object instanceof T.SkinnedMesh) meshes.push(object);
  });
  const clip = asset.animations.find((item) => item.name === clipName);
  if (!clip || !meshes.length)
    throw new Error(`Missing HARROW ${clipName} geometry`);
  const vertices = meshes.reduce(
    (total, mesh) => total + mesh.geometry.getAttribute("position").count,
    0,
  );
  const positions = new Float32Array((sampleSteps + 1) * vertices * 3);
  const bounds = new T.Box3();
  const point = new T.Vector3();
  const mixer = new T.AnimationMixer(model);
  mixer.clipAction(clip).play();
  let offset = 0;
  for (let frame = 0; frame <= sampleSteps; frame++) {
    const sample = (clip.duration * frame) / sampleSteps;
    mixer.setTime(sample);
    model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const count = mesh.geometry.getAttribute("position").count;
      for (let i = 0; i < count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        if (clipName === "Spin")
          point.applyAxisAngle(yAxis, spinRotation(sample));
        bounds.expandByPoint(point);
        positions[offset++] = point.x;
        positions[offset++] = point.y;
        positions[offset++] = point.z;
      }
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);

  const center = bounds.getCenter(new T.Vector3());
  const projected = new Float32Array(positions.length);
  const horizontal = { extent: 0, depth: new Float32Array(buckets) };
  const vertical = { extent: 0, depth: new Float32Array(buckets) };
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center.x;
    const y = positions[i + 1] - center.y;
    const z = positions[i + 2] - center.z;
    const h = Math.abs(x * right.x + y * right.y + z * right.z);
    const v = Math.abs(x * up.x + y * up.y + z * up.z);
    projected[i] = h;
    projected[i + 1] = v;
    projected[i + 2] = x * forward.x + y * forward.y + z * forward.z;
    horizontal.extent = Math.max(horizontal.extent, h);
    vertical.extent = Math.max(vertical.extent, v);
  }
  horizontal.depth.fill(-Infinity);
  vertical.depth.fill(-Infinity);
  for (let i = 0; i < projected.length; i += 3) {
    const depth = projected[i + 2];
    for (const [value, bins] of [
      [projected[i], horizontal],
      [projected[i + 1], vertical],
    ]) {
      const bucket = bins.extent
        ? Math.min(buckets - 1, Math.floor((value / bins.extent) * buckets))
        : 0;
      bins.depth[bucket] = Math.max(bins.depth[bucket], depth);
    }
  }
  const packed = (bins) => ({
    extent: bins.extent,
    depth: Array.from(bins.depth, (value) =>
      Number.isFinite(value) ? value : null,
    ),
  });
  return {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    horizontal: packed(horizontal),
    vertical: packed(vertical),
  };
}

// For a camera tangent k, the required distance is max(depth + k * extent).
// Only the upper hull of those points can win for any aspect ratio or FOV.
function supportHull(positions, center, axis) {
  const depths = new Float64Array(motionBuckets).fill(-Infinity);
  let maxExtent = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center.x;
    const y = positions[i + 1] - center.y;
    const z = positions[i + 2] - center.z;
    maxExtent = Math.max(
      maxExtent,
      Math.abs(x * axis.x + y * axis.y + z * axis.z),
    );
  }
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center.x;
    const y = positions[i + 1] - center.y;
    const z = positions[i + 2] - center.z;
    const extent = Math.abs(x * axis.x + y * axis.y + z * axis.z);
    const bucket = maxExtent
      ? Math.min(
          motionBuckets - 1,
          Math.floor((extent / maxExtent) * motionBuckets),
        )
      : 0;
    depths[bucket] = Math.max(
      depths[bucket],
      x * forward.x + y * forward.y + z * forward.z,
    );
  }
  const hull = [];
  for (let i = 0; i < depths.length; i++) {
    if (!Number.isFinite(depths[i])) continue;
    // Bucket upper edges conservatively contain the original vertex extents.
    const next = [(maxExtent * (i + 1)) / motionBuckets, depths[i]];
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross =
        (b[0] - a[0]) * (next[1] - a[1]) - (b[1] - a[1]) * (next[0] - a[0]);
      if (cross < 0) break;
      hull.pop();
    }
    hull.push(next);
  }
  // Round upward so compact generated numbers never shrink the support bound.
  return hull.map(([extent, depth]) => [
    Math.ceil(extent * 100000) / 100000,
    Math.ceil(depth * 100000) / 100000,
  ]);
}

function motionProfile(clipName) {
  const model = cloneSkeleton(asset.scene);
  const meshes = [];
  model.traverse((object) => {
    if (object instanceof T.SkinnedMesh) meshes.push(object);
  });
  const clip = asset.animations.find((item) => item.name === clipName);
  if (!clip || !meshes.length)
    throw new Error(`Missing HARROW ${clipName} geometry`);
  const count = meshes.reduce(
    (total, mesh) => total + mesh.geometry.getAttribute("position").count,
    0,
  );
  const positions = new Float32Array(count * 3);
  const steps = clipName === "Spin" ? spinSteps : motionSteps;
  const mixer = new T.AnimationMixer(model);
  const action = mixer.clipAction(clip).reset();
  if (!loopingClips.has(clipName)) {
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
  }
  action.play();
  const point = new T.Vector3();
  const bounds = new T.Box3();
  const frames = [];
  for (let frame = 0; frame <= steps; frame++) {
    const sample = (clip.duration * frame) / steps;
    mixer.setTime(sample);
    model.updateMatrixWorld(true);
    bounds.makeEmpty();
    let offset = 0;
    for (const mesh of meshes) {
      const vertices = mesh.geometry.getAttribute("position").count;
      for (let i = 0; i < vertices; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        if (clipName === "Spin")
          point.applyAxisAngle(yAxis, spinRotation(sample));
        bounds.expandByPoint(point);
        positions[offset++] = point.x;
        positions[offset++] = point.y;
        positions[offset++] = point.z;
      }
    }
    const center = bounds.getCenter(new T.Vector3());
    frames.push({
      center: center
        .toArray()
        .map((value) => Math.round(value * 1000000) / 1000000),
      horizontal: supportHull(positions, center, right),
      vertical: supportHull(positions, center, up),
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  return { duration: clip.duration, frames };
}

const data = {
  source: {
    asset: "harrow_motion_v14.glb",
    sha256,
    rotationY,
    viewDirection,
    samplesPerClip: steps + 1,
    spinSamples: spinSteps + 1,
    motionSamples: motionSteps + 1,
    motionBuckets,
    spinWind,
    spinTurn,
  },
  idle: clipProfile("Idle"),
  move: clipProfile("Locomotion"),
  motion: Object.fromEntries(
    motionClips.map((clip) => [clip, motionProfile(clip)]),
  ),
};
const output =
  "// Generated by scripts/generate-harrow-report-profile.mjs. Do not edit by hand.\n" +
  "// prettier-ignore\n" +
  `export const HARROW_REPORT_PROFILE = ${JSON.stringify(data)};\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== output)
    throw new Error("HARROW report profile is stale; regenerate it.");
} else {
  writeFileSync(outputPath, output);
}
