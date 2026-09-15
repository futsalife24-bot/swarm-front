/** Image A adaptation in metres, Y up, -Z forward. No DCC re-export of the
 * approved rig: replace mesh/idle accessors; retain every other clip's payload.
 * Rebuild: node scripts/build-trooper-design.mjs */
import * as T from "three";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
const source = "public/assets/characters/standard_trooper_sprint_v8.glb";
const target = "public/assets/characters/standard_trooper_v9.glb";
const raw = readFileSync(source),
  jsonLength = raw.readUInt32LE(12);
const doc = JSON.parse(raw.subarray(20, 20 + jsonLength));
const original = structuredClone(doc),
  originalBin = raw.subarray(28 + jsonLength);
doc.scenes[doc.scene ?? 0].extras = {
  ...doc.scenes[doc.scene ?? 0].extras,
  trooperDesignVersion: 9,
};
const chunks = [originalBin];
let byteLength = originalBin.length;
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const types = {
  5126: Float32Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5121: Uint8Array,
};
function read(index) {
  const a = original.accessors[index],
    v = original.bufferViews[a.bufferView],
    Type = types[a.componentType],
    n = sizes[a.type];
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0),
    stride = v.byteStride ?? n * Type.BYTES_PER_ELEMENT;
  const out = new Type(a.count * n);
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < n; k++) {
      const offset = start + i * stride + k * Type.BYTES_PER_ELEMENT;
      out[i * n + k] =
        a.componentType === 5126
          ? originalBin.readFloatLE(offset)
          : a.componentType === 5123
            ? originalBin.readUInt16LE(offset)
            : a.componentType === 5125
              ? originalBin.readUInt32LE(offset)
              : originalBin[offset];
    }
  return out;
}
function add(values, type, componentType = 5126) {
  const Type = types[componentType],
    array = new Type(values),
    pad = -byteLength & 3;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const bytes = Buffer.from(array.buffer),
    view = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: bytes.length,
  });
  chunks.push(bytes);
  byteLength += bytes.length;
  const n = sizes[type],
    a = { bufferView: view, componentType, count: array.length / n, type };
  if (type === "VEC3" || type === "SCALAR") {
    a.min = Array(n).fill(Infinity);
    a.max = Array(n).fill(-Infinity);
    for (let i = 0; i < array.length; i++) {
      const k = i % n;
      a.min[k] = Math.min(a.min[k], array[i]);
      a.max[k] = Math.max(a.max[k], array[i]);
    }
  }
  doc.accessors.push(a);
  return doc.accessors.length - 1;
}
const objects = original.nodes.map((n) => {
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
original.nodes.forEach((n, i) =>
  n.children?.forEach((c) => objects[i].add(objects[c])),
);
const root = objects[original.scenes[original.scene ?? 0].nodes[0]];
root.updateMatrixWorld(true);
const byName = new Map(objects.map((o) => [o.name, o])),
  nodeId = new Map(objects.map((o, i) => [o.name, i]));
const rest = objects.map((o) => ({
  p: o.position.clone(),
  q: o.quaternion.clone(),
  s: o.scale.clone(),
  world: o.matrixWorld.clone(),
}));
const joints = original.skins[0].joints,
  jointIndex = new Map(joints.map((n, i) => [original.nodes[n].name, i]));
const materialIndex = (name) => doc.materials.findIndex((m) => m.name === name);
const palette = {
  Armor: "#526570",
  Ceramic: "#9aa7a8",
  Cloth: "#46534f",
  Study_Cloth: "#303f47",
  Study_Glove: "#1d272c",
  Rubber: "#1b2429",
  Metal: "#515e62",
  Visor: "#091c21",
};
for (const m of doc.materials) {
  const color = new T.Color(palette[m.name]);
  m.pbrMetallicRoughness = {
    baseColorFactor: [color.r, color.g, color.b, 1],
    metallicFactor:
      m.name === "Metal" ? 0.65 : m.name === "Visor" ? 0.35 : 0.02,
    roughnessFactor:
      m.name === "Visor"
        ? 0.23
        : m.name === "Metal"
          ? 0.48
          : m.name === "Ceramic"
            ? 0.8
            : 0.94,
  };
  // Source UV-less prototype plates had invalid texCoord=-1. New surfaces have
  // deliberate matte PBR responses rather than sampling that unavailable UV set.
  delete m.normalTexture;
  delete m.occlusionTexture;
}
// The old GLB includes duplicate UV-less material variants. With the new PBR
// palette they are equivalent, so all uniform meshes can share one draw per role.
for (const mesh of doc.meshes)
  for (const p of mesh.primitives) {
    p.material = materialIndex(doc.materials[p.material].name);
    delete p.attributes.TEXCOORD_0;
    delete p.attributes.COLOR_0;
    delete p.attributes.TANGENT;
  }
// Remove the old flat visor and front rectangular seals behind the curved visor.
const helmet = doc.meshes.find((m) => m.name === "Helmet_Mesh");
helmet.primitives = helmet.primitives.filter(
  (p) => doc.materials[p.material].name !== "Visor",
);
for (const p of helmet.primitives)
  if (["Rubber", "Metal"].includes(doc.materials[p.material].name)) {
    const indices = read(p.indices),
      positions = read(p.attributes.POSITION),
      keep = [];
    for (let i = 0; i < indices.length; i += 3) {
      const corners = Array.from(indices.slice(i, i + 3));
      if (
        corners.every(
          (j) =>
            positions[j * 3 + 2] < -0.131 &&
            positions[j * 3 + 1] > 1.648 &&
            positions[j * 3 + 1] < 1.779 &&
            Math.abs(positions[j * 3]) < 0.124,
        )
      )
        continue;
      keep.push(...corners);
    }
    p.indices = add(
      keep,
      "SCALAR",
      original.accessors[p.indices].componentType,
    );
  }
function newMaterial(name, hex, roughness, metal = 0) {
  const c = new T.Color(hex);
  doc.materials.push({
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [c.r, c.g, c.b, 1],
      roughnessFactor: roughness,
      metallicFactor: metal,
    },
  });
  return doc.materials.length - 1;
}
const webbing = newMaterial("Webbing", "#51584c", 0.98),
  accent = newMaterial("Teal", "#65c5b3", 0.68, 0.05);
const buckets = new Map();
function emit(name, geometry, material, bone, variant = "common") {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const key = variant + ":" + material;
  if (!buckets.has(key))
    buckets.set(key, {
      variant,
      material,
      positions: [],
      normals: [],
      joints: [],
      weights: [],
      components: [],
    });
  const b = buckets.get(key),
    start = b.positions.length / 3;
  b.positions.push(...g.attributes.position.array);
  b.normals.push(...g.attributes.normal.array);
  for (let i = 0; i < g.attributes.position.count; i++) {
    b.joints.push(jointIndex.get(bone), 0, 0, 0);
    b.weights.push(1, 0, 0, 0);
  }
  b.components.push({ name, start, count: g.attributes.position.count });
}
// Eight-sided clipped panels: low-poly bevels read as manufactured edges.
function panel(
  name,
  center,
  size,
  material,
  bone,
  variant = "common",
  rotation = [0, 0, 0],
) {
  const [w, h, d] = size,
    c = Math.min(w, h) * 0.16;
  const shape = new T.Shape();
  const pts = [
    [-w / 2 + c, -h / 2],
    [w / 2 - c, -h / 2],
    [w / 2, -h / 2 + c],
    [w / 2, h / 2 - c],
    [w / 2 - c, h / 2],
    [-w / 2 + c, h / 2],
    [-w / 2, h / 2 - c],
    [-w / 2, -h / 2 + c],
  ];
  shape.moveTo(...pts[0]);
  pts.slice(1).forEach((p) => shape.lineTo(...p));
  shape.closePath();
  const bevel = Math.min(0.004, d * 0.18),
    g = new T.ExtrudeGeometry(shape, {
      depth: d - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 1,
    });
  g.translate(0, 0, -d / 2 + bevel);
  g.applyMatrix4(
    new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation)),
  );
  g.translate(...center);
  emit(name, g, material, bone, variant);
}
function tube(
  name,
  center,
  radii,
  height,
  material,
  bone,
  variant = "common",
  segments = 16,
) {
  const g = new T.CylinderGeometry(1, 1, height, segments, 1, true);
  g.scale(radii[0], 1, radii[1]);
  g.translate(...center);
  emit(name, g, material, bone, variant);
}
function link(name, a, b, width, depth, material, bone) {
  const from = new T.Vector3(...a),
    to = new T.Vector3(...b),
    g = new T.BoxGeometry(width, from.distanceTo(to), depth);
  g.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    ),
  );
  g.translate(...from.add(to).multiplyScalar(0.5).toArray());
  emit(name, g, material, bone);
}
function limbPlate(name, center, width, height, material, bone) {
  const positions = [],
    indices = [],
    rows = [
      [-0.5, 0.59],
      [-0.4, 0.83],
      [0.28, 1],
      [0.48, 0.77],
    ],
    segments = 8;
  for (const [y, w] of rows)
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments - 0.5) * 2;
      positions.push(
        center[0] + x * width * 0.5 * w,
        center[1] + y * height,
        center[2] + x * x * 0.023 + Math.abs(y) * 0.009,
      );
    }
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  emit(name, g, material, bone);
}
function shield(name, material, offset = 0, border = false) {
  const positions = [],
    indices = [],
    segments = 16,
    levels = border ? [1.757, 1.765] : [1.63, 1.66, 1.706, 1.757];
  for (const y of levels)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments - 0.5) * 2.03,
        t = T.MathUtils.clamp((y - 1.63) / 0.127, 0, 1),
        width = 0.7 + t * 0.3;
      positions.push(
        Math.sin(a) * 0.151 * width,
        y,
        -0.029 - Math.cos(a) * (0.112 + t * 0.034 + offset),
      );
    }
  for (let j = 0; j < levels.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  emit(name, g, material, "Head");
}
const armor = materialIndex("Armor"),
  rubber = materialIndex("Rubber"),
  metal = materialIndex("Metal"),
  ceramic = materialIndex("Ceramic"),
  visor = materialIndex("Visor");
