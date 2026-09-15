import bpy,json,sys,numpy as np
from pathlib import Path
from mathutils import Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'))
rig=bpy.data.objects['STANDARD_TROOPER_RIG'];o=bpy.data.objects['Study_Body']
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
rig.animation_data.action=bpy.data.actions['Trial_Switch_1_to_2'];bpy.context.scene.frame_set(int(sys.argv[sys.argv.index('--frame')+1]) if '--frame' in sys.argv else 23);bpy.context.view_layer.update()
print('MODIFIERS',[(m.name,m.type,getattr(m,'use_deform_preserve_volume',None)) for m in o.modifiers])
print('ARMHEADS',{b.name:list(b.head) for b in rig.pose.bones if b.name in ['UpperArm_R','LowerArm_R','Hand_R']})
print('SOCKETS',{n:[list(row) for row in rig.pose.bones[n].matrix] for n in ['BackWeaponSocket','BackWeaponSocket_2','RightHandWeaponSocket']})
ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();ids={g.index:g.name for g in o.vertex_groups};errors=[]
for v in o.data.vertices:
 p=np.array([*v.co,1.]);out=np.zeros(4)
 for g in v.groups:
  if g.weight>0:
   n=ids[g.group];m=rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted();out+=np.array(m)@p*g.weight
 errors.append(np.linalg.norm(out[:3]-np.array(me.vertices[v.index].co)))
print('LBS_ERROR',max(errors),'ARM_MOD',[(m.type,getattr(m,'use_deform_preserve_volume',None)) for m in o.modifiers])
sys.path.insert(0,str(Q));from skin_clearance_solver import weapon_sdf
for obj in bpy.data.objects:
 if obj.type!='MESH' or obj.hide_render or obj.name.startswith(('Weapon_','Diagnostic','Study_Glove')):continue
 if not any(m.type=='ARMATURE' for m in obj.modifiers):continue
 ids={g.index:g.name for g in obj.vertex_groups};ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();points=np.array([list(ev.matrix_world@v.co)+[1] for v in me.vertices])
 for kind,bn in [('rifle','RightHandWeaponSocket'),('rocket','BackWeaponSocket_2')]:
  inv=np.array((rig.matrix_world@rig.pose.bones[bn].matrix).inverted());sd=weapon_sdf((points@inv.T)[:,:3],kind)
  for i in np.argsort(sd)[:1]:
   if sd[i]<-.02:print('DEEPEST',obj.name,kind,float(sd[i]),int(i),'REST',list(obj.data.vertices[i].co),'NOW',list(points[i]),'WEIGHTS',[(ids[g.group],g.weight) for g in obj.data.vertices[i].groups])
 ev.to_mesh_clear()
