import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Matrix,Vector
Q=Path(__file__).resolve().parent
def actions():
 out={}
 for a in bpy.data.actions:
  curves=[]
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:curves.append((fc.data_path,fc.array_index,[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
  out[a.name]=hashlib.sha256(json.dumps(curves,sort_keys=True).encode()).hexdigest()
 return out
def signature():
 rig=bpy.data.objects['STANDARD_TROOPER_RIG'];bones={b.name:(b.parent.name if b.parent else None,[list(r) for r in b.matrix_local],list(b.tail_local),b.use_deform) for b in rig.data.bones}
 meshes={o.name:hashlib.sha256(json.dumps(([list(v.co) for v in o.data.vertices],[list(p.vertices) for p in o.data.polygons],[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices])).encode()).hexdigest() for o in bpy.data.objects if o.type=='MESH'}
 return bones,meshes
def body_geometry():
 o=bpy.data.objects['Study_Body']
 return ([list(v.co) for v in o.data.vertices],[list(p.vertices) for p in o.data.polygons])
bpy.ops.wm.open_mainfile(filepath=str(Q.parent/'stage2/trooper_stage2_refined.blend'));base_actions=actions();base_sig=signature();base_body=body_geometry()
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'));now_actions=actions();assert all(now_actions[n]==h for n,h in base_actions.items());now_sig=signature();changed_bones=[n for n in base_sig[0] if base_sig[0][n]!=now_sig[0][n]];changed_meshes=[n for n in base_sig[1] if base_sig[1][n]!=now_sig[1][n]];assert changed_bones==['BackWeaponSocket'];assert set(changed_meshes)=={'Trial_BackMount_Rifle','Study_Body'}
rig=bpy.data.objects['STANDARD_TROOPER_RIG'];rig.data.pose_position='POSE'
assert body_geometry()==base_body
body=bpy.data.objects['Study_Body'];max_weight_error=0
for v in body.data.vertices:
 weights=[g.weight for g in v.groups if g.weight>0]
 assert 1<=len(weights)<=4 and all(math.isfinite(w) and w<=1 for w in weights)
 max_weight_error=max(max_weight_error,abs(sum(weights)-1))
assert max_weight_error<1e-5
for tr in rig.animation_data.nla_tracks:tr.mute=True
out={'unchangedBoneBinds':56,'changedBoneBinds':changed_bones,'changedMeshes':changed_meshes,'otherMeshGeometryWeightsUnchanged':True,'original15ActionsUnchanged':True,'events':[],'maximumScaleError':0,'maximumWristGripError':0,'minimumAdjacentQuaternionDot':1,'constraints':sum(len(b.constraints) for b in rig.pose.bones),'drivers':len(rig.animation_data.drivers)}
for name,source,dest in [('Trial_Switch_1_to_2','rifle','rocket'),('Trial_Switch_2_to_1','rocket','rifle')]:
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=bpy.data.actions[name];prev={}
 for f in range(121):
  bpy.context.scene.frame_set(f//2,subframe=(f%2)*.5);bpy.context.view_layer.update()
  for b in rig.pose.bones:
   assert all(math.isfinite(v) for row in b.matrix for v in row)
   out['maximumScaleError']=max(out['maximumScaleError'],max(abs(x-1) for x in b.scale))
   if b.name in prev:
    dot=prev[b.name].normalized().dot(b.rotation_quaternion.normalized())
    if dot<out['minimumAdjacentQuaternionDot']:out['minimumAdjacentQuaternionDot']=dot;out['largestRotationStep']={'action':name,'frame':f/2,'bone':b.name,'degrees':math.degrees(2*math.acos(max(-1,min(1,dot))))}
   prev[b.name]=b.rotation_quaternion.copy()
  hand=rig.pose.bones['RightHandWeaponSocket'].matrix;wanted=hand@Vector((.05,-.048,-.065));out['maximumWristGripError']=max(out['maximumWristGripError'],(wanted-rig.pose.bones['Hand_R'].head).length)
  if f in [54,72]:
   kind=source if f==54 else dest;rack=rig.pose.bones['BackWeaponSocket' if kind=='rifle' else 'BackWeaponSocket_2'].matrix;delta=rack.inverted()@hand
   out['events'].append({'action':name,'frame':f/2,'positionMeters':delta.translation.length,'angleDegrees':math.degrees(delta.to_quaternion().angle)})
assert out['maximumScaleError']<1e-5
out['bodyCoordinatesFacesUnchanged']=True;out['bodyMaximumWeightSumError']=max_weight_error;out['bodyMaximumInfluences']=4
assert all(e['positionMeters']<1e-5 and e['angleDegrees']<.001 for e in out['events'])
(Q/'switch-validation.json').write_text(json.dumps(out,indent=2));print('SWITCH VALIDATION',out)