// Replace the prototype ball kneecaps and open cylindrical shin cups.
for (const n of doc.nodes)
  if (/^Trial_(Knee|Shin)_/.test(n.name)) delete n.mesh;
// Retain joint weights; scale each rigid shell about its own centre, never the rig.
for (const mesh of doc.meshes)
  for (const p of mesh.primitives) {
    let scale;
    if (mesh.name.startsWith("Trial_Shoulder")) scale = [1.12, 1.1, 1.08];
    if (mesh.name.startsWith("Trial_Shin")) scale = [0.88, 0.75, 1];
    if (mesh.name.startsWith("Trial_Chest.")) scale = [1, 1.45, 1.08];
    if (!scale) continue;
    const a = original.accessors[p.attributes.POSITION],
      center = new T.Vector3()
        .fromArray(a.min)
        .add(new T.Vector3().fromArray(a.max))
        .multiplyScalar(0.5),
      positions = read(p.attributes.POSITION),
      normals = read(p.attributes.NORMAL);
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++)
        positions[i + k] =
          (positions[i + k] - center.getComponent(k)) * scale[k] +
          center.getComponent(k);
      const n = new T.Vector3(
        normals[i] / scale[0],
        normals[i + 1] / scale[1],
        normals[i + 2] / scale[2],
      ).normalize();
      n.toArray(normals, i);
    }
    p.attributes.POSITION = add(positions, "VEC3");
    p.attributes.NORMAL = add(normals, "VEC3");
  }
