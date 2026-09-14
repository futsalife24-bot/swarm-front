import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const dir = 'assets/blender/candidates/foundry-zero/mechanical-legs-v2';
const oldPath = 'public/assets/enemies/foundry_zero_segmented_v1.glb';
const newPath = `${dir}/foundry_zero_mechanical_legs_v2.glb`;
const output = `${dir}/review`;
mkdirSync(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function inspect(path) {
  const bytes = readFileSync(path), jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const bin = bytes.subarray(28 + jsonLength);
  const accessor = index => {
    const a = doc.accessors[index], v = doc.bufferViews[a.bufferView];
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    assert.ok(!v.byteStride, 'Expected packed exported GLB attributes');
    const start = (v.byteOffset || 0) + (a.byteOffset || 0);
    return { type: a.type, componentType: a.componentType, count: a.count,
      hash: sha(bin.subarray(start, start + a.count * size * width)) };
  };
  const nonLeg = {}, pivots = {};
  for (const node of doc.nodes) {
    if (/_LEG_[LR]\d+_(HIP|UPPER|LOWER|FOOT)$/.test(node.name))
      pivots[node.name] = { translation: node.translation, rotation: node.rotation, scale: node.scale };
    if (node.mesh === undefined || node.name.includes('_LEG_')) continue;
    nonLeg[node.name] = {
      translation: node.translation, rotation: node.rotation, scale: node.scale,
      primitives: doc.meshes[node.mesh].primitives.map(p => ({
        material: doc.materials[p.material].name,
        indices: accessor(p.indices),
        attributes: Object.fromEntries(Object.entries(p.attributes).map(([key, value]) => [key, accessor(value)])),
      })),
    };
  }
  return { path, bytes: bytes.length, sha256: sha(bytes), materials: doc.materials,
    triangles: doc.meshes.reduce((sum, m) => sum + m.primitives.reduce((n, p) => n + doc.accessors[p.indices].count / 3, 0), 0),
    nonLeg, pivots };
}
const old = inspect(oldPath), next = inspect(newPath);
assert.deepEqual(next.nonLeg, old.nonLeg, 'Non-leg geometry must be byte-identical');
assert.deepEqual(next.pivots, old.pivots, 'Leg articulation transforms must be unchanged');
assert.deepEqual(next.materials, old.materials, 'Keep all five existing materials');
assert.ok(next.triangles <= old.triangles, 'Stay within original geometry budget');
writeFileSync(`${dir}/preservation.json`, JSON.stringify({
  pass: true,
  before: { path: old.path, sha256: old.sha256, bytes: old.bytes, triangles: old.triangles },
  after: { path: next.path, sha256: next.sha256, bytes: next.bytes, triangles: next.triangles },
  unchangedNonLegMeshes: Object.keys(next.nonLeg), unchangedLegPivots: Object.keys(next.pivots).length,
  materialsUnchanged: true,
}, null, 2));

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5199/${dir}/index.html`);
  await page.waitForFunction(() => window.foundryCandidate?.ready);
  await page.evaluate(async () => {
    const h = window.foundryCandidate;
    h.setPlaying(false); h.select('neutral');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const previous = await new GLTFLoader().loadAsync('/assets/enemies/foundry_zero_segmented_v1.glb');
    h.scene.add(previous.scene);
    previous.scene.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    window.showLegRevision = (revision, view) => {
      h.setView(view); h.draw(0);
      h.neutral.scene.visible = revision === 'after';
      previous.scene.visible = revision === 'before';
      h.renderer.render(h.scene, h.camera);
      document.querySelector('.badge').textContent = revision === 'before' ? '変更前' : '変更後：機械式支持脚';
    };
  });
  for (const view of ['body', 'head', 'side', 'oblique']) {
    for (const revision of ['before', 'after']) {
      await page.evaluate(([revision, view]) => window.showLegRevision(revision, view), [revision, view]);
      await page.screenshot({ path: `${output}/${revision}-${view}.png` });
    }
  }
  const before = readFileSync(`${output}/before-body.png`).toString('base64');
  const after = readFileSync(`${output}/after-body.png`).toString('base64');
  await page.setContent(`<style>body{margin:0;background:#0a151b;color:white;font:22px sans-serif}main{display:flex}section{width:50%}h2{margin:15px 24px;font-size:22px}img{display:block;width:100%}</style><main><section><h2>変更前</h2><img src="data:image/png;base64,${before}"></section><section><h2>変更後：機械式支持脚</h2><img src="data:image/png;base64,${after}"></section></main>`);
  await page.setViewportSize({ width: 1600, height: 560 });
  await page.screenshot({ path: `${output}/before-after.png` });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, oldTriangles: old.triangles, newTriangles: next.triangles,
    unchangedLegPivots: Object.keys(next.pivots).length, screenshots: output }));
} finally { await browser.close(); }
