"""Read-only source rig/skin audit. Run in Blender after the v4 builder."""
import bpy,json,math
from pathlib import Path
R=Path(__file__).resolve().parents[3];Q=R/'dist-validation/trooper-v4'
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/blender/source/standard_trooper_v4.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bones=rig.data.bones
assert len(bones)==57
assert bones['Chest'].parent.name=='SpineMid'
assert bones['SpineMid'].parent.name=='Spine'
assert bones['Spine'].parent.name=='Pelvis'
assert abs(bones['UpperLeg_R'].head_local.x)<abs(bones['LowerLeg_R'].head_local.x)<abs(bones['Foot_R'].head_local.x)
assert abs(bones['Foot_R'].head_local.x)>.215
assert all(b.length>.005 for b in bones)
assert len(bpy.data.actions)==15
assert bpy.data.images['DESIGN_AUTHORITY_STANDARD_TROOPER'].packed_file
errors=[];influences=0;weighted=set();count=0;rigid_count=0
for o in bpy.data.objects:
 if o.type!='MESH' or not any(m.type=='ARMATURE' for m in o.modifiers):continue
 assert o.parent==rig
 for v in o.data.vertices:
  ws=[(o.vertex_groups[g.group].name,g.weight) for g in v.groups if g.weight>1e-7]
  total=sum(w for _,w in ws);count+=1;influences=max(influences,len(ws));weighted.update(n for n,_ in ws)
  if abs(total-1)>1e-5 or not ws or any(n not in bones for n,_ in ws):errors.append([o.name,v.index,total])
  if o.name in ['Helmet','ChestArmor','ShoulderArmor','ArmArmor','LegArmor','Backpack','UtilityGear']:
   assert len(ws)==1 and abs(ws[0][1]-1)<1e-5;rigid_count+=1
 assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
for name in weighted:assert bones[name].use_deform
assert not errors and influences<=4
for b in bones:
 if b.name.endswith('_L'):
  other=bones[b.name[:-2]+'_R']
  for a,c in [(b.head_local,other.head_local),(b.tail_local,other.tail_local)]:
   assert abs(a.x+c.x)<1e-6 and abs(a.y-c.y)<1e-6 and abs(a.z-c.z)<1e-6,b.name
# Flex every new finger/toe/spine joint in source and require its weighted mesh
# to move, with finite results. Confirms these are deforming bones, not labels.
probes=[]
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for b in rig.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update()
targets=['SpineMid','Toe_L','Toe_R']+[f'{f}{i}_{s}' for s in ['L','R'] for f in ['Thumb','Index','Middle','Ring','Little'] for i in range(1,4)]
for name in targets:
 o=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups.get(name) and any(g.group==o.vertex_groups[name].index and g.weight>.05 for v in o.data.vertices for g in v.groups))
 group=o.vertex_groups[name].index
 ids=[v.index for v in o.data.vertices if any(g.group==group and g.weight>.05 for g in v.groups)]
 before=[o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices[i].co.copy() for i in ids]
 p=rig.pose.bones[name];p.rotation_mode='XYZ';p.rotation_euler.x=.45;bpy.context.view_layer.update()
 mesh=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
 displacement=max((mesh.vertices[i].co-v).length for i,v in zip(ids,before))
 assert displacement>.0005,name
 probes.append({'bone':name,'maxDisplacement':displacement});p.rotation_euler.x=0;bpy.context.view_layer.update()
report={'bones':len(bones),'actions':len(bpy.data.actions),'vertices':count,'rigidArmorVertices':rigid_count,'maxInfluences':influences,'weightedBones':sorted(weighted),'weightErrors':errors,'symmetric':True,'sourceReferencePacked':True,'deformProbes':probes}
(Q/'source-rig-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