// Tailored combat fabric: change the existing densely skinned suit, not its
// skeleton. Broad folds run around elbows, knees and boot cuffs; low-amplitude
// weave is shaded by a shared 64px normal texture rather than extra geometry.
const body = doc.meshes.find((m) => m.name.startsWith("Anatomical_torso"))
  .primitives[0];
const bp = read(body.attributes.POSITION),
  bj = read(body.attributes.JOINTS_0),
  bw = read(body.attributes.WEIGHTS_0),
  uv = [],
  colors = [];
for (let i = 0; i < bp.length / 3; i++) {
  let k = 0;
  for (let j = 1; j < 4; j++) if (bw[i * 4 + j] > bw[i * 4 + k]) k = j;
  const n = joints[bj[i * 4 + k]],
    name = original.nodes[n].name,
    p = new T.Vector3().fromArray(bp, i * 3);
  const m = rest[n].world,
    origin = new T.Vector3().setFromMatrixPosition(m),
    axis = new T.Vector3(0, 1, 0).transformDirection(m),
    offset = p.clone().sub(origin),
    along = offset.dot(axis),
    radial = offset.clone().addScaledVector(axis, -along);
  if (/UpperArm|LowerArm|UpperLeg|LowerLeg/.test(name)) {
    const angle = Math.atan2(radial.z, radial.x),
      wave = Math.sin(along * 94 + Math.sin(angle * 2.3) * 1.2),
      ridge = Math.pow(Math.max(0, wave), 3);
    const size = /UpperLeg/.test(name)
        ? 0.97
        : /LowerLeg/.test(name)
          ? 1.025
          : 1.04,
      fold = /LowerLeg/.test(name) ? 0.08 : 0.045;
    p.addScaledVector(radial, size - 1 + ridge * fold);
    // Athletic tailoring: narrow the thigh laterally around its actual joint
    // axis, rather than moving hip bones or stretching the approved animation.
    if (/UpperLeg/.test(name)) p.x -= radial.x * 0.13;
    // A cloth fold catches light across the leg without painting camouflage.
    const shade = 0.87 + ridge * 0.1;
    colors.push(shade, shade, shade, 1);
  } else {
    colors.push(0.92, 0.92, 0.92, 1);
    if (/Pelvis|Spine$/.test(name) && p.y < 1.12) p.x *= 0.88;
  }
  p.toArray(bp, i * 3);
  uv.push((Math.atan2(radial.z, radial.x) / Math.PI) * 3, along * 18);
}
body.attributes.POSITION = add(bp, "VEC3");
body.attributes.TEXCOORD_0 = add(uv, "VEC2");
body.attributes.COLOR_0 = add(colors, "VEC4");
{
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(bp, 3));
  g.setIndex(new T.BufferAttribute(read(body.indices), 1));
  g.computeVertexNormals();
  body.attributes.NORMAL = add(g.attributes.normal.array, "VEC3");
}
function png(width, height, pixels) {
  function crc32(b) {
    let c = 0xffffffff;
    for (const x of b) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type),
      l = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    l.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([l, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    pixels.copy(
      rows,
      y * (width * 4 + 1) + 1,
      y * width * 4,
      (y + 1) * width * 4,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
{
  const pixels = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      pixels[i] = 128 + Math.round(Math.sin((x * Math.PI) / 2) * 17);
      pixels[i + 1] = 128 + Math.round(Math.sin((y * Math.PI) / 2) * 17);
      pixels[i + 2] = 253;
      pixels[i + 3] = 255;
    }
  const bytes = png(64, 64, pixels),
    pad = -byteLength & 3;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const bufferView = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: bytes.length,
  });
  chunks.push(bytes);
  byteLength += bytes.length;
  const image = doc.images.length;
  doc.images.push({
    name: "Uniform_weave_64",
    bufferView,
    mimeType: "image/png",
  });
  const texture = doc.textures.length;
  doc.textures.push({ source: image, sampler: 0 });
  doc.materials[materialIndex("Study_Cloth")].normalTexture = {
    index: texture,
    scale: 0.38,
  };
}
// Carrier, shoulder webbing and three large magazine pouches, readable at 100px.
panel(
  "Carrier_lower_panel",
  [0, 1.235, -0.148],
  [0.335, 0.16, 0.066],
  webbing,
  "SpineMid",
);
for (const s of [-1, 1]) {
  const strap = [
    [s * 0.15, 1.325, -0.177],
    [s * 0.15, 1.408, -0.163],
    [s * 0.15, 1.455, -0.08],
    [s * 0.15, 1.463, 0.01],
    [s * 0.15, 1.414, 0.13],
    [s * 0.15, 1.322, 0.166],
  ];
  for (let i = 0; i < strap.length - 1; i++)
    link(
      "Shoulder_harness_" + s + "_" + i,
      strap[i],
      strap[i + 1],
      0.032,
      0.013,
      webbing,
      "Chest",
    );
  panel(
    "Harness_clasp_" + s,
    [s * 0.152, 1.407, -0.179],
    [0.041, 0.036, 0.015],
    metal,
    "Chest",
  );
  panel(
    "Waist_utility_" + s,
    [s * 0.193, 1.017, 0.011],
    [0.063, 0.118, 0.112],
    webbing,
    "Pelvis",
  );
  panel(
    "Waist_flap_" + s,
    [s * 0.194, 1.052, -0.052],
    [0.061, 0.038, 0.013],
    rubber,
    "Pelvis",
  );
  const side = s < 0 ? "L" : "R";
  const shoulder = original.meshes.find(
      (m) => m.name === "Trial_Shoulder_" + side,
    ).primitives[0],
    liningPositions = read(shoulder.attributes.POSITION),
    bounds = original.accessors[shoulder.attributes.POSITION],
    liningCenter = new T.Vector3()
      .fromArray(bounds.min)
      .add(new T.Vector3().fromArray(bounds.max))
      .multiplyScalar(0.5);
  for (let i = 0; i < liningPositions.length; i += 3) {
    const v = new T.Vector3()
      .fromArray(liningPositions, i)
      .sub(liningCenter)
      .multiply(new T.Vector3(1.105, 1.1, 1.065))
      .add(liningCenter);
    v.y -= 0.007;
    v.toArray(liningPositions, i);
  }
  const lining = new T.BufferGeometry();
  lining.setAttribute(
    "position",
    new T.Float32BufferAttribute(liningPositions, 3),
  );
  lining.setIndex(new T.BufferAttribute(read(shoulder.indices), 1));
  emit("Shoulder_padded_lining_" + side, lining, rubber, "UpperArm_" + side);
  limbPlate(
    "Knee_padding_" + side,
    [s * 0.175, 0.529, -0.151],
    0.159,
    0.215,
    rubber,
    "LowerLeg_" + side,
  );
  limbPlate(
    "Knee_shell_" + side,
    [s * 0.175, 0.535, -0.156],
    0.134,
    0.194,
    armor,
    "LowerLeg_" + side,
  );
  limbPlate(
    "Shin_shell_" + side,
    [s * 0.209, 0.327, -0.111],
    0.106,
    0.238,
    armor,
    "LowerLeg_" + side,
  );
  panel(
    "Forearm_inset_" + side,
    [s * 0.389, 1.015, -0.109],
    [0.078, 0.106, 0.012],
    armor,
    "LowerArm_" + side,
  );
  panel(
    "Thigh_cargo_" + side,
    [s * 0.182, 0.805, 0.015],
    [0.055, 0.137, 0.111],
    webbing,
    "UpperLeg_" + side,
  );
  panel(
    "Thigh_cargo_flap_" + side,
    [s * 0.212, 0.843, 0.015],
    [0.013, 0.043, 0.105],
    webbing,
    "UpperLeg_" + side,
  );
  for (const t of [-1, 1])
    panel(
      "Shoulder_chevron_" + side + "_" + t,
      [s * 0.424, 1.396, -0.009 + t * 0.023],
      [0.008, 0.063, 0.012],
      ceramic,
      "UpperArm_" + side,
      "common",
      [t * 0.5, 0, 0],
    );
  tube(
    "Knee_retention_" + side,
    [s * 0.175, 0.518, -0.035],
    [0.087, 0.099],
    0.027,
    webbing,
    "LowerLeg_" + side,
  );
  tube(
    "Ankle_cuff_" + side,
    [s * 0.224, 0.222, 0.014],
    [0.065, 0.073],
    0.048,
    materialIndex("Study_Cloth"),
    "LowerLeg_" + side,
  );
}
// Low-contrast service marks: one shared tiny atlas, no lights
// or emissive effects. The stencil is legible in inspection, quiet at game scale.
{
  const font = {
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  };
  const pixels = Buffer.alloc(128 * 64 * 4);
  for (const [j, ch] of [..."S-01"].entries())
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++)
        if (font[ch][y][x] === "1")
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 4; dx++) {
              const i =
                ((y * 4 + dy + 16) * 128 + j * 24 + x * 4 + dx + 16) * 4;
              pixels[i] = pixels[i + 1] = pixels[i + 2] = 54;
              pixels[i + 3] = 255;
            }
  const bytes = png(128, 64, pixels),
    pad = -byteLength & 3;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const bufferView = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: bytes.length,
  });
  chunks.push(bytes);
  byteLength += bytes.length;
  const sourceImage = doc.images.length;
  doc.images.push({
    name: "Trooper_service_stencil",
    bufferView,
    mimeType: "image/png",
  });
  const texture = doc.textures.length;
  doc.textures.push({ source: sourceImage });
  const material = doc.materials.length;
  doc.materials.push({
    name: "ServiceMark",
    alphaMode: "MASK",
    alphaCutoff: 0.5,
    pbrMetallicRoughness: {
      baseColorTexture: { index: texture },
      metallicFactor: 0,
      roughnessFactor: 0.95,
    },
  });
  for (const s of [-1, 1]) {
    const g = new T.PlaneGeometry(0.092, 0.046);
    g.rotateY((s * Math.PI) / 2);
    g.translate(s * 0.141, 1.789, -0.044);
    const uv = Array.from((g.index ? g.toNonIndexed() : g).attributes.uv.array);
    emit("Helmet_S01_" + s, g, material, "Head");
    const b = buckets.get("common:" + material);
    b.uv ??= [];
    b.uv.push(...uv);
  }
}
for (const x of [-0.108, 0, 0.108]) {
  panel(
    "Magazine_pouch_" + x,
    [x, 1.208, -0.206],
    [0.087, 0.125, 0.066],
    webbing,
    "SpineMid",
  );
  panel(
    "Pouch_flap_" + x,
    [x, 1.244, -0.246],
    [0.079, 0.04, 0.015],
    rubber,
    "SpineMid",
  );
  panel(
    "Pouch_pull_" + x,
    [x, 1.203, -0.247],
    [0.014, 0.044, 0.009],
    metal,
    "SpineMid",
  );
}
panel(
  "Carrier_ID",
  [0.085, 1.358, -0.174],
  [0.046, 0.009, 0.012],
  accent,
  "Chest",
);
panel("Belt_buckle", [0, 1.01, -0.143], [0.068, 0.034, 0.021], metal, "Pelvis");
// Curved wraparound visor and a protective collar shorten the exposed neck.
shield("Visor_full_face", visor, 0.006);
shield("Visor_brow_teal", accent, 0.009, true);
for (const s of [-1, 1]) {
  link(
    "Helmet_cheek_rim_" + s,
    [s * 0.13, 1.754, -0.119],
    [s * 0.085, 1.627, -0.107],
    0.013,
    0.014,
    ceramic,
    "Head",
  );
  link(
    "Helmet_lower_rim_" + s,
    [s * 0.085, 1.627, -0.107],
    [0, 1.62, -0.153],
    0.01,
    0.012,
    ceramic,
    "Head",
  );
}
tube("Collar_soft_seal", [0, 1.503, 0], [0.103, 0.104], 0.088, rubber, "Neck");
for (const s of [-1, 1])
  panel(
    "Collar_guard_" + s,
    [s * 0.095, 1.49, -0.01],
    [0.044, 0.076, 0.153],
    armor,
    "Chest",
    "common",
    [0, 0, s * 0.24],
  );
