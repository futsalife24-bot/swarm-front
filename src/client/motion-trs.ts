import * as T from "three";

/** Keep large rotations rigid during interpolation (matrix lerp can collapse at 180°). */
export function trsPalette(matrices: Float32Array) {
  const data = new Float32Array(matrices.length);
  const matrix = new T.Matrix4(),
    position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  for (let at = 0; at < matrices.length; at += 16) {
    matrix.fromArray(matrices, at).decompose(position, rotation, scale);
    rotation.normalize().toArray(data, at);
    position.toArray(data, at + 4);
    scale.toArray(data, at + 8);
  }
  return data;
}

export const TRS_PALETTE_GLSL = `
uniform float houndParents[16];
uniform mat4 houndInverseBind[16];
uniform mat4 houndSkinPrefix;
struct MotionTRS { vec4 q; vec3 t; vec3 s; };
MotionTRS motionRead(float bone,float row) {
  vec2 uv=vec2(bone*4.0+.5,row+.5)/houndPaletteSize;
  vec2 dx=vec2(1.0/houndPaletteSize.x,0.0);
  return MotionTRS(texture2D(houndPalette,uv),texture2D(houndPalette,uv+dx).xyz,texture2D(houndPalette,uv+dx*2.0).xyz);
}
vec4 motionSlerp(vec4 a,vec4 b,float t) {
  float d=dot(a,b);
  if(d<0.0) { b=-b; d=-d; }
  if(d>.9995) return normalize(mix(a,b,t));
  float angle=acos(clamp(d,-1.0,1.0));
  return normalize((sin((1.0-t)*angle)*a+sin(t*angle)*b)/sin(angle));
}
MotionTRS motionMix(MotionTRS a,MotionTRS b,float t) {
  return MotionTRS(motionSlerp(a.q,b.q,t),mix(a.t,b.t,t),mix(a.s,b.s,t));
}
MotionTRS motionPose(float bone,vec3 p) {
  return motionMix(motionRead(bone,p.x),motionRead(bone,p.y),p.z);
}
mat4 motionMatrix(MotionTRS p) {
  vec4 q=normalize(p.q);
  float x=q.x,y=q.y,z=q.z,w=q.w;
  return mat4(
    vec4(vec3(1.0-2.0*(y*y+z*z),2.0*(x*y+z*w),2.0*(x*z-y*w))*p.s.x,0.0),
    vec4(vec3(2.0*(x*y-z*w),1.0-2.0*(x*x+z*z),2.0*(y*z+x*w))*p.s.y,0.0),
    vec4(vec3(2.0*(x*z+y*w),2.0*(y*z-x*w),1.0-2.0*(x*x+y*y))*p.s.z,0.0),
    vec4(p.t,1.0));
}
mat4 motionLocal(float bone) {
  if(houndBlend>.9999) return motionMatrix(motionPose(bone,houndPoseB));
  if(houndBlend<.0001) return motionMatrix(motionPose(bone,houndPoseA));
  return motionMatrix(motionMix(motionPose(bone,houndPoseA),motionPose(bone,houndPoseB),houndBlend));
}
mat4 houndMatrix(float bone) {
  mat4 world=motionLocal(bone);
  float parent=houndParents[int(bone)];
  for(int i=0;i<16;i++) {
    if(parent<0.0) break;
    world=motionLocal(parent)*world;
    parent=houndParents[int(parent)];
  }
  return houndSkinPrefix*world*houndInverseBind[int(bone)];
}
`;
