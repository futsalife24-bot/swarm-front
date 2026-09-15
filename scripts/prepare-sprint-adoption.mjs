import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const src='assets/blender/candidates/trooper/ual-run-20260913/sprint.glb',dest='public/assets/characters/standard_trooper_sprint_v8.glb',sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(src),meta=JSON.parse(fs.readFileSync('assets/blender/candidates/trooper/ual-run-20260913/sprint.json'));
assert.equal(sha(bytes),meta.sha256);assert.equal(meta.stride,5.21351158618927);
function glb(b){const n=b.readUInt32LE(12);return {doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)}}
const old=glb(fs.readFileSync('public/assets/characters/standard_trooper_v7.glb')),now=glb(bytes);
for(const k of ['nodes','skins','meshes','materials','textures','images'])assert.deepEqual(now.doc[k],old.doc[k]);
assert.deepEqual(now.doc.animations.slice(0,18),old.doc.animations);assert.equal(now.doc.animations.length,19);assert.equal(now.doc.animations[18].name,'UAL_sprint');assert.ok(now.bin.subarray(0,old.bin.length).equals(old.bin));
if(fs.existsSync(dest))assert.equal(sha(fs.readFileSync(dest)),sha(bytes));else fs.writeFileSync(dest,bytes);
fs.writeFileSync('public/assets/characters/standard_trooper_sprint_v8.json',JSON.stringify({status:'provisional B, user selected',source:'Quaternius Universal Animation Library Standard / Sprint_Loop',sourceURL:'https://opengameart.org/content/universal-animation-library',license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',stride:meta.stride,originalDuration:meta.duration,clip:'UAL_sprint',base:'standard_trooper_v7.glb',originalClipsPreserved:18,sha256:sha(bytes),adjustments:meta.scope},null,2));
fs.writeFileSync('dist-validation/trooper-sprint-adoption/preservation.json',JSON.stringify({candidateAndPublicByteIdentical:true,originalDataPreserved:true,originalClips:18,clips:19,bones:now.doc.skins[0].joints.length,sha256:sha(bytes)},null,2));console.log('Preserved original model and 18 clips; exact reviewed B copied to new v8 name');