panel(
  "Helmet_rear_sensor",
  [0, 1.726, 0.169],
  [0.036, 0.052, 0.019],
  rubber,
  "Head",
);
panel(
  "Helmet_rear_ID",
  [0, 1.724, 0.181],
  [0.012, 0.024, 0.008],
  accent,
  "Head",
);
// A slim vertical quick-release housing fits between the existing weapon rails.
panel(
  "Back_common_support",
  [0.041, 1.306, 0.162],
  [0.37, 0.276, 0.028],
  armor,
  "Chest",
);
panel(
  "Back_mount_bridge",
  [0.079, 1.352, 0.192],
  [0.38, 0.032, 0.043],
  metal,
  "Chest",
);
for (const x of [0.005, 0.275])
  panel(
    "Weapon_rail_clasp_" + x,
    [x, 1.35, 0.223],
    [0.063, 0.063, 0.027],
    rubber,
    "Chest",
  );
panel(
  "Back_mount_body",
  [-0.055, 1.245, 0.19],
  [0.18, 0.345, 0.081],
  webbing,
  "Chest",
);
panel(
  "Back_mount_spine",
  [-0.055, 1.255, 0.24],
  [0.1, 0.292, 0.024],
  armor,
  "Chest",
);
panel(
  "Back_mount_latch",
  [-0.055, 1.38, 0.261],
  [0.063, 0.038, 0.022],
  metal,
  "Chest",
);
panel(
  "Back_mount_ID",
  [-0.055, 1.231, 0.257],
  [0.017, 0.108, 0.012],
  accent,
  "Chest",
);
for (const y of [1.135, 1.335])
  panel(
    "Mount_crossbar_" + y,
    [-0.055, y, 0.257],
    [0.124, 0.019, 0.016],
    metal,
    "Chest",
  );
