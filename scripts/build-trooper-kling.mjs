/** Reconstruct reference timing on the unchanged v9 rig. Metres, Y up, -Z forward.
 * No video tracking or generated anatomy is copied. Run with node from repo root.
 * The resulting GLB is also imported by save_trooper_kling.py as editable 60fps Blender curves. */
import * as T from "three";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const source = "public/assets/characters/standard_trooper_v9.glb";
const target = "public/assets/characters/standard_trooper_v10.glb";
const raw = fs.readFileSync(source),
  length = raw.readUInt32LE(12);
const original = JSON.parse(raw.subarray(20, 20 + length)),
  doc = structuredClone(original),
  binary = raw.subarray(28 + length);
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const cache = new Map();
function read(i) {
  if (cache.has(i)) return cache.get(i);
  const a = original.accessors[i],
    v = original.bufferViews[a.bufferView],
    n = sizes[a.type],
    bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
    out = [];
  for (let j = 0; j < a.count; j++)
    for (let k = 0; k < n; k++) {
      const p =
        (v.byteOffset ?? 0) +
        (a.byteOffset ?? 0) +
        j * (v.byteStride ?? n * bytes) +
        k * bytes;
      out.push(
        a.componentType === 5126
          ? binary.readFloatLE(p)
          : bytes === 4
            ? binary.readUInt32LE(p)
            : bytes === 2
              ? binary.readUInt16LE(p)
              : binary[p],
      );
    }
  cache.set(i, out);
  return out;
}
const objects = doc.nodes.map((n) => {
  const o = new T.Object3D();
  o.name = n.name;
  if (n.matrix) o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));
  else {
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
  }
  return o;
});
doc.nodes.forEach((n, i) =>
  n.children?.forEach((c) => objects[i].add(objects[c])),
);
const roots = doc.scenes[doc.scene ?? 0].nodes.map((i) => objects[i]);
const update = () => roots.forEach((o) => o.updateMatrixWorld(true));
update();
const by = new Map(objects.map((o) => [o.name, o])),
  joints = doc.skins[0].joints;
const rest = objects.map((o) => ({
  p: o.position.clone(),
  q: o.quaternion.clone(),
  s: o.scale.clone(),
  m: o.matrixWorld.clone(),
}));
const reset = () => {
  objects.forEach((o, i) => {
    o.position.copy(rest[i].p);
    o.quaternion.copy(rest[i].q);
    o.scale.copy(rest[i].s);
  });
  update();
};
const pos = (n) => by.get(n).getWorldPosition(new T.Vector3());
function world(n, m) {
  const o = by.get(n);
  o.parent.matrixWorld
    .clone()
    .invert()
    .multiply(m)
    .decompose(o.position, o.quaternion, o.scale);
  o.updateWorldMatrix(false, true);
}
function sample(name, time = 0) {
  reset();
  const clip = original.animations.find((a) => a.name === name);
  assert.ok(clip, name);
  for (const c of clip.channels) {
    const s = clip.samplers[c.sampler],
      times = read(s.input),
      v = read(s.output),
      n = sizes[original.accessors[s.output].type];
    let i = 0;
    while (i < times.length - 2 && times[i + 1] < time) i++;
    const j = Math.min(i + 1, times.length - 1),
      u =
        times[j] === times[i]
          ? 0
          : T.MathUtils.clamp((time - times[i]) / (times[j] - times[i]), 0, 1),
      o = objects[c.target.node];
    if (c.target.path === "rotation")
      o.quaternion
        .fromArray(v, i * n)
        .slerp(new T.Quaternion().fromArray(v, j * n), u);
    else
      o[c.target.path === "translation" ? "position" : "scale"]
        .fromArray(v, i * n)
        .lerp(new T.Vector3().fromArray(v, j * n), u);
  }
  update();
}
function turn(n, from, to) {
  const o = by.get(n),
    q = new T.Quaternion()
      .setFromUnitVectors(from.normalize(), to.normalize())
      .multiply(o.getWorldQuaternion(new T.Quaternion()));
  o.quaternion.copy(
    o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q),
  );
  o.updateWorldMatrix(false, true);
}
let maxClamp = 0;
function solve(upper, lower, end, target, pole) {
  const a = pos(upper),
    b = pos(lower),
    c = pos(end),
    l1 = a.distanceTo(b),
    l2 = b.distanceTo(c),
    axis = target.clone().sub(a),
    d = axis.length(),
    len = T.MathUtils.clamp(d, Math.abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5);
  maxClamp = Math.max(maxClamp, Math.abs(d - len));
  axis.normalize();
  const p = pole.clone().addScaledVector(axis, -pole.dot(axis)).normalize(),
    along = (l1 * l1 - l2 * l2 + len * len) / (2 * len),
    knee = a
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(p, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  turn(upper, b.sub(a), knee.sub(a));
  turn(lower, pos(end).sub(pos(lower)), target.clone().sub(pos(lower)));
}
const around = (p, q) =>
  new T.Matrix4()
    .makeTranslation(...p.toArray())
    .multiply(new T.Matrix4().makeRotationFromQuaternion(q))
    .multiply(new T.Matrix4().makeTranslation(...p.clone().negate().toArray()));
const qx = (a) =>
  new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), a);
