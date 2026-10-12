import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const loader = new GLTFLoader().register(() => ({
  name: 'GEOMETRY_ONLY', loadTexture: async () => new T.Texture(),
}));
async function clips(file) {
  const bytes = readFileSync(file);
  const { animations } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return new Map(animations.map(clip => [clip.name, clip]));
}
function digest(clip) {
  const hash = createHash('sha256');
  for (const track of clip.tracks) {
    hash.update(track.name);
    hash.update(Buffer.from(track.times.buffer, track.times.byteOffset, track.times.byteLength));
    hash.update(Buffer.from(track.values.buffer, track.values.byteOffset, track.values.byteLength));
  }
  return hash.digest('hex');
}
const before = await clips(path.resolve(dir, '../../biped-v13/harrow.glb'));
const after = await clips(path.resolve(dir, '../harrow.glb'));
assert.equal(before.size, 18);
assert.deepEqual([...after.keys()], [...before.keys()]);
const expected = new Set(['Takeoff', 'TakeoffB', 'TakeoffC', 'TakeoffD', 'Flight']);
const rows = [];
for (const [name, previous] of before) {
  const current = after.get(name);
  const oldHash = digest(previous), newHash = digest(current);
  const changed = oldHash !== newHash;
  assert.equal(changed, expected.has(name), name);
  rows.push({ name, changed, v13: oldHash, v14: newHash });
}
writeFileSync(path.join(dir, 'clip-comparison.json'), JSON.stringify({ rows }, null, 2));
console.log(JSON.stringify({ pass: true, changed: rows.filter(r => r.changed).map(r => r.name),
  unchanged: rows.filter(r => !r.changed).length }));