// Same uniform, mission kit stays with the loadout during holster/switch/roll.
for (const s of [-1, 1]) {
  const side = s < 0 ? "L" : "R";
  const sourceShell = original.meshes.find(
      (m) => m.name === "Trial_Shoulder_" + side,
    ).primitives[0],
    p = read(sourceShell.attributes.POSITION),
    a = original.accessors[sourceShell.attributes.POSITION],
    center = new T.Vector3()
      .fromArray(a.min)
      .add(new T.Vector3().fromArray(a.max))
      .multiplyScalar(0.5);
  for (let i = 0; i < p.length; i += 3) {
    const v = new T.Vector3()
      .fromArray(p, i)
      .sub(center)
      .multiplyScalar(1.23)
      .add(center);
    v.y += 0.012;
    v.toArray(p, i);
  }
  const shell = new T.BufferGeometry();
  shell.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  shell.setIndex(new T.BufferAttribute(read(sourceShell.indices), 1));
  emit(
    "RL_shoulder_overlay_" + side,
    shell,
    armor,
    "UpperArm_" + side,
    "rocket",
  );
  panel(
    "RL_hip_case_" + side,
    [s * 0.215, 0.997, 0.065],
    [0.076, 0.147, 0.105],
    webbing,
    "Pelvis",
    "rocket",
  );
}
panel(
  "RL_back_reinforcement",
  [0.12, 1.24, 0.191],
  [0.1, 0.285, 0.065],
  armor,
  "Chest",
  "rocket",
);
for (let i = 0; i < 4; i++)
  panel(
    "SG_shell_holder_" + i,
    [-0.193, 0.915 - i * 0.023, -0.078],
    [0.046, 0.016, 0.028],
    webbing,
    "UpperLeg_L",
    "shotgun",
  );