const qy = (a) =>
  new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a);
const smooth = (u) => {
  u = T.MathUtils.clamp(u, 0, 1);
  return u * u * (3 - 2 * u);
};
function curve(t, keys) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, x, m] = keys[i],
      [b, y, n] = keys[i + 1];
    if (t >= a && t <= b) {
      const u = (t - a) / (b - a);
      return (
        (2 * u ** 3 - 3 * u * u + 1) * x +
        (u ** 3 - 2 * u * u + u) * (b - a) * m +
        (-2 * u ** 3 + 3 * u * u) * y +
        (u ** 3 - u * u) * (b - a) * n
      );
    }
  }
  return keys.at(-1)[1];
}
// Actual weighted boot/toe vertices expressed in a world-aligned ankle frame.
reset();
const soles = { L: [], R: [] };
doc.nodes.forEach((node, ni) => {
  if (node.mesh === undefined || node.skin === undefined) return;
  for (const p of original.meshes[node.mesh].primitives) {
    if (p.attributes.JOINTS_0 === undefined) continue;
    const xyz = read(p.attributes.POSITION),
      js = read(p.attributes.JOINTS_0),
      ws = read(p.attributes.WEIGHTS_0);
    for (let i = 0; i < xyz.length / 3; i++)
      for (const side of ["L", "R"])
        if (
          [0, 1, 2, 3].some(
            (k) =>
              ws[i * 4 + k] > 0.5 &&
              ["Foot_" + side, "Toe_" + side].includes(
                doc.nodes[joints[js[i * 4 + k]]].name,
              ),
          )
        )
          soles[side].push(
            new T.Vector3()
              .fromArray(xyz, i * 3)
              .applyMatrix4(rest[ni].m)
              .sub(pos("Foot_" + side)),
          );
  }
});
const footRest = Object.fromEntries(
  ["L", "R"].map((s) => [s, by.get("Foot_" + s).matrixWorld.clone()]),
);
const upperNames = joints
  .map((i) => doc.nodes[i].name)
  .filter((n) => !/^(Root|Pelvis|UpperLeg_|LowerLeg_|Foot_|Toe_)/.test(n));
