// Inspect enemy GLB contents: polygons, textures, animation length and byte breakdown.
// Usage: node scripts/inspect-enemy-glb.mjs <file.glb> [...] [--json]
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

export function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  let offset = 12;
  let json;
  let bin = Buffer.alloc(0);
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = data;
    offset += 8 + length;
  }
  return { json, bin };
}

function imageSize(buf, mime) {
  if (mime === "image/png" || buf.readUInt32BE(0) === 0x89504e47)
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (mime === "image/jpeg" || (buf[0] === 0xff && buf[1] === 0xd8)) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (chunk === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  return null;
}

export function inspect(file) {
  const bytes = readFileSync(file);
  const { json, bin } = parseGlb(bytes);
  const views = json.bufferViews ?? [];
  const accessors = json.accessors ?? [];
  const viewUse = new Map();
  const mark = (view, use) => {
    if (view === undefined) return;
    if (!viewUse.has(view)) viewUse.set(view, use);
  };
  const images = (json.images ?? []).map((img, index) => {
    mark(img.bufferView, "texture");
    const view = views[img.bufferView];
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const size = imageSize(data, img.mimeType);
    return { index, name: img.name ?? "", mime: img.mimeType, bytes: view.byteLength, width: size?.[0], height: size?.[1] };
  });
  for (const anim of json.animations ?? [])
    for (const s of anim.samplers) {
      mark(accessors[s.input].bufferView, "animation");
      mark(accessors[s.output].bufferView, "animation");
    }
  for (const skin of json.skins ?? [])
    if (skin.inverseBindMatrices !== undefined) mark(accessors[skin.inverseBindMatrices].bufferView, "skin");
  let triangles = 0;
  let vertices = 0;
  let primitives = 0;
  for (const mesh of json.meshes ?? [])
    for (const p of mesh.primitives) {
      primitives += 1;
      const pos = accessors[p.attributes.POSITION];
      vertices += pos.count;
      if (p.indices !== undefined) mark(accessors[p.indices].bufferView, "geometry");
      for (const a of Object.values(p.attributes)) mark(accessors[a].bufferView, "geometry");
      for (const t of p.targets ?? []) for (const a of Object.values(t)) mark(accessors[a].bufferView, "morph");
      const count = p.indices !== undefined ? accessors[p.indices].count : pos.count;
      const mode = p.mode ?? 4;
      if (mode === 4) triangles += count / 3;
      else if (mode === 5 || mode === 6) triangles += count - 2;
    }
  // Count each mesh instance as drawn (nodes referencing meshes).
  const nodeMeshUse = (json.nodes ?? []).filter((n) => n.mesh !== undefined).length;
  const bytesBy = { texture: 0, geometry: 0, animation: 0, skin: 0, morph: 0, other: 0 };
  // Stored bytes: meshopt-compressed views count their encoded size.
  views.forEach(
    (v, i) =>
      (bytesBy[viewUse.get(i) ?? "other"] +=
        v.extensions?.EXT_meshopt_compression?.byteLength ?? v.byteLength),
  );
  const animations = (json.animations ?? []).map((a) => {
    let duration = 0;
    let keys = 0;
    for (const s of a.samplers) {
      const input = accessors[s.input];
      duration = Math.max(duration, input.max?.[0] ?? 0);
      keys += input.count;
    }
    return { name: a.name, duration: +duration.toFixed(3), channels: a.channels.length, keys };
  });
  return {
    file: basename(file),
    fileBytes: statSync(file).size,
    jsonBytes: Buffer.byteLength(JSON.stringify(json)),
    binBytes: bin.length,
    bytesBy,
    meshes: (json.meshes ?? []).length,
    meshNodes: nodeMeshUse,
    primitives,
    triangles,
    vertices,
    materials: (json.materials ?? []).length,
    textures: (json.textures ?? []).length,
    images,
    skins: (json.skins ?? []).map((s) => s.joints.length),
    animations,
    extensionsUsed: json.extensionsUsed ?? [],
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("inspect-enemy-glb.mjs")) {
  const asJson = process.argv.includes("--json");
  const files = process.argv.slice(2).filter((a) => a !== "--json");
  const results = files.map(inspect);
  if (asJson) console.log(JSON.stringify(results, null, 2));
  else
    for (const r of results) {
      console.log(`\n# ${r.file}  ${(r.fileBytes / 1e6).toFixed(2)}MB  json=${r.jsonBytes}`);
      console.log(`  bytes: ${Object.entries(r.bytesBy).filter(([, v]) => v).map(([k, v]) => `${k}=${(v / 1e6).toFixed(2)}MB`).join(" ")}`);
      console.log(`  meshes=${r.meshes} meshNodes=${r.meshNodes} prims=${r.primitives} tris=${r.triangles} verts=${r.vertices} materials=${r.materials} skins=${JSON.stringify(r.skins)}`);
      console.log(`  images: ${r.images.map((i) => `${i.name || i.index}:${i.mime}:${i.width}x${i.height}:${(i.bytes / 1e6).toFixed(2)}MB`).join(", ") || "none"}`);
      console.log(`  anims: ${r.animations.map((a) => `${a.name}(${a.duration}s,ch${a.channels},k${a.keys})`).join(", ") || "none"}`);
      if (r.extensionsUsed.length) console.log(`  ext: ${r.extensionsUsed.join(",")}`);
    }
}
