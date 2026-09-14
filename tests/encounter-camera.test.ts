import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {encounterCamera} from '../src/client/encounter-camera';
describe('first encounter camera',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])it(`ends in front at heading ${yaw} without crossing the specimen`,()=>{
  const focus=new T.Vector3(3,2,-7),front=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const camera=new T.PerspectiveCamera(60,16/9,.1,1200);camera.position.copy(focus).addScaledVector(front,-30);camera.position.y=4;camera.lookAt(focus);
  const sample=encounterCamera(camera,focus,front,10);expect(sample(0).position.toArray()).toEqual(camera.position.toArray());expect(sample(0).quaternion.angleTo(camera.quaternion)).toBeLessThan(1e-7);
  for(let i=0;i<=100;i++){const p=sample(i/100).position;expect(Math.hypot(p.x-focus.x,p.z-focus.z)).toBeGreaterThan(9.8);}
  const end=sample(1),offset=end.position.clone().sub(focus);offset.y=0;expect(offset.normalize().dot(front)).toBeCloseTo(1,8);
  end.fov=40;end.updateProjectionMatrix();end.updateMatrixWorld();const projected=focus.clone().project(end);expect(projected.x).toBeGreaterThan(.2);expect(projected.x).toBeLessThan(.6);
 });
});
