import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{const p=await browser.newPage({viewport:{width:1280,height:720}});await p.route('**/worm-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0">'}));await p.goto('http://127.0.0.1:5351/worm-check');
const result=await p.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{FoundryWormView,FOUNDRY_WORM_ASSET}=await import('/src/client/foundry-worm.ts'),{reportWorm}=await import('/src/client/enemy-report-motion.ts'),{foundryLaserDirection,foundryLaserOrigin}=await import('/src/shared/foundry-defs.ts');
 const v=await FoundryWormView.load(FOUNDRY_WORM_ASSET),neutral=reportWorm('idle',0),charged=reportWorm('attack',.52),before=JSON.stringify(charged);v.update(neutral,0);const head=v.units[0];
 const emitters=Array.from({length:6},(_,i)=>head.getObjectByName(`FZ_HEAD_EMITTER_${String(i+1).padStart(2,'0')}`));
 v.update(charged,.52);if(before!==JSON.stringify(charged))throw Error('mutated world');const emitterAngles=emitters.map(o=>o.quaternion.angleTo(new T.Quaternion()));
 const laserAngles=v.units.map((u,i)=>{const laser=u.getObjectByName(i?`${u.name}_LASER`:'FZ_HEAD_CENTRAL_LASER'),direction=new T.Vector3(0,0,-1).applyQuaternion(laser.quaternion),n=[charged,...charged.segments][i],d=foundryLaserDirection(foundryLaserOrigin(n,i),n.pulseAim);return direction.angleTo(new T.Vector3(d.x,d.y,d.z));});
 const fired=reportWorm('attack',.8);v.update(fired,.8);let maxFireError=0,maxOriginError=0;
 v.units.forEach((u,i)=>{const laser=u.getObjectByName(i?`${u.name}_LASER`:'FZ_HEAD_CENTRAL_LASER'),n=[fired,...fired.segments][i],origin=foundryLaserOrigin(n,i),d=foundryLaserDirection(origin,n.pulseAim);maxFireError=Math.max(maxFireError,new T.Vector3(0,0,-1).applyQuaternion(laser.quaternion).angleTo(new T.Vector3(d.x,d.y,d.z)));maxOriginError=Math.max(maxOriginError,laser.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(origin.x,origin.y,origin.z)));});
 if(emitterAngles.some(v=>v<.45)||laserAngles.some(v=>v<.5)||maxFireError>1e-6||maxOriginError>1e-5)throw Error(JSON.stringify({emitterAngles,laserAngles,maxFireError,maxOriginError}));
 v.update(neutral,.9);if(emitters.some(o=>o.quaternion.angleTo(new T.Quaternion())>1e-6))throw Error('aborted pose not reset');
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,720);renderer.setScissorTest(true);document.body.append(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color('#10202a');scene.add(new T.HemisphereLight(0xdcefff,0x566577,2.6));const light=new T.DirectionalLight(0xffffff,3);light.position.set(4,8,-6);scene.add(light,v.root);const camera=new T.PerspectiveCamera(38,640/720,.01,500);camera.position.set(7,6,-10);camera.lookAt(0,1.8,1.5);
 for(const i of [0,1]){v.update(i?charged:neutral,i?.52:0);renderer.setViewport(i*640,0,640,720);renderer.setScissor(i*640,0,640,720);renderer.render(scene,camera);}
 return {emitterAngles,laserAngles,maxFireError,maxOriginError,worldUnchanged:true,abortResets:true};
});await p.screenshot({path:'dist-validation/enemy-windup/worm-charge.png'});fs.writeFileSync('dist-validation/enemy-windup/worm-numeric.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close()}
