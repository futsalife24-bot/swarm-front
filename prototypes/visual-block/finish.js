import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Derived, reversible geometry. Source GLB buffers and all animation tracks remain untouched. */
export function finishTrooper(model) {
  const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
  const source=meshes.find(o=>o.material.name==='Study_Cloth'), original=source.geometry;
  const cloth=original.clone(), positions=cloth.attributes.position,normals=cloth.attributes.normal;
  const colors=new Float32Array(positions.count*3), weights=cloth.attributes.skinWeight, indices=cloth.attributes.skinIndex;
  let maxDisplacement=0;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    let slot=0;for(let j=1;j<4;j++)if(weights.getComponent(i,j)>weights.getComponent(i,slot))slot=j;
    const name=source.skeleton.bones[indices.getComponent(i,slot)].name;
    const limb=/UpperLeg|LowerLeg|UpperArm|LowerArm/.test(name);
    const waist=/Pelvis|Spine/.test(name)&&y<1.23&&y>.95;
    const knee=Math.exp(-(((y-.54)/.14)**2)),cuff=Math.exp(-(((y-.24)/.09)**2));
    const elbow=Math.exp(-(((y-1.13)/.16)**2));
    const envelope=limb?(name.includes('Leg')?.18+.82*Math.max(knee,cuff):.18+.82*elbow):waist?.65:0;
    // Asymmetric compression folds, not uniform horizontal rings; 12 mm maximum relief.
    const phase=y*83+x*31+Math.sin(z*29+x*17)*1.6;
    const fold=Math.sin(phase)*.68+Math.sin(phase*1.71+.9)*.32;
    const d=.012*envelope*fold;maxDisplacement=Math.max(maxDisplacement,Math.abs(d));
    positions.setXYZ(i,x+normals.getX(i)*d,y+normals.getY(i)*d,z+normals.getZ(i)*d);
    // Large garment panels / seam creases remain readable after mip reduction.
    const shade=.87+.10*fold*envelope+.025*Math.sin(x*18+z*21+y*14);
    const seam=limb&&Math.abs(Math.sin(Math.atan2(z,x-Math.sign(x)*.18)*2))<.13?.90:1;
    colors.set([shade*seam,shade*seam,shade*seam],i*3);
  }
  cloth.setAttribute('color',new T.Float32BufferAttribute(colors,3));cloth.computeVertexNormals();cloth.computeBoundingBox();cloth.computeBoundingSphere();
  const oldVertexColors=source.material.vertexColors;
  const originalCompile=source.material.onBeforeCompile;
  const clothCompile=shader=>{
    originalCompile(shader);
    shader.vertexShader='varying vec3 garmentRest;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngarmentRest=position;');
    shader.fragmentShader='varying vec3 garmentRest;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float envelope=exp(-pow((garmentRest.y-.54)/.20,2.))+exp(-pow((garmentRest.y-1.12)/.20,2.))*.6;
      float h=.0015*min(envelope,1.)*sin(garmentRest.y*83.+garmentRest.x*31.+sin(garmentRest.z*29.+garmentRest.x*17.)*1.6);
      vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
      vec3 r1=cross(sy,normal),r2=cross(normal,sx);
      float det=dot(sx,r1)*faceDirection;
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));
    `);
  };
  const parts=[], groups=new Map();
  function part(name,bone,pos,size,color,radius=.008) {
    if(bone==='Chest')pos=[pos[0]-.025,pos[1],pos[2]];
    const g=new RoundedBoxGeometry(...size,2,radius);
    // Slightly taper soft pouches at their lower edge; rigid webbing stays straight.
    if(name.includes('pouch')) {const a=g.attributes.position;for(let i=0;i<a.count;i++){const f=.94+.06*(a.getY(i)/size[1]+.5);a.setX(i,a.getX(i)*f);}}
    g.translate(...pos);
    const n=g.attributes.position.count,ids=new Uint16Array(n*4),ws=new Float32Array(n*4),idx=source.skeleton.bones.findIndex(b=>b.name===bone);
    for(let i=0;i<n;i++){ids[i*4]=idx;ws[i*4]=1;}
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(ws,4));
    if(!groups.has(color))groups.set(color,[]);groups.get(color).push(g);
    parts.push({name,bone,pos,size});
  }
  // Leave the centre and right weapon mounting corridor clear. Close-fitting, rounded carrier.
  part('rear pouch','Chest',[-.115,1.315,.205],[.175,.235,.085],0x59604b,.016);
  part('rear flap','Chest',[-.115,1.413,.25],[.174,.059,.018],0x73785b);
  for(const x of [-.17,-.06])part('retention webbing','Chest',[x,1.313,.251],[.023,.175,.012],0x3e473b,.003);
  part('rear buckle','Chest',[-.115,1.39,.263],[.025,.025,.012],0x2b3432,.003);
  for(const side of [-1,1]) {
    part('waist pouch','Pelvis',[side*.21,1.006,.115],[.095,.126,.09],0x59604b,.013);
    part('waist flap','Pelvis',[side*.21,1.056,.164],[.094,.038,.012],0x73785b,.004);
  }
  const added=[];
  for(const [color,gs] of groups){
    const o=new T.SkinnedMesh(mergeGeometries(gs),new T.MeshStandardMaterial({color,roughness:.94}));
    o.name='Finished carrier';o.bind(source.skeleton,source.bindMatrix);o.position.copy(source.position);o.quaternion.copy(source.quaternion);o.scale.copy(source.scale);
    o.castShadow=o.receiveShadow=true;o.frustumCulled=false;source.parent.add(o);added.push(o);gs.forEach(g=>g.dispose());
  }
  return { parts, added, source, original, cloth, maxDisplacement,
    set(value){source.geometry=value?cloth:original;source.material.vertexColors=value||oldVertexColors;source.material.onBeforeCompile=value?clothCompile:originalCompile;source.material.customProgramCacheKey=()=>value?'garment-fold-v2':'garment-original';source.material.needsUpdate=true;added.forEach(o=>o.visible=value);}
  };
}

/** A single low-poly shadow-only street model avoids re-rendering 180k facade triangles. */
export function streetShadowProxy(blocks) {
  const gs=[];
  for(const b of blocks){const g=new T.BoxGeometry(b.w,b.h,b.d);g.translate(b.x,b.h/2,b.z);gs.push(g);}
  const m=new T.Mesh(mergeGeometries(gs),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));
  m.name='Architecture shadow proxy';m.castShadow=true;m.renderOrder=-10;gs.forEach(g=>g.dispose());return m;
}

export function finishStreet(group,blocks){
  let road;group.traverse(o=>{if(o.isMesh&&o.material.name==='road_asphalt')road=o.material;});
  const old=road.map,canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.drawImage(old.image,0,0,256,256);
  // Reduce the original large mottling so moving enemies have a quieter backdrop.
  ctx.fillStyle='rgba(82,83,78,.55)';ctx.fillRect(0,0,256,256);
  const map=new T.CanvasTexture(canvas);map.colorSpace=old.colorSpace;map.wrapS=old.wrapS;map.wrapT=old.wrapT;map.repeat.copy(old.repeat);map.offset.copy(old.offset);map.anisotropy=4;map.flipY=old.flipY;
  const stains=document.createElement('canvas');stains.width=stains.height=256;const c=stains.getContext('2d');
  const gradient=c.createLinearGradient(0,170,0,256);gradient.addColorStop(0,'rgba(29,31,24,0)');gradient.addColorStop(1,'rgba(29,31,24,.48)');c.fillStyle=gradient;c.fillRect(0,0,256,256);
  for(let j=0;j<9;j++){const x=11+j*29,w=3+j%3;const g=c.createLinearGradient(0,0,0,95+j%4*21);g.addColorStop(0,'rgba(38,32,22,.20)');g.addColorStop(1,'rgba(38,32,22,0)');c.fillStyle=g;c.fillRect(x,0,w,180);}
  const texture=new T.CanvasTexture(stains);texture.colorSpace=T.SRGBColorSpace;
  const gs=[];for(const b of blocks){const side=Math.sign(b.x),g=new T.PlaneGeometry(b.d,b.h);g.rotateY(-side*Math.PI/2);g.translate(b.x-side*(b.w/2+.012),b.h/2,b.z);gs.push(g);}
  const dirt=new T.Mesh(mergeGeometries(gs),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));dirt.name='Facade weathering';gs.forEach(g=>g.dispose());
  return {dirt,set(value){road.map=value?map:old;road.needsUpdate=true;dirt.visible=value;}};
}

/** Visual IK for the prototype's 20 cm sidewalk. Simulation X/Z and weapon rules are unchanged. */
export function sidewalkSupport(trooper, root, blocks){
  const footStates=['L','R'].map(s=>({hip:trooper.model.getObjectByName('UpperLeg_'+s),knee:trooper.model.getObjectByName('LowerLeg_'+s),foot:trooper.model.getObjectByName('Foot_'+s)}));
  function height(x,z){for(const b of blocks){const edge=Math.abs(b.x)-b.w/2;const inward=edge-Math.abs(x);if(Math.abs(z-b.z)<b.d/2+.6 && inward>=0 && inward<1.48)return .2*T.MathUtils.smoothstep(1.48-inward,0,.18);}return 0;}
  function turn(bone,a,b){const q=new T.Quaternion().setFromUnitVectors(a.normalize(),b.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
  return {height,update(enabled){
    if(!enabled)return;
    root.updateMatrixWorld(true);
    const support=footStates.map(v=>{const q=v.foot.getWorldPosition(new T.Vector3());return height(q.x,q.z);});
    const raise=Math.min(...support);root.position.y+=raise;root.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const lift=support[i]-raise;if(lift<.001)continue;
      const {hip,knee,foot}=footStates[i],a=hip.getWorldPosition(new T.Vector3()),b=knee.getWorldPosition(new T.Vector3()),end=foot.getWorldPosition(new T.Vector3());
      const target=end.clone();target.y+=lift;const rot=foot.getWorldQuaternion(new T.Quaternion());
      const l1=a.distanceTo(b),l2=b.distanceTo(end),axis=target.clone().sub(a),len=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.00001,l1+l2-.00001);axis.normalize();
      const pole=b.clone().sub(a).addScaledVector(axis,-b.clone().sub(a).dot(axis));if(pole.lengthSq()<1e-8)pole.set(0,0,-1);pole.normalize();
      const along=(l1*l1-l2*l2+len*len)/(2*len),joint=a.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
      turn(hip,b.clone().sub(a),joint.clone().sub(a));const k=knee.getWorldPosition(new T.Vector3());turn(knee,foot.getWorldPosition(new T.Vector3()).sub(k),target.sub(k));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rot));foot.updateWorldMatrix(false,true);
    }
  }};
}
