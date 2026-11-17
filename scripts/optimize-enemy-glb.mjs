// Lightweight rewrite of a runtime enemy GLB without touching its scene graph,
// skeleton, vertex order or animation data.
//
//   node scripts/optimize-enemy-glb.mjs <in.glb> <out.glb> [options]
//     --max-texture=<px>      downscale larger textures to this edge (power of two kept)
//     --jpeg-quality=<q>      re-encode JPEG textures with mozjpeg at quality q
//     --webp-lossless         re-encode PNG textures as lossless WebP (EXT_texture_webp)
//     --weights16             store WEIGHTS_0 as normalized uint16 (sum kept at exactly 1)
//     --meshopt               lossless EXT_meshopt_compression for geometry/animation
//                             (loaders must call setMeshoptDecoder)
//
// Only the listed buffers change. Nodes, meshes, materials, skins and animation
// accessors are copied byte-for-byte, so motion and bone binding stay identical.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { MeshoptEncoder } from "meshoptimizer";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { parseGlb } from "./inspect-enemy-glb.mjs";

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: optimize-enemy-glb.mjs <in> <out> [options]");
const option = (name) => {
  const flag = flags.find((f) => f === `--${name}` || f.startsWith(`--${name}=`));
  if (!flag) return undefined;
  return flag.includes("=") ? flag.split("=")[1] : true;
};
const maxTexture = Number(option("max-texture") ?? 0);
const jpegQuality = Number(option("jpeg-quality") ?? 0);
const webpLossless = option("webp-lossless") === true;
const weights16 = option("weights16") === true;
const meshopt = option("meshopt") === true;

const { json, bin } = parseGlb(readFileSync(input));
if ((json.buffers ?? []).length !== 1 || json.buffers[0].uri)
  throw new Error("expected one embedded buffer");
const views = json.bufferViews;
const payload = views.map((v) =>
  Buffer.from(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)),
);
const report = { textures: [], weights: 0 };
const addExtension = (name, required) => {
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), name])];
  if (required)
    json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), name])];
};

