import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { leaperReportClip } from './leaper-report-clip';

export type HoundClip = 'Idle' | 'Locomotion' | 'Lunge';
type ClipRange = { start: number; steps: number; duration: number };
export type HoundMotionAsset = {
  model: T.Group; clips: T.AnimationClip[]; atlas: T.DataTexture;
  ranges: Record<HoundClip, ClipRange>; meshes: T.SkinnedMesh[]; bones: number;
};
const cached=new Map<string,Promise<HoundMotionAsset>>();

/** Standard GLB is portable. Only the game adapter bakes its 20-bone clips into a GPU palette. */
export function loadHoundMotion(): Promise<HoundMotionAsset> {
  return loadEnemyMotion('hound');
}
export function loadEnemyMotion(name:'hound'|'leaper'|'pleat'|'prism'|'ray'|'foundry_zero', report = false): Promise<HoundMotionAsset> {
  const key=name+(report?'_report':'');
  if(cached.has(key))return cached.get(key)!;
  const request = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/enemies/${name}_motion_${name==='pleat'?'v5':'v1'}.glb`).then(({scene:model,animations:clips}) => {
    model.updateMatrixWorld(true);
    const meshes: T.SkinnedMesh[] = [];
    model.traverse(o => { if (o instanceof T.SkinnedMesh) meshes.push(o); });
    const attack=clips.find(c=>c.name==='Attack');if(attack)attack.name='Lunge';
    if (meshes.length !== (name==='foundry_zero'?5:4) || !(['Idle','Locomotion','Lunge'] as const).every(n => clips.some(c => c.name === n))) throw new Error('Invalid enemy motion asset');
    const skeleton = meshes[0].skeleton, bones = skeleton.bones.length;
    if(name==='leaper' && report) clips.splice(clips.findIndex(c=>c.name==='Locomotion'),1,leaperReportClip(model,skeleton.bones));
    if (bones !== ({hound:20,leaper:20,pleat:20,prism:9,ray:15,foundry_zero:21})[name] || meshes.some(m => !m.bindMatrix.equals(meshes[0].bindMatrix) || !m.matrixWorld.equals(meshes[0].matrixWorld))) throw new Error('Unexpected enemy skin binding');
    const ranges = {} as Record<HoundClip, ClipRange>;
    let rows=0;
    for (const name of ['Idle','Locomotion','Lunge'] as const) {
      const duration=clips.find(c=>c.name===name)!.duration, steps=Math.round(duration*60);
      ranges[name]={start:rows,steps,duration};rows+=steps+1;
    }
    const data=new Float32Array(rows*bones*16), mixer=new T.AnimationMixer(model);
    const offset=new T.Matrix4(), final=new T.Matrix4();
    for (const name of ['Idle','Locomotion','Lunge'] as const) {
      mixer.stopAllAction(); const action=mixer.clipAction(clips.find(c=>c.name===name)!);
      action.reset().setLoop(T.LoopOnce,1); action.clampWhenFinished=true;action.play();
      const range=ranges[name];
      for(let f=0;f<=range.steps;f++) {
        mixer.setTime(f/60);model.updateMatrixWorld(true);skeleton.update();
        for(let b=0;b<bones;b++) {
          offset.fromArray(skeleton.boneMatrices!,b*16);
          final.copy(meshes[0].matrixWorld).multiply(meshes[0].bindMatrixInverse).multiply(offset).multiply(meshes[0].bindMatrix);
          final.toArray(data,((range.start+f)*bones+b)*16);
        }
      }
    }
    mixer.stopAllAction();mixer.uncacheRoot(model);
    const atlas=new T.DataTexture(data,bones*4,rows,T.RGBAFormat,T.FloatType);
    atlas.minFilter=atlas.magFilter=T.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
    return {model,clips,atlas,ranges,meshes,bones};
  }).catch(error => {cached.delete(key);throw error;});
  cached.set(key,request);return request;
}

/** Four instanced draws at 1–80 enemies, independent clip/phase and transition for every instance. */
export class HoundMotionBatch {
  readonly group=new T.Group();
  readonly parts:T.InstancedMesh[]=[];
  readonly poseA:T.InstancedBufferAttribute;
  readonly poseB:T.InstancedBufferAttribute;
  readonly blend:T.InstancedBufferAttribute;
  constructor(readonly asset:HoundMotionAsset, readonly capacity:number) {
    this.group.name='HOUND_MOTION_DEBUG';
    this.poseA=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
    this.poseB=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
    this.blend=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);
    for(const source of asset.meshes) {
      const geometry=source.geometry.clone();
      geometry.setAttribute('houndPoseA',this.poseA);geometry.setAttribute('houndPoseB',this.poseB);geometry.setAttribute('houndBlend',this.blend);
      const material=(source.material as T.MeshStandardMaterial).clone();
      material.onBeforeCompile=shader=> {
        shader.uniforms.houndPalette={value:asset.atlas};
        shader.uniforms.houndPaletteSize={value:new T.Vector2(asset.bones*4,asset.atlas.image.height)};
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec3 houndPoseA;
attribute vec3 houndPoseB;
attribute float houndBlend;
uniform sampler2D houndPalette;
uniform vec2 houndPaletteSize;
mat4 houndBone(float bone,float row) {
  vec2 uv=vec2(bone*4.0+.5,row+.5)/houndPaletteSize;
  vec2 dx=vec2(1.0/houndPaletteSize.x,0.0);
  return mat4(texture2D(houndPalette,uv),texture2D(houndPalette,uv+dx),texture2D(houndPalette,uv+dx*2.0),texture2D(houndPalette,uv+dx*3.0));
}
mat4 houndPose(float bone,vec3 p) { return houndBone(bone,p.x)*(1.0-p.z)+houndBone(bone,p.y)*p.z; }
mat4 houndMatrix(float bone) {
  if(houndBlend>.9999) return houndPose(bone,houndPoseB);
  if(houndBlend<.0001) return houndPose(bone,houndPoseA);
  return houndPose(bone,houndPoseA)*(1.0-houndBlend)+houndPose(bone,houndPoseB)*houndBlend;
}
`);
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
mat4 houndSkin = houndMatrix(skinIndex.x)*skinWeight.x;
if(skinWeight.y>0.0) houndSkin+=houndMatrix(skinIndex.y)*skinWeight.y;
if(skinWeight.z>0.0) houndSkin+=houndMatrix(skinIndex.z)*skinWeight.z;
if(skinWeight.w>0.0) houndSkin+=houndMatrix(skinIndex.w)*skinWeight.w;
objectNormal=mat3(houndSkin)*objectNormal;
`);
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=(houndSkin*vec4(position,1.0)).xyz;');
      };
      material.customProgramCacheKey=()=> 'hound-motion-palette-v1';
      const part=new T.InstancedMesh(geometry,material,capacity);
      part.name=source.name;part.count=0;
      part.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // Conservative animated envelope, not the neutral geometry bounds.
      const bounds=new T.Box3().setFromObject(asset.model).getBoundingSphere(new T.Sphere());
      bounds.radius=bounds.radius*2+2;part.geometry.boundingSphere=bounds;
      this.parts.push(part);this.group.add(part);
    }
  }
  private sample(attribute:T.InstancedBufferAttribute,slot:number,clip:HoundClip,time:number) {
    const r=this.asset.ranges[clip];
    const t=clip==='Lunge'?T.MathUtils.clamp(time,0,r.duration):((time%r.duration)+r.duration)%r.duration;
    const frame=Math.min(r.steps,t*60),a=Math.floor(frame),b=Math.min(r.steps,a+1);
    attribute.setXYZ(slot,r.start+a,r.start+b,frame-a);
  }
  setPose(slot:number,clip:HoundClip,time:number,from: HoundClip=clip,fromTime=time,mix=1) {
    if(slot<0||slot>=this.capacity)throw new RangeError('HOUND instance capacity');
    this.sample(this.poseA,slot,from,fromTime);this.sample(this.poseB,slot,clip,time);this.blend.setX(slot,T.MathUtils.clamp(mix,0,1));
  }
  setTransform(slot:number,matrix:T.Matrix4,color?:T.Color) {
    for(const p of this.parts){p.setMatrixAt(slot,matrix);if(color)p.setColorAt(slot,color);}
  }
  finish(count:number) {
    if(count>this.capacity)throw new RangeError('HOUND instance capacity');
    this.group.visible=count>0;this.poseA.needsUpdate=this.poseB.needsUpdate=this.blend.needsUpdate=true;
    for(const p of this.parts){p.count=count;p.instanceMatrix.needsUpdate=true;if(p.instanceColor)p.instanceColor.needsUpdate=true;p.computeBoundingSphere();}
  }
  dispose() {for(const p of this.parts){p.geometry.dispose();(p.material as T.Material).dispose();p.dispose();}this.group.removeFromParent();}
}

export type HoundVisualInput={id:number;moving:boolean;wind:number;cool:number;distance:number};
type MotionState={clip:HoundClip;time:number;from:HoundClip;fromTime:number;blendTime:number;wind:number;cool:number};
/** Visual-only state machine. Inputs are scalar snapshots; never receives a mutable World. */
export class HoundMotionController {
  readonly states=new Map<number,MotionState>();
  update(batch:HoundMotionBatch,inputs:readonly HoundVisualInput[],dt:number) {
    const alive=new Set<number>();dt=T.MathUtils.clamp(dt,0,.1);
    inputs.forEach((e,i)=>{
      alive.add(e.id);
      let s=this.states.get(e.id);
      if(!s){s={clip:'Idle',time:(e.id%29)/7,from:'Idle',fromTime:0,blendTime:.12,wind:0,cool:e.cool};this.states.set(e.id,s);}
      const fired=(s.wind>0&&e.wind<=0&&e.cool>=1.1)||(e.cool>s.cool+.4&&e.cool>=1.1);
      const desired:HoundClip=e.wind>0||fired||(s.clip==='Lunge'&&s.time>=.45&&s.time<1.2)?'Lunge':e.moving?'Locomotion':'Idle';
      if(desired!==s.clip){s.from=s.clip;s.fromTime=s.time;s.clip=desired;s.time=0;s.blendTime=0;}
      if(e.wind>0)s.time=T.MathUtils.clamp(.45-e.wind,0,.45);
      else if(fired)s.time=.45;
      else if(s.clip==='Locomotion')s.time+=e.distance/.72*.8;
      else s.time+=dt;
      s.blendTime+=dt;s.fromTime+=dt;s.wind=e.wind;s.cool=e.cool;
      batch.setPose(i,s.clip,s.time,s.from,s.fromTime,s.blendTime/.12);
    });
    for(const id of this.states.keys())if(!alive.has(id))this.states.delete(id);
  }
}