const aimSources = {};
for (const profile of ["Rifle", "Shotgun", "Rocket"]) {
  sample("Trial_Weapon_Idle_" + profile);
  aimSources[profile] = Object.fromEntries(
    joints.map((i) => [doc.nodes[i].name, objects[i].matrixWorld.clone()]),
  );
}
// Transform both grip frames together, then solve the two elbow chains. Socket
// and finger local transforms are never edited. Shoulder heads follow the chest.
function upperPose(profile, low, phase = 0, moving = false, lean = 0.035) {
  const src = aimSources[profile],
    pelvis = pos("Pelvis"),
    base = new T.Vector3().setFromMatrixPosition(src.Pelvis),
    delta = new T.Matrix4().makeTranslation(
      ...pelvis.clone().sub(base).toArray(),
    );
  const pivot = new T.Vector3().setFromMatrixPosition(src.Chest),
    twist = moving ? 0.026 * Math.sin(phase * Math.PI * 2) : 0;
  const chestDelta = delta
    .clone()
    .multiply(
      around(
        pivot,
        qy(-twist).multiply(
          qx(moving ? lean : profile === "Rocket" ? 0 : 0.025 * (1 - low)),
        ),
      ),
    );
  for (const n of upperNames) world(n, chestDelta.clone().multiply(src[n]));
  if (profile === "Rocket") return;
  const chest = pos("Chest"),
    gripDelta = around(chest, qx(-0.43 * low)).premultiply(
      new T.Matrix4().makeTranslation(0, 0.045 * low, 0.095 * low),
    );
  const handTargets = Object.fromEntries(
    ["L", "R"].map((s) => [
      s,
      gripDelta.clone().multiply(by.get("Hand_" + s).matrixWorld),
    ]),
  );
  for (const s of ["L", "R"]) {
    const clavicle = by.get("Clavicle_" + s);
    clavicle.quaternion.multiply(qx(-0.015 * low));
    clavicle.updateWorldMatrix(false, true);
    const target = handTargets[s],
      pole = new T.Vector3(s === "L" ? -0.35 : 0.35, -1, 0.15);
    solve(
      "UpperArm_" + s,
      "LowerArm_" + s,
      "Hand_" + s,
      new T.Vector3().setFromMatrixPosition(target),
      pole,
    );
    world("Hand_" + s, target);
  }
  // Small neck/head settling, delayed relative to raising the rifle.
  const head = by.get("Head");
  head.quaternion.multiply(qx(-0.045 * low * low));
  head.updateWorldMatrix(false, true);
}
function legPose(side, target, rotation) {
  solve(
    "UpperLeg_" + side,
    "LowerLeg_" + side,
    "Foot_" + side,
    target,
    new T.Vector3(side === "L" ? -0.035 : 0.035, 0, -1),
  );
  const m = new T.Matrix4()
    .makeRotationFromQuaternion(rotation)
    .multiply(footRest[side].clone().setPosition(0, 0, 0));
  m.setPosition(target);
  world("Foot_" + side, m);
}
const specs = {
  Walk: { stride: 1.3, stance: 0.6, duration: 1.0, lift: 0.105, width: 0.36 },
  Run: { stride: 3.6, stance: 0.22, duration: 0.64, lift: 0.12, width: 0.36 },
};
function gait(name, phase, profile) {
  const spec = specs[name],
    run = name === "Run";
  sample("Trial_Weapon_Idle_" + profile);
  const pelvis = by.get("Pelvis"),
    base = pelvis.matrixWorld.clone(),
    p = new T.Vector3().setFromMatrixPosition(base),
    wave = Math.sin(2 * Math.PI * phase);
  p.x = 0.007 * wave;
  p.y =
    (run ? 0.8 : 0.82) + (run ? 0.022 : 0.012) * Math.cos(4 * Math.PI * phase);
  p.z = 0;
  world(
    "Pelvis",
    new T.Matrix4()
      .makeTranslation(...p.toArray())
      .multiply(
        new T.Matrix4().makeRotationFromQuaternion(
          qy(0.045 * wave).multiply(qx(run ? 0.1 : 0.025)),
        ),
      )
      .multiply(base.clone().setPosition(0, 0, 0)),
  );
  upperPose(profile, run ? 0.35 : 1, phase, true, run ? 0.15 : 0.045);
  for (const [side, offset, sign] of [
    ["R", 0, 1],
    ["L", 0.5, -1],
  ]) {
    const q = (phase + offset) % 1,
      s = spec.stance,
      span = spec.stride * s,
      front = span / 2;
    let z, h, angle;
    if (q <= s) {
      z = -front + spec.stride * q;
      h = 0;
      angle =
        q < 0.075
          ? 0.14 * (1 - smooth(q / 0.075))
          : q > s - 0.1
            ? -0.32 * smooth((q - s + 0.1) / 0.1)
            : 0;
    } else {
      const u = (q - s) / (1 - s);
      z = curve(u, [
        [0, front, spec.stride * (1 - s)],
        [0.14, front + 0.04, 0],
        [0.86, -front - 0.04, 0],
        [1, -front, spec.stride * (1 - s)],
      ]);
      h = spec.lift * Math.sin(Math.PI * u) ** 2;
      angle = curve(u, [
        [0, -0.32, 0],
        [0.4, -0.48, 0],
        [0.82, 0.18, 0],
        [1, 0.14, 0],
      ]);
    }
    const rot = qx(angle),
      sole = soles[side];
    assert.ok(sole.length);
    let bottom = Infinity;
    for (const v of sole)
      bottom = Math.min(bottom, v.clone().applyQuaternion(rot).y);
    // Heel/toe roll pivots compensate ankle fore/aft motion during support.
    const pivot =
      angle >= 0
        ? new T.Vector3(
            0,
            Math.min(...sole.map((v) => v.y)),
            Math.max(...sole.map((v) => v.z)),
          )
        : new T.Vector3(
            0,
            Math.min(...sole.map((v) => v.y)),
            Math.min(...sole.map((v) => v.z)),
          );
    if (q <= s) z += pivot.z - pivot.clone().applyQuaternion(rot).z;
    legPose(
      side,
      new T.Vector3((sign * spec.width) / 2, -bottom + 0.002 + h, z),
      rot,
    );
  }
  update();
}
let chunks = [binary],
  byteLength = binary.length;