let extraTriangles = 0;
for (const b of buckets.values()) {
  const n = b.positions.length / 3;
  extraTriangles += n / 3;
  const attributes = {
    POSITION: add(b.positions, "VEC3"),
    NORMAL: add(b.normals, "VEC3"),
    JOINTS_0: add(b.joints, "VEC4", 5121),
    WEIGHTS_0: add(b.weights, "VEC4"),
  };
  // Match source material groups for runtime batching, including UV/vertex colour.
  if (doc.materials[b.material].name === "Study_Cloth") {
    attributes.TEXCOORD_0 = add(Array(n * 2).fill(0), "VEC2");
    attributes.COLOR_0 = add(Array(n * 4).fill(1), "VEC4");
  }
  if (b.uv) attributes.TEXCOORD_0 = add(b.uv, "VEC2");
  const name = `Kit_${b.variant}_${doc.materials[b.material].name}`;
  const mesh = doc.meshes.length;
  doc.meshes.push({
    name,
    primitives: [
      {
        attributes,
        indices: add(
          Array.from({ length: n }, (_, i) => i),
          "SCALAR",
          5123,
        ),
        material: b.material,
      },
    ],
  });
  const index = doc.nodes.length;
  doc.nodes.push({
    name,
    mesh,
    skin: 0,
    extras: {
      components: b.components,
      ...(b.variant !== "common" ? { loadoutVariant: b.variant } : {}),
    },
  });
  doc.nodes[nodeId.get("STANDARD_TROOPER_RIG")].children.push(index);
}
// Generated albedo atlas: share the untouched source, address one quadrant per
// material, and preserve UV0 for the independently tiled weave normal map.
{
  const atlas = readFileSync(
    "assets/blender/source/textures/trooper-material-atlas-v9.png",
  );
  const pad = -byteLength & 3;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const bufferView = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: atlas.length,
  });
  chunks.push(atlas);
  byteLength += atlas.length;
  const image = doc.images.length;
  doc.images.push({
    name: "Trooper_material_atlas_v9",
    bufferView,
    mimeType: "image/png",
  });
  const texture = doc.textures.length;
  doc.textures.push({ source: image });
  const regions = {
    Study_Cloth: [0, 0],
    Cloth: [0, 0],
    Webbing: [1, 0],
    Armor: [0, 1],
    Ceramic: [1, 1],
  };
  const current = Buffer.concat(chunks);
  const values = (index) => {
    const a = doc.accessors[index],
      v = doc.bufferViews[a.bufferView],
      size = sizes[a.type],
      start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0),
      out = [];
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < size; k++)
        out.push(
          a.componentType === 5126
            ? current.readFloatLE(
                start + i * (v.byteStride ?? size * 4) + k * 4,
              )
            : current[start + i * size + k],
        );
    return out;
  };
  for (const material of doc.materials)
    if (regions[material.name]) {
      material.pbrMetallicRoughness.baseColorTexture = {
        index: texture,
        texCoord: 1,
      };
      material.pbrMetallicRoughness.baseColorFactor =
        material.pbrMetallicRoughness.baseColorFactor.map((v, i) =>
          i === 3 ? v : Math.min(1, v / 0.46),
        );
    }
  for (const mesh of doc.meshes)
    for (const p of mesh.primitives) {
      const role = doc.materials[p.material].name,
        region = regions[role];
      if (!region) continue;
      const points = values(p.attributes.POSITION),
        normals = values(p.attributes.NORMAL),
        uv = [];
      const a = doc.accessors[p.attributes.POSITION],
        min = a.min,
        max = a.max;
      for (let i = 0; i < points.length; i += 3) {
        const ax = Math.abs(normals[i]),
          ay = Math.abs(normals[i + 1]),
          az = Math.abs(normals[i + 2]);
        const uAxis = ax > az && ax > ay ? 2 : 0,
          vAxis = ay > az && ay > ax ? 2 : 1;
        const u = T.MathUtils.clamp(
            (points[i + uAxis] - min[uAxis]) /
              Math.max(0.001, max[uAxis] - min[uAxis]),
            0,
            1,
          ),
          v = T.MathUtils.clamp(
            (points[i + vAxis] - min[vAxis]) /
              Math.max(0.001, max[vAxis] - min[vAxis]),
            0,
            1,
          );
        uv.push(
          (region[0] + 0.018 + u * 0.964) * 0.5,
          (region[1] + 0.018 + v * 0.964) * 0.5,
        );
      }
      p.attributes.TEXCOORD_1 = add(uv, "VEC2");
    }
}
function reset() {
  objects.forEach((o, i) => {
    o.position.copy(rest[i].p);
    o.quaternion.copy(rest[i].q);
    o.scale.copy(rest[i].s);
  });
  root.updateMatrixWorld(true);
}
function sample(clip, time) {
  reset();
  for (const c of clip.channels) {
    const s = clip.samplers[c.sampler],
      times = read(s.input),
      values = read(s.output),
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
        .fromArray(values, i * n)
        .slerp(new T.Quaternion().fromArray(values, j * n), u);
    else {
      const v = new T.Vector3()
        .fromArray(values, i * n)
        .lerp(new T.Vector3().fromArray(values, j * n), u);
      o[c.target.path === "translation" ? "position" : "scale"].copy(v);
    }
  }
  root.updateMatrixWorld(true);
}
function world(o, m) {
  const local = o.parent.matrixWorld.clone().invert().multiply(m);
  local.decompose(o.position, o.quaternion, o.scale);
  o.updateWorldMatrix(false, true);
}
const pos = (o) => o.getWorldPosition(new T.Vector3());
function solve(upper, lower, end, target, poleDirection) {
  const a = pos(upper),
    b = pos(lower),
    c = pos(end),
    l1 = a.distanceTo(b),
    l2 = b.distanceTo(c),
    axis = target.clone().sub(a),
    distance = axis.length();
  assert.ok(
    distance < l1 + l2 && distance > Math.abs(l1 - l2),
    "reachable IK target",
  );
  axis.normalize();
  const pole = poleDirection
      .clone()
      .addScaledVector(axis, -poleDirection.dot(axis))
      .normalize(),
    along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const bend = a
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  function turn(o, from, to) {
    const q = new T.Quaternion()
      .setFromUnitVectors(from.normalize(), to.normalize())
      .multiply(o.getWorldQuaternion(new T.Quaternion()));
    o.quaternion.copy(
      o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q),
    );
    o.updateWorldMatrix(false, true);
  }
  turn(upper, b.clone().sub(a), bend.clone().sub(a));
  const joint = pos(lower);
  turn(lower, pos(end).sub(joint), target.clone().sub(joint));
}
// Sole points are measured from actual boot geometry in the neutral foot frame.
reset();
const sole = { L: [], R: [] };
for (const p of original.meshes[0].primitives) {
  const positions = read(p.attributes.POSITION),
    indices = read(p.attributes.JOINTS_0),
    weights = read(p.attributes.WEIGHTS_0);
  for (let i = 0; i < positions.length / 3; i++)
    for (const side of ["L", "R"])
      if (
        [0, 1, 2, 3].some(
          (k) =>
            weights[i * 4 + k] > 0.5 &&
            ["Foot_" + side, "Toe_" + side].includes(
              original.nodes[joints[indices[i * 4 + k]]].name,
            ),
        )
      )
        sole[side].push(
          new T.Vector3().fromArray(positions, i * 3).applyMatrix4(
            byName
              .get("Foot_" + side)
              .matrixWorld.clone()
              .invert(),
          ),
        );
}
const changed = [
  "Trial_Idle",
  "Trial_Weapon_Idle_Rifle",
  "Trial_Weapon_Idle_Shotgun",
  "Trial_Weapon_Idle_Rocket",
];
const report = {
  source,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  extraTriangles,
  changedClips: changed,
  preservedClips: original.animations
    .filter((a) => !changed.includes(a.name))
    .map((a) => a.name),
  stance: {
    rifle: {
      ankleWidth: 0.432,
      stagger: 0.19,
      toeOutDegrees: 7,
      frontWeightIntent: 0.55,
    },
    shotgun: {
      ankleWidth: 0.432,
      stagger: 0.19,
      toeOutDegrees: 7,
      frontWeightIntent: 0.55,
    },
    rocket: {
      ankleWidth: 0.47,
      stagger: 0.26,
      toeOutDegrees: 10,
      frontWeightIntent: 0.6,
    },
  },
  maxGripPositionError: 0,
};
for (const name of changed) {
  const old = original.animations.find((a) => a.name === name),
    heavy = name.endsWith("Rocket"),
    duration = Math.max(...old.samplers.map((s) => Math.max(...read(s.input)))),
    frames = 60,
    times = Array.from(
      { length: frames + 1 },
      (_, i) => (i / frames) * duration,
    );
  const output = new Map();
  for (const time of times) {
    sample(old, time);
    const sourceWorld = objects.map((o) => o.matrixWorld.clone());
    const pelvis = byName.get("Pelvis");
    pelvis.position.x -= heavy ? 0.047 : 0.0216;
    pelvis.position.y += heavy ? 0.065 : 0.018;
    pelvis.position.z -= heavy ? 0.026 : 0.0095;
    root.updateMatrixWorld(true);
    // Preserve upper-body weapon world transforms; lean RL from the pelvis toward
    // the existing shoulder/weapon position rather than moving the firing axis.
    const spine = byName.get("Spine");
    world(spine, sourceWorld[nodeId.get("Spine")]);
    for (const side of ["L", "R"]) {
      const sign = side === "L" ? -1 : 1,
        foot = byName.get("Foot_" + side),
        neutralQ = new T.Quaternion().setFromRotationMatrix(
          rest[nodeId.get(foot.name)].world,
        ),
        q = new T.Quaternion()
          .setFromAxisAngle(
            new T.Vector3(0, 1, 0),
            -sign * T.MathUtils.degToRad(heavy ? 4 : 1),
          )
          .multiply(neutralQ);
      const bottom = Math.min(
        ...sole[side].map((p) => p.clone().applyQuaternion(q).y),
      );
      const target = new T.Vector3(
        sign * (heavy ? 0.235 : 0.216),
        -bottom + 0.002,
        sign * (heavy ? 0.13 : 0.095),
      );
      const upper = byName.get("UpperLeg_" + side),
        lower = byName.get("LowerLeg_" + side);
      solve(upper, lower, foot, target, new T.Vector3(sign * 0.045, 0, -1));
      world(foot, new T.Matrix4().compose(target, q, new T.Vector3(1, 1, 1)));
    }
    // Lower the elbow pole without moving hands, fingers or weapon/support sockets.
    for (const side of ["L", "R"]) {
      const upper = byName.get("UpperArm_" + side),
        lower = byName.get("LowerArm_" + side),
        hand = byName.get("Hand_" + side),
        handWorld = hand.matrixWorld.clone(),
        target = pos(hand),
        a = pos(upper),
        pole = pos(lower).sub(a);
      pole.y -= 0.075;
      solve(upper, lower, hand, target, pole);
      world(hand, handWorld);
    }
    root.updateMatrixWorld(true);
    for (const n of [
      "Hand_L",
      "Hand_R",
      "RightHandWeaponSocket",
      "LeftHandSupportSocket",
    ])
      report.maxGripPositionError = Math.max(
        report.maxGripPositionError,
        pos(byName.get(n)).distanceTo(
          new T.Vector3().setFromMatrixPosition(sourceWorld[nodeId.get(n)]),
        ),
      );
    for (const i of joints)
      for (const [path, prop] of [
        ["translation", "position"],
        ["rotation", "quaternion"],
        ["scale", "scale"],
      ]) {
        const key = i + ":" + path;
        if (!output.has(key)) output.set(key, []);
        const values = output.get(key),
          o = objects[i];
        if (
          path === "rotation" &&
          values.length &&
          new T.Quaternion()
            .fromArray(values, values.length - 4)
            .dot(o.quaternion) < 0
        )
          o.quaternion.set(
            -o.quaternion.x,
            -o.quaternion.y,
            -o.quaternion.z,
            -o.quaternion.w,
          );
        values.push(...o[prop].toArray());
      }
  }
  const animation = { name, channels: [], samplers: [] },
    input = add(times, "SCALAR");
  for (const [key, values] of output) {
    const [node, path] = key.split(":");
    animation.channels.push({
      sampler: animation.samplers.length,
      target: { node: +node, path },
    });
    animation.samplers.push({
      input,
      output: add(values, path === "rotation" ? "VEC4" : "VEC3"),
      interpolation: "LINEAR",
    });
  }
  doc.animations[doc.animations.findIndex((a) => a.name === name)] = animation;
}
assert.ok(report.maxGripPositionError < 1e-5);
assert.deepEqual(doc.skins, original.skins);
assert.deepEqual(doc.nodes.slice(0, 57), original.nodes.slice(0, 57));
for (let i = 0; i < original.animations.length; i++)
  if (!changed.includes(original.animations[i].name))
    assert.deepEqual(doc.animations[i], original.animations[i]);
