import fs from 'node:fs/promises';
import {transform} from 'esbuild';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
// Recover the preserved primitive soldier builder without invoking any browser loader.
const source=await fs.readFile('src/client/render.ts','utf8');
const section=source.slice(source.indexOf('const mats ='),source.indexOf('export function poseSoldier')).replaceAll('export function','function');
const js=(await transform(section,{loader:'ts',target:'es2022'})).code;
const root=new Function('T',js+'\nreturn soldier;')(T)(0x526570);
const body=root.children[0].children[0];
// Same neutral T pose as the two skinned models. Hide the original gun only.
root.userData.gun.visible=false;
for(const [index,sign] of [[6,-1],[9,1]]){
 const arm=body.children[index];arm.rotation.set(0,0,Math.PI/2);arm.position.set(sign*.67,1.35,0);
}
root.userData={};root.updateMatrixWorld(true);
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(x=>{this.result='data:application/octet-stream;base64,'+Buffer.from(x).toString('base64');this.onloadend?.();});} };
await fs.mkdir('test-results/soldier-comparison',{recursive:true});
const out=await new GLTFExporter().parseAsync(root,{binary:true});
await fs.writeFile('test-results/soldier-comparison/initial.glb',Buffer.from(out));
console.log('初期図形モデルを同じTポーズで書き出しました。形状の出典: src/client/render.ts soldier()。');
