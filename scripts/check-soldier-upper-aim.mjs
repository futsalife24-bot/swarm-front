import fs from 'node:fs/promises';
import { build } from 'esbuild';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
await fs.mkdir('test-results/upper-aim',{recursive:true});
await build({absWorkingDir:process.cwd(),tsconfigRaw:{compilerOptions:{target:'ES2022'}},entryPoints:['./src/client/standard-trooper.ts'],bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.DEV':'false','import.meta.env.BASE_URL':'"/"'},outfile:'test-results/upper-aim/runtime.mjs'});
const {StandardTrooper}=await import(new URL('../test-results/upper-aim/runtime.mjs',import.meta.url));
const raw=await fs.readFile('public/assets/characters/swarm-soldier.glb');const n=raw.readUInt32LE(12);const doc=JSON.parse(raw.subarray(20,20+n));
delete doc.images;delete doc.textures;delete doc.materials;for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const tail=raw.subarray(20+n),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const b=Buffer.concat([header,json,tail]);
const character=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const actor=new StandardTrooper({character,weapons:{rifle:new T.Group(),shotgun:new T.Group(),rocket:new T.Group()}});
const direction=()=>new T.Vector3(1,0,0).applyQuaternion(actor.hand.getWorldQuaternion(new T.Quaternion()));
const rows=[];
for(const profile of ['Rifle','Shotgun','Rocket'])for(const lower of ['Lower_Run','Lower_Walk','Lower_Run_Backward']){
 let max=0;const samples=[];
 for(let i=0;i<=24;i++){
  actor.sample(`Fire_${profile}`,.05);const ref=direction();
  actor.sample(`Upper_Fire_${profile}`,.05,lower,i/24);const got=direction();
  const degrees=ref.angleTo(got)*180/Math.PI;max=Math.max(max,degrees);samples.push({t:i/24,degrees,pitch:Math.asin(got.y)*180/Math.PI});
 }
 rows.push({profile,lower,maxDegrees:max,samples});
}
const output=process.argv[2]||'test-results/upper-aim/result.json';await fs.writeFile(output,JSON.stringify({scope:'Same upper fire clip with moving lower-body clips; angular difference from authored full-body fire. Textures omitted only.',rows},null,2));
for(const r of rows)console.log(r.profile,r.lower,r.maxDegrees.toFixed(3));


const live=[];
for(const [label,mx,mz] of [['forward',0,1],['back',0,-1],['left',-1,0],['right',1,0]]){
 const p={id:'probe',x:0,z:0,y:0,yaw:0,pitch:0,hp:160,slot:0,reload:0,evade:0,swapCd:0,cool:0,ammo:[32,7],weapons:[{id:'r',kind:'rifle',rarity:0,power:1,effect:'none'},{id:'s',kind:'shotgun',rarity:0,power:1,effect:'none'}]};
 let min=100,max=-100;
 for(let i=0;i<180;i++){
  const dt=1/60;p.x+=mx*7*dt;p.z-=mz*7*dt;p.cool-=dt;if(p.cool<=0)p.cool=.13;
  actor.update(p,0,i*dt,label,dt,p,false);
  if(i>=60){const pitch=Math.asin(direction().y)*180/Math.PI;min=Math.min(min,pitch);max=Math.max(max,pitch);}
 }
 live.push({label,minPitch:min,maxPitch:max});
}
console.log('runtime',JSON.stringify(live));
await fs.writeFile(output.replace('.json','-runtime.json'),JSON.stringify(live,null,2));

actor.dispose();