// Textures.
for (const [index, image] of (json.images ?? []).entries()) {
  if (image.bufferView === undefined) throw new Error("external image");
  const source = payload[image.bufferView];
  let pipeline = sharp(source);
  const meta = await pipeline.metadata();
  let width = meta.width;
  let height = meta.height;
  if (maxTexture && Math.max(width, height) > maxTexture) {
    const scale = maxTexture / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    pipeline = pipeline.resize(width, height, { kernel: "lanczos3" });
  }
  let data;
  let mimeType = image.mimeType;
  if (meta.format === "jpeg" && (jpegQuality || width !== meta.width)) {
    data = await pipeline
      .jpeg({ quality: jpegQuality || 92, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  } else if (meta.format === "png" && webpLossless) {
    if (width !== meta.width) throw new Error("lossless WebP path must keep size");
    data = await pipeline.webp({ lossless: true, effort: 6, exact: true }).toBuffer();
    // Verify bit-exact pixels before accepting the lossless conversion.
    const [a, b] = await Promise.all([
      sharp(source).raw().toBuffer(),
      sharp(data).removeAlpha().raw().toBuffer(),
    ]);
    if (!a.equals(b)) throw new Error(`WebP not lossless for image ${index}`);
    mimeType = "image/webp";
  } else continue;
  report.textures.push({
    index,
    name: image.name ?? "",
    from: `${meta.format} ${meta.width}x${meta.height} ${source.length}`,
    to: `${mimeType} ${width}x${height} ${data.length}`,
  });
  payload[image.bufferView] = data;
  image.mimeType = mimeType;
}
if (webpLossless && (json.images ?? []).some((i) => i.mimeType === "image/webp")) {
  for (const texture of json.textures ?? []) {
    if (json.images[texture.source]?.mimeType !== "image/webp") continue;
    texture.extensions = { ...(texture.extensions ?? {}), EXT_texture_webp: { source: texture.source } };
    delete texture.source;
  }
  addExtension("EXT_texture_webp", true);
}

// Skin weights.
if (weights16) {
  const done = new Set();
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives) {
      const accessorIndex = primitive.attributes.WEIGHTS_0;
      if (accessorIndex === undefined || done.has(accessorIndex)) continue;
      done.add(accessorIndex);
      const accessor = json.accessors[accessorIndex];
      const view = views[accessor.bufferView];
      if (accessor.componentType !== 5126 || accessor.type !== "VEC4" || view.byteStride)
        throw new Error("unexpected weight layout");
      const users = json.accessors.filter((a) => a.bufferView === accessor.bufferView).length;
      if (users !== 1) throw new Error("shared weight bufferView");
      const source = payload[accessor.bufferView];
      const floats = new Float32Array(
        source.buffer.slice(source.byteOffset + (accessor.byteOffset ?? 0), source.byteOffset + (accessor.byteOffset ?? 0) + accessor.count * 16),
      );
      const out = new Uint16Array(accessor.count * 4);
      for (let v = 0; v < accessor.count; v++) {
        const w = floats.subarray(v * 4, v * 4 + 4);
        const sum = w[0] + w[1] + w[2] + w[3];
        let largest = 0;
        let total = 0;
        for (let k = 0; k < 4; k++) {
          out[v * 4 + k] = Math.round((w[k] / (sum || 1)) * 65535);
          total += out[v * 4 + k];
          if (w[k] > w[largest]) largest = k;
        }
        out[v * 4 + largest] += 65535 - total;
      }
      payload[accessor.bufferView] = Buffer.from(out.buffer);
      view.byteLength = out.byteLength;
      accessor.byteOffset = 0;
      accessor.componentType = 5123;
      accessor.normalized = true;
      delete accessor.min;
      delete accessor.max;
      report.weights += accessor.count;
    }
}

// Lossless EXT_meshopt_compression (no quantization filters). Every encoded view
// is decoded again with three.js' shipped decoder and compared before use.
const compressed = new Map();
if (meshopt) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const elementSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const indexViews = new Set();
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives)
      if (primitive.indices !== undefined) indexViews.add(json.accessors[primitive.indices].bufferView);
  const imageViews = new Set((json.images ?? []).map((i) => i.bufferView));
  const strides = new Map();
  for (const accessor of json.accessors) {
    if (accessor.bufferView === undefined) continue;
    const stride = elementSize[accessor.componentType] * components[accessor.type];
    const known = strides.get(accessor.bufferView);
    strides.set(accessor.bufferView, known === undefined || known === stride ? stride : -1);
  }
  for (const [i, view] of views.entries()) {
    if (imageViews.has(i) || view.byteStride) continue;
    const stride = strides.get(i);
    const source = new Uint8Array(payload[i]);
    if (!stride || stride < 0 || source.length % stride) continue;
    const count = source.length / stride;
    const triangles = indexViews.has(i) && (stride === 2 || stride === 4) && count % 3 === 0;
    if (!triangles && stride % 4) continue;
    const mode = triangles ? "TRIANGLES" : "ATTRIBUTES";
    const encoded = MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode, 0);
    if (encoded.length >= source.length) continue;
    const decoded = new Uint8Array(source.length);
    MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, mode, "NONE");
    if (triangles) {
      const read = (bytes) =>
        stride === 2 ? new Uint16Array(bytes.buffer, bytes.byteOffset, count) : new Uint32Array(bytes.buffer, bytes.byteOffset, count);
      const [a, b] = [read(source), read(decoded)];
      for (let t = 0; t < count; t += 3) {
        const same = [0, 1, 2].some((r) => a[t] === b[t + r] && a[t + 1] === b[t + ((r + 1) % 3)] && a[t + 2] === b[t + ((r + 2) % 3)]);
        if (!same) throw new Error(`meshopt index mismatch in view ${i}`);
      }
    } else if (!Buffer.from(decoded).equals(Buffer.from(source)))
      throw new Error(`meshopt attribute mismatch in view ${i}`);
    compressed.set(i, { data: Buffer.from(encoded), count, stride, mode, rawLength: source.length });
  }
  if (compressed.size) {
    addExtension("EXT_meshopt_compression", true);
    json.buffers.push({ byteLength: 0, extensions: { EXT_meshopt_compression: { fallback: true } } });
  }
  report.meshopt = { views: compressed.size, raw: 0, encoded: 0 };
  for (const c of compressed.values()) {
    report.meshopt.raw += c.rawLength;
    report.meshopt.encoded += c.data.length;
  }
}

// Repack the single GLB buffer (4-byte aligned views). Compressed views point at
// the data-less fallback buffer and carry their encoded bytes in the GLB buffer.
const chunks = [];
let offset = 0;
let fallbackOffset = 0;
for (const [i, view] of views.entries()) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  offset += pad;
  const packed = compressed.get(i);
  if (packed) {
    fallbackOffset += (4 - (fallbackOffset % 4)) % 4;
    view.buffer = json.buffers.length - 1;
    view.byteOffset = fallbackOffset;
    view.byteLength = packed.rawLength;
    fallbackOffset += packed.rawLength;
    view.extensions = {
      ...(view.extensions ?? {}),
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset: offset,
        byteLength: packed.data.length,
        byteStride: packed.stride,
        count: packed.count,
        mode: packed.mode,
      },
    };
    chunks.push(packed.data);
    offset += packed.data.length;
    continue;
  }
  view.byteOffset = offset;
  view.byteLength = payload[i].length;
  chunks.push(payload[i]);
  offset += payload[i].length;
}
const tail = (4 - (offset % 4)) % 4;
if (tail) chunks.push(Buffer.alloc(tail));
const binOut = Buffer.concat(chunks);
json.buffers[0].byteLength = offset;
if (compressed.size) json.buffers[json.buffers.length - 1].byteLength = fallbackOffset;

let jsonOut = Buffer.from(JSON.stringify(json), "utf8");
jsonOut = Buffer.concat([jsonOut, Buffer.alloc((4 - (jsonOut.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonOut.length + 8 + binOut.length, 8);
const chunkHeader = (length, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(length, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
writeFileSync(
  output,
  Buffer.concat([header, chunkHeader(jsonOut.length, 0x4e4f534a), jsonOut, chunkHeader(binOut.length, 0x004e4942), binOut]),
);
console.log(JSON.stringify({ input, output, bytes: [bin.length, binOut.length], ...report }, null, 1));