// Compact unreachable historical geometry, images and animation exports. This
// changes offsets only: used buffer views are copied, never re-quantized.
const unpacked = Buffer.concat(chunks),
  views = doc.bufferViews,
  accessors = doc.accessors;
const usedMeshes = [
  ...new Set(doc.nodes.filter((n) => n.mesh !== undefined).map((n) => n.mesh)),
];
const meshMap = new Map(usedMeshes.map((n, i) => [n, i]));
doc.meshes = usedMeshes.map((n) => doc.meshes[n]);
for (const n of doc.nodes)
  if (n.mesh !== undefined) n.mesh = meshMap.get(n.mesh);
const usedMaterials = [
  ...new Set(doc.meshes.flatMap((m) => m.primitives.map((p) => p.material))),
];
const matMap = new Map(usedMaterials.map((n, i) => [n, i]));
doc.materials = usedMaterials.map((n) => doc.materials[n]);
for (const m of doc.meshes)
  for (const p of m.primitives) p.material = matMap.get(p.material);
const textureRefs = doc.materials.flatMap((m) =>
  [
    m.normalTexture,
    m.occlusionTexture,
    m.emissiveTexture,
    m.pbrMetallicRoughness?.baseColorTexture,
    m.pbrMetallicRoughness?.metallicRoughnessTexture,
  ].filter(Boolean),
);
const usedTextures = [...new Set(textureRefs.map((t) => t.index))],
  texMap = new Map(usedTextures.map((n, i) => [n, i]));
