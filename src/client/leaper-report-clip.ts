import * as T from 'three';

/** Inspection-only IK: rigid leg lengths and planted toes, no model scaling. */
export function leaperReportClip(model:T.Group, bones:T.Bone[]) {
  model.updateMatrixWorld(true);
  const body=bones.find(b=>b.name==='body')!;
  const rest=bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const legs=bones.filter(b=>b.name.endsWith('_upper')).map(upper=>{
    const lower=bones.find(b=>b.name===upper.name.replace('_upper','_lower'))!;
    const toe=bones.find(b=>b.name===upper.name.replace('_upper','_toe'))!;
    const hip=upper.getWorldPosition(new T.Vector3()),knee=lower.getWorldPosition(new T.Vector3()),foot=toe.getWorldPosition(new T.Vector3());
    const axis=foot.clone().sub(hip).normalize();
    return {upper,lower,toe,hip,knee,foot,bend:knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis)).normalize(),l1:hip.distanceTo(knee),l2:knee.distanceTo(foot),toeQ:toe.getWorldQuaternion(new T.Quaternion())};
  });
  const smooth=(x:number)=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
  const times:number[]=[],values=bones.map(()=>({p:[] as number[],q:[] as number[]}));
  const aim=(bone:T.Bone,child:T.Bone,target:T.Vector3)=>{
    const origin=bone.getWorldPosition(new T.Vector3());
    const delta=new T.Quaternion().setFromUnitVectors(child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),target.clone().sub(origin).normalize());
    const world=delta.multiply(bone.getWorldQuaternion(new T.Quaternion()));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
    model.updateMatrixWorld(true);
  };
  for(let frame=0;frame<=120;frame++) {
    const t=frame/60;times.push(t);
    for(const r of rest){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s)}
    const compression=t<.4?smooth(t/.4):t<.55?1-smooth((t-.4)/.15):t<1.25?0:t<1.4?smooth((t-1.25)/.15):1-smooth((t-1.4)/.4);
    const tuck=smooth((t-.55)/.18)*(1-smooth((t-1.02)/.23));
    body.position.y-=.30*compression;model.updateMatrixWorld(true);
    for(const leg of legs) {
      const hip=leg.upper.getWorldPosition(new T.Vector3());
      const target=leg.foot.clone();
      target.x=T.MathUtils.lerp(target.x,hip.x,tuck*.38);
      target.z=T.MathUtils.lerp(target.z,hip.z,tuck*.38);
      target.y+=.30*tuck;
      const axis=target.clone().sub(hip),d=T.MathUtils.clamp(axis.length(),Math.abs(leg.l1-leg.l2)+1e-5,leg.l1+leg.l2-1e-5);axis.normalize();
      const bend=leg.bend.clone().addScaledVector(axis,-leg.bend.dot(axis)).normalize();
      const along=(leg.l1**2-leg.l2**2+d*d)/(2*d);
      const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,leg.l1**2-along**2)));
      aim(leg.upper,leg.lower,knee);aim(leg.lower,leg.toe,hip.clone().addScaledVector(axis,d));
      leg.toe.quaternion.copy(leg.toe.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.toeQ));
      model.updateMatrixWorld(true);
    }
    bones.forEach((b,i)=>{b.position.toArray(values[i].p,frame*3);b.quaternion.toArray(values[i].q,frame*4)});
  }
  for(const r of rest){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s)}
  model.updateMatrixWorld(true);
  return new T.AnimationClip('Locomotion',2,bones.flatMap((b,i)=>[
    new T.VectorKeyframeTrack(`${b.name}.position`,times,values[i].p),
    new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,values[i].q),
  ]));
}