function add(values, type) {
  const pad = -byteLength & 3;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const b = Buffer.from(new Float32Array(values).buffer),
    view = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: b.length,
  });
  chunks.push(b);
  byteLength += b.length;
  const a = {
    bufferView: view,
    componentType: 5126,
    count: values.length / sizes[type],
    type,
  };
  if (type === "SCALAR") {
    a.min = [Math.min(...values)];
    a.max = [Math.max(...values)];
  }
  doc.accessors.push(a);
  return doc.accessors.length - 1;
}
const report = {
  source,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  fps: 60,
  specs,
  clips: [],
  maxIKClamp: 0,
};
function bake(name, duration, fn) {
  const count = Math.round(duration * 60),
    times = Array.from({ length: count + 1 }, (_, i) => (duration * i) / count),
    frames = [];
  for (let f = 0; f <= count; f++) {
    fn(f / count);
    frames.push(
      joints.map((i) => ({
        p: objects[i].position.toArray(),
        q: objects[i].quaternion.toArray(),
        s: objects[i].scale.toArray(),
      })),
    );
  }
  const input = add(times, "SCALAR"),
    a = { name, samplers: [], channels: [] };
  for (let j = 0; j < joints.length; j++)
    for (const [key, path, type] of [
      ["p", "translation", "VEC3"],
      ["q", "rotation", "VEC4"],
      ["s", "scale", "VEC3"],
    ]) {
      if (key === "q")
        for (let f = 1; f < frames.length; f++)
          if (
            frames[f][j].q.reduce(
              (s, x, k) => s + x * frames[f - 1][j].q[k],
              0,
            ) < 0
          )
            frames[f][j].q = frames[f][j].q.map((x) => -x);
      const output = add(
        frames.flatMap((f) => f[j][key]),
        type,
      );
      a.channels.push({
        sampler: a.samplers.length,
        target: { node: joints[j], path },
      });
      a.samplers.push({ input, output, interpolation: "LINEAR" });
    }
  doc.animations.push(a);
  report.clips.push({ name, duration, frames: count + 1 });
}
for (const name of ["Walk", "Run"])
  for (const profile of ["Rifle", "Rocket"])
    bake(
      "Combat_" + name + (profile === "Rocket" ? "_Rocket" : ""),
      specs[name].duration,
      (u) => gait(name, u % 1, profile),
    );
for (const profile of ["Rifle", "Shotgun"]) {
  bake("Low_Ready_" + profile, 3, (u) => {
    sample("Trial_Weapon_Idle_" + profile, u * 3);
    upperPose(profile, 1);
  });
  bake("Aim_Raise_" + profile, 0.55, (u) => {
    sample("Trial_Weapon_Idle_" + profile);
    upperPose(profile, 1 - smooth((u - 0.08) / 0.82));
  });
}
doc.scenes[doc.scene ?? 0].extras = {
  ...doc.scenes[doc.scene ?? 0].extras,
  trooperMotionVersion: 10,
};
doc.buffers[0].byteLength = byteLength;
const json = Buffer.from(JSON.stringify(doc)),
  jp = Buffer.alloc((json.length + 3) & ~3, 32);
json.copy(jp);
const bin = Buffer.concat(chunks),
  bp = Buffer.alloc((bin.length + 3) & ~3);
bin.copy(bp);
const out = Buffer.alloc(28 + jp.length + bp.length);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(jp.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);
jp.copy(out, 20);
out.writeUInt32LE(bp.length, 20 + jp.length);
out.writeUInt32LE(0x004e4942, 24 + jp.length);
bp.copy(out, 28 + jp.length);
for (const key of [
  "nodes",
  "meshes",
  "skins",
  "materials",
  "images",
  "textures",
])
  assert.deepEqual(doc[key], original[key], key + " preserved");
assert.deepEqual(
  doc.animations.slice(0, original.animations.length),
  original.animations,
);
report.maxIKClamp = maxClamp;
report.targetSha256 = createHash("sha256").update(out).digest("hex");
assert.ok(maxClamp < 0.002, "IK targets must remain reachable: " + maxClamp);
fs.writeFileSync(target, out);
fs.writeFileSync(
  target.replace(".glb", ".json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
