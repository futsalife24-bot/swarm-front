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
async function load(file) {
  const bytes = readFileSync(file);
  const { scene, animations } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.rotation.y = -Math.PI / 2;
  scene.updateMatrixWorld(true);
  return { scene, clips: new Map(animations.map(c => [c.name, c])),
    mixer: new T.AnimationMixer(scene),
    sha256: createHash('sha256').update(bytes).digest('hex') };
}
const old = await load(path.resolve(dir, '../../biped-v13/harrow.glb'));
const now = await load(path.resolve(dir, '../harrow.glb'));
const clipNames = ['Takeoff', 'TakeoffB', 'TakeoffC', 'TakeoffD', 'Flight'];
const SCALE = 1.95;
const temp = new T.Vector3();
function pose(model, name, time) {
  model.mixer.stopAllAction();
  const clip = model.clips.get(name);
  assert.ok(clip, name);
  const action = model.mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  model.mixer.setTime(time);
  model.scene.updateMatrixWorld(true);
}
function vertex(model, pick) {
  const mesh = model.scene.getObjectByName(pick.mesh);
  mesh.skeleton.update();
  return mesh.getVertexPosition(pick.vertex, new T.Vector3())
    .applyMatrix4(mesh.matrixWorld).multiplyScalar(SCALE);
}
function shoulder(model, side) {
  return model.scene.getObjectByName(`Wing_upper${side}`)
    .getWorldPosition(new T.Vector3()).multiplyScalar(SCALE);
}
const picks = {};
pose(now, 'Flight', 0);
for (const side of ['L', 'R']) {
  const choices = [
    { kind: 'outer', meshes: [`Wing${side}`] },
    { kind: 'claw', meshes: [] },
  ];
  choices[1].meshes = [];
  now.scene.traverse(o => {
    if (o.isSkinnedMesh && o.name.startsWith(`Launcher${side}_`))
      choices[1].meshes.push(o.name);
  });
  assert.equal(choices[1].meshes.length, 5);
  for (const { kind, meshes } of choices) {
    let best = { lateral: -Infinity };
    for (const name of meshes) {
      const mesh = now.scene.getObjectByName(name);
      mesh.skeleton.update();
      const count = mesh.geometry.getAttribute('position').count;
      for (let index = 0; index < count; index++) {
        mesh.getVertexPosition(index, temp).applyMatrix4(mesh.matrixWorld);
        const lateral = Math.abs(temp.x);
        if (lateral > best.lateral)
          best = { mesh: name, vertex: index, lateral };
      }
    }
    picks[`${side}/${kind}`] = best;
  }
}
function samples(model, clipName, side, pick) {
  const duration = Math.min(model.clips.get(clipName).duration,
    clipName === 'Flight' ? 3 : 2.5);
  const values = [];
  for (let step = 0; step <= Math.round(duration / .05); step++) {
    const time = step * .05;
    pose(model, clipName, time);
    const world = vertex(model, pick);
    const relative = world.clone().sub(shoulder(model, side));
    values.push({ time, world: world.toArray(), relative: relative.toArray() });
  }
  return values;
}
function delta(a, b) {
  const d = b.relative.map((x, i) => x - a.relative[i]);
  const world = b.world.map((x, i) => x - a.world[i]);
  return { from: a.time, to: b.time,
    verticalDown: -d[1], horizontal: Math.hypot(d[0], d[2]),
    ratio: -d[1] / Math.max(1e-9, Math.hypot(d[0], d[2])),
    worldVerticalDown: -world[1], worldHorizontal: Math.hypot(world[0], world[2]) };
}
const rows = [];
for (const name of clipNames) {
  for (const side of ['L', 'R']) {
    for (const kind of ['outer', 'claw']) {
      const pick = picks[`${side}/${kind}`];
      const current = samples(now, name, side, pick);
      const previous = samples(old, name, side, pick);
      const changes = [];
      for (let i = 0; i + 5 < current.length; i++) {
        const next = delta(current[i], current[i + 5]);
        if (next.verticalDown > 0) changes.push({ i, ...next });
      }
      const strong = changes.reduce((a, b) =>
        !a || b.verticalDown > a.verticalDown ? b : a, null);
      assert.ok(strong, `${name} ${side} ${kind} has no downstroke`);
      const oldAtSameTime = delta(previous[strong.i], previous[strong.i + 5]);
      assert.ok(strong.verticalDown > strong.horizontal,
        `${name} ${side} ${kind} stroke is more horizontal than vertical`);
      assert.ok(strong.worldVerticalDown > 0,
        `${name} ${side} ${kind} wing did not move down in game space`);
      rows.push({ clip: name, side, kind, pick,
        downstroke: { from: strong.from, to: strong.to,
          verticalDown: strong.verticalDown, horizontal: strong.horizontal,
          ratio: strong.ratio, worldVerticalDown: strong.worldVerticalDown,
          worldHorizontal: strong.worldHorizontal },
        v13SameTimes: oldAtSameTime });
    }
  }
}
const report = { currentSha256: now.sha256, previousSha256: old.sha256,
  axes: 'game world: Y up, X lateral, Z forward; shoulder-relative isolates wing stroke',
  sampleStepSeconds: .05, intervalSeconds: .25, picks, rows };
writeFileSync(path.join(dir, 'flap-trajectory.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: true, currentSha256: now.sha256,
  minimumRatio: Math.min(...rows.map(r => r.downstroke.ratio)),
  rows: rows.length }));