doc.textures = usedTextures.map((n) => doc.textures[n]);
for (const t of textureRefs) t.index = texMap.get(t.index);
const usedImages = [...new Set(doc.textures.map((t) => t.source))],
  imageMap = new Map(usedImages.map((n, i) => [n, i]));
doc.images = usedImages.map((n) => doc.images[n]);
for (const t of doc.textures) t.source = imageMap.get(t.source);
const keptAccessors = new Set();
for (const m of doc.meshes)
  for (const p of m.primitives) {
    Object.values(p.attributes).forEach((i) => keptAccessors.add(i));
    if (p.indices !== undefined) keptAccessors.add(p.indices);
  }
for (const s of doc.skins) keptAccessors.add(s.inverseBindMatrices);
for (const a of doc.animations)
  for (const s of a.samplers) {
    keptAccessors.add(s.input);
    keptAccessors.add(s.output);
  }
const order = [...keptAccessors],
  accessorMap = new Map(order.map((n, i) => [n, i]));
doc.accessors = order.map((n) => structuredClone(accessors[n]));
for (const m of doc.meshes)
  for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes))
      p.attributes[k] = accessorMap.get(p.attributes[k]);
    if (p.indices !== undefined) p.indices = accessorMap.get(p.indices);
  }
for (const s of doc.skins)
  s.inverseBindMatrices = accessorMap.get(s.inverseBindMatrices);
for (const a of doc.animations)
  for (const s of a.samplers) {
    s.input = accessorMap.get(s.input);
    s.output = accessorMap.get(s.output);
  }
const usedViews = [
    ...new Set([
      ...doc.accessors.map((a) => a.bufferView),
      ...doc.images.map((i) => i.bufferView),
    ]),
  ],
  viewMap = new Map(),
  packed = [];
let packedLength = 0;
doc.bufferViews = [];
for (const index of usedViews) {
  const v = views[index],
    bytes = unpacked.subarray(
      v.byteOffset ?? 0,
      (v.byteOffset ?? 0) + v.byteLength,
    ),
    pad = -packedLength & 3;
  if (pad) {
    packed.push(Buffer.alloc(pad));
    packedLength += pad;
  }
  viewMap.set(index, doc.bufferViews.length);
  doc.bufferViews.push({ ...v, byteOffset: packedLength });
  packed.push(bytes);
  packedLength += bytes.length;
}
for (const a of doc.accessors) a.bufferView = viewMap.get(a.bufferView);
for (const i of doc.images) i.bufferView = viewMap.get(i.bufferView);
const packedBin = Buffer.concat(packed);
function payload(d, b, index) {
  const a = d.accessors[index],
    v = d.bufferViews[a.bufferView];
  return b.subarray(
    (v.byteOffset ?? 0) + (a.byteOffset ?? 0),
    (v.byteOffset ?? 0) + v.byteLength,
  );
}
for (const before of original.animations.filter(
  (a) => !changed.includes(a.name),
)) {
  const after = doc.animations.find((a) => a.name === before.name);
  for (let i = 0; i < before.samplers.length; i++)
    for (const property of ["input", "output"])
      assert.ok(
        payload(original, originalBin, before.samplers[i][property]).equals(
          payload(doc, packedBin, after.samplers[i][property]),
        ),
        before.name + " " + property,
      );
}
report.preservedAnimationPayloads = true;
report.unpackedBytes = byteLength;
report.textureImages = doc.images.length;
doc.buffers[0].byteLength = packedLength;
let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc(-json.length & 3, 32)]);
let bin = Buffer.concat([packedBin, Buffer.alloc(-packedBin.length & 3)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, json, bh, bin]);
writeFileSync(target, result);
report.sha256 = createHash("sha256").update(result).digest("hex");
report.bytes = result.length;
report.rigBones = joints.length;
mkdirSync("dist-validation/trooper-design", { recursive: true });
writeFileSync(
  "public/assets/characters/standard_trooper_v9.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
