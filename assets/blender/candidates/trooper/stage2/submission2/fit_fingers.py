"""Auditor-approved 30-finger-bone-only fit, anchored in character coordinates."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_layout.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
finger_names=[b.name for b in rig.data.bones if b.name.startswith(('Thumb','Index','Middle','Ring','Little'))]
assert len(finger_names)==30
before={b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r) for r in b.matrix_local],'parent':b.parent.name if b.parent else None} for b in rig.data.bones}
actions=[a.name for a in bpy.data.actions]
bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for side in ['L','R']:
 anchor=Vector(before['Hand_'+side]['head'])
 # Exactly the same anchor and character-object axes used to resize the gloves.
 transform=Matrix.Translation(anchor)@Matrix.Diagonal((1.24,1.22,1.32,1))@Matrix.Translation(-anchor)
 for n in [n for n in finger_names if n.endswith('_'+side)]:
  b=rig.data.edit_bones[n];b.head=transform@Vector(before[n]['head']);b.tail=transform@Vector(before[n]['tail'])
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def along_weights(u,keys):
 if u<=keys[0][0]:return {keys[0][1]:1}
 if u>=keys[-1][0]:return {keys[-1][1]:1}
 for (a,na),(b,nb) in zip(keys,keys[1:]):
  if a<=u<=b:
   t=smooth((u-a)/(b-a));return {na:1-t,nb:t}
for side,sgn in [('L',-1),('R',1)]:
 o=bpy.data.objects['Study_Glove_'+side];o.vertex_groups.clear()
 centers=[rig.data.bones[f'{f}1_{side}'].head_local.x*sgn for f in ['Index','Middle','Ring','Little']]
 for v in o.data.vertices:
  p=v.co;idx=min(range(4),key=lambda i:abs(p.x*sgn-centers[i]));finger=['Index','Middle','Ring','Little'][idx]
  if p.x*sgn<.3566 and p.z<.875:finger='Thumb'
  b1,b2,b3=[rig.data.bones[f'{finger}{k}_{side}'] for k in range(1,4)]
  axis=(b3.tail_local-b1.head_local).normalized();u=(p-b1.head_local).dot(axis)
  l1=(b2.head_local-b1.head_local).length;l2=(b3.head_local-b1.head_local).length
  keys=[(-.014,'Hand_'+side),(.018,f'{finger}1_{side}'),(l1-.006,f'{finger}1_{side}'),(l1+.007,f'{finger}2_{side}'),(l2-.006,f'{finger}2_{side}'),(l2+.007,f'{finger}3_{side}')]
  ws=along_weights(u,keys)
  for n,w in ws.items():
   if w>1e-8:(o.vertex_groups.get(n) or o.vertex_groups.new(name=n)).add([v.index],w,'REPLACE')
# Heat weighting solves continuity on the actual glove surface, then limits
# influences; the earlier analytic map is retained above as a readable fallback.
deform={b.name:b.use_deform for b in rig.data.bones}
for side in ['L','R']:
 o=bpy.data.objects['Study_Glove_'+side];o.hide_set(False);o.vertex_groups.clear()
 for m in list(o.modifiers):
  if m.type=='ARMATURE':o.modifiers.remove(m)
 for b in rig.data.bones:b.use_deform=b.name=='Hand_'+side or b.name in [n for n in finger_names if n.endswith('_'+side)]
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
 for v in o.data.vertices:
  ws=sorted([(g.group,g.weight) for g in v.groups if g.weight>1e-5],key=lambda p:-p[1])[:4];assert ws
  total=sum(w for _,w in ws)
  for g in o.vertex_groups:g.remove([v.index])
  for i,w in ws:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
for b in rig.data.bones:b.use_deform=deform[b.name]
after={b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r) for r in b.matrix_local],'parent':b.parent.name if b.parent else None} for b in rig.data.bones}
unchanged=[n for n in before if n not in finger_names]
assert all(before[n]==after[n] for n in unchanged)
assert len(rig.data.bones)==57 and actions==[a.name for a in bpy.data.actions]
report={'approvedScope':'30 finger head/tail positions only, same wrist anchor and character axes as stage1 glove resizing','changedBones':finger_names,'nonfingerBonesUnchanged':unchanged,'boneCount':57,'actionsPreserved':actions,'constraints':{b.name:[c.type for c in b.constraints] for b in rig.pose.bones if b.constraints},'driverCount':len(rig.animation_data.drivers),'before':{n:before[n] for n in finger_names},'after':{n:after[n] for n in finger_names},'rollPolicy':'Existing edit-bone roll retained; only head/tail transformed. Thumb opposition uses diagnostic pose rotation.'}
(Q/'finger-fit-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
