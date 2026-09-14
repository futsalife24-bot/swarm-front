// Injected only into the recording browser. Production battle cameras are unchanged.
window.__filmCamera = (camera, focus, distance) => {
  const start=camera.position.clone(),rotation=camera.quaternion.clone();
  const end=focus.clone().addScaledVector(start.clone().sub(focus).normalize(),distance);
  const target=camera.clone();target.position.copy(end);target.lookAt(focus);
  const right=new T.Vector3(1,0,0).applyQuaternion(target.quaternion);
  target.lookAt(focus.clone().addScaledVector(right,-distance*.14));
  const pose=camera.clone();
  return t=>{pose.position.lerpVectors(start,end,t);pose.quaternion.slerpQuaternions(rotation,target.quaternion,t);return pose};
};
window.__filmPrepare=async key=>{
  paused=true;save.encounters=Object.fromEntries(Object.keys(names).map(k=>[k,'solo']));
  for(const d of document.querySelectorAll('dialog'))d.close();
  await new Promise(requestAnimationFrame);encounterActive=false;
  world.enemies=[];world.projectiles=[];
  const first=STAGES.find(s=>s.waves.some(w=>key==='boss'||key==='worm'?w.bosses.includes(key==='worm'?'worm':'crown'):(w.troops[key]??0)>0));
  if(!first)throw Error('No first encounter stage: '+key);
  const mapId=first.map;
  world.stage=first.id;world.solo.stage=world.stage;
  // The Foundry's wide stance needs the grassland's level eastern clearing.
  const origin=key==='boss'?{x:70,z:-60}:{x:0,z:0};
  const p=world.players[0];p.x=origin.x;p.z=origin.z+(key==='boss'||key==='worm'?58:38);
  const {supportHeight}=await import('/src/shared/terrain.ts');
  let groundRange;
  if(key==='boss'){
    const heights=[];
    for(let dx=-18;dx<=18;dx++)for(let dz=-18;dz<=18;dz++)heights.push(supportHeight(origin.x+dx,origin.z+dz,mapFor(world).blocks));
    groundRange=[Math.min(...heights),Math.max(...heights)];
    if(groundRange[1]-groundRange[0]>.001)throw Error('Foundry filming footprint is not level');
  }
  p.y=supportHeight(p.x,p.z,mapFor(world).blocks);
  const {spawn}=await import('/src/shared/game.ts');
  const e=spawn(world,key==='worm'?'boss':key,origin.x,origin.z,key==='worm'?'worm':'crown',0);
  e.targetId=p.id;e.tx=p.x;e.tz=p.z;e.cool=0;e.wind=0;e.hurt=0;
  if(e.segments)for(const [i,node]of[e,...e.segments].entries()){
    node.x=0;node.z=-i*3.2;node.y=supportHeight(node.x,node.z,mapFor(world).blocks);node.heading=0;
  }
  controls.input.yaw=0;controls.input.pitch=0;
  view.render(world,'solo',0,0,0,undefined,false,false);
  if(e.segments)await view.foundryWorms.get(e.id).loading;
  const began=performance.now();
  while(view.mapAssets.status[mapId].state!=='ready'||view.mapAssets.distantStatus[mapId].state!=='ready'){
    if(performance.now()-began>45000)throw Error('Film map did not load');await new Promise(requestAnimationFrame);
  }
  view.render(world,'solo',0,0,0,undefined,false,false);
  encounterActive=true;
  for(const actor of view.players.values())actor.visible=false;
  const focus=new T.Vector3(e.x,eye(e),e.z);
  view.camera.position.set(p.x,focus.y+4,p.z+5);view.camera.lookAt(focus);
  view.camera.fov=55;view.camera.updateProjectionMatrix();
  await view.renderer.compileAsync(view.scene,view.camera);
  view.renderer.render(view.scene,view.camera);
  window.__filmKey=key;window.__filmWorld=JSON.stringify(world);
  window.__filmStart=view.camera.position.clone();window.__filmFocus=focus;
  const front=view.encounterFront(e),toward=view.camera.position.clone().sub(focus);front.y=0;toward.y=0;
  return {idleDuration:key==='worm'?6:view.structures.get(key).batch.asset.ranges.Idle.duration,name:names[key],stage:first.id,stageName:first.name,map:MAPS[mapId].name,origin,groundRange,frontDot:front.normalize().dot(toward.normalize()),enemy:e.id};
};
window.__filmBegin=()=>{
  encounterActive=false;delete save.encounters[window.__filmKey];encounter();
  const d=document.querySelector('.pt-cutscene');if(!d)throw Error('Film intro missing');
  const captions={crawler:'獣の背を思わせる乾いた被覆。その下の支持肢は、外から見える体形と一致しない。',ant:'五脚と浮遊する背骨を持つ、HOUNDの派生個体。',spider:'五脚を縮めて跳躍し、壁を足場に再び飛び出す。',spitter:'非対称の多面体が浮遊し、コアの周囲に独立したプレートを巡らせる。',hornet:'エイのような平面と中央の縦穴。羽ばたかず、空中を遊泳する。',boss:'壁・レール・リングからなる巨体を、大きな支持脚が支える。',worm:'ひとつの頭部に七つの胴節が連なり、多数の脚で地面を這う。'};
  d.querySelector('.menu-dialog-body p').textContent=captions[window.__filmKey];
  return encounterActive;
};
window.__filmCheck=()=>{
 const e=world.enemies[0],f=view.encounterFront(e),v=view.camera.position.clone().sub(window.__filmFocus);
 f.y=0;v.y=0;const start=window.__filmStart.clone().sub(window.__filmFocus).normalize();
 const delta=view.camera.position.clone().sub(window.__filmFocus).normalize();
 return {worldFrozen:JSON.stringify(world)===window.__filmWorld,frontDot:f.normalize().dot(v.normalize()),straightDot:start.dot(delta),phase:document.querySelector('.pt-cutscene')?.dataset.phase};
};
