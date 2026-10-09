"""Compare bounded torso corrections with actual weapon geometry, before baking.

This is an authoring probe, not runtime or terrain acceptance evidence.
"""
import bpy, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
p=Path(__file__).resolve().parent
repo=next((root for root in p.parents if (root/'public/assets/weapons/realism-v2').is_dir()),Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion'))
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-armed-roll-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
body=[bpy.data.objects[n] for n in ['Body','Head']]
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(0);bpy.context.view_layer.update()
runtimeBasis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
cw=runtimeBasis@rig.matrix_world@rig.pose.bones['chest'].matrix
back={}
for i,name in enumerate(['BackWeaponSocket','BackWeaponSocket_2']):
 frame=Matrix.Rotation(-.45 if i==0 else .45,4,'Z')@Matrix.Rotation(-math.pi/2,4,'Y')
 frame.translation=cw.translation+Vector((.14 if i==0 else -.14,.08,.10))
 back[name]=cw.inverted()@frame
weapons={}
for kind in ['rifle','shotgun','rocket']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(repo/f'public/assets/weapons/realism-v2/{kind}_0.glb'))
 imported=set(bpy.data.objects)-before;vertices=[]
 for obj in imported:
  if obj.type!='MESH':continue
  co=np.empty(len(obj.data.vertices)*3,dtype=np.float32);obj.data.vertices.foreach_get('co',co)
  m=np.array(obj.matrix_world);vertices.append(co.reshape(-1,3)@m[:3,:3].T+m[:3,3])
 weapons[kind]=np.concatenate(vertices)
 for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)

def floor_body():
 dg=bpy.context.evaluated_depsgraph_get();low=1e9
 for obj in body:
  evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh();co=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',co)
  m=np.array(evaluated.matrix_world[2]);low=min(low,float((co.reshape(-1,3)@m[:3]+m[3]).min()));evaluated.to_mesh_clear()
 return low

def equipment():
 frames={'RightHandWeaponSocket':rig.matrix_world@rig.pose.bones['RightHandWeaponSocket'].matrix}
 frames.update({n:rig.matrix_world@rig.pose.bones['chest'].matrix@matrix for n,matrix in back.items()})
 return {kind+'/'+socket:float((co@np.array(matrix[2])[:3]+matrix[2][3]).min()) for kind,co in weapons.items() for socket,matrix in frames.items()}


# Feasibility only: rotate the slung weapons around their fixed attachment.
# No mesh/root lift, hiding, scaling, or accepted source mutation.
action=bpy.data.actions['Soldier_Dodge_Roll'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
rows=[]
for i in range(61):
 t=i/60;f=action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*t;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
 chosen={}
 for socket,base in back.items():
  world=rig.matrix_world@rig.pose.bones['chest'].matrix@base
  options=[]
  for x in range(-90,91,15):
   for y in [-90,-45,0,45,90]:
    m=world@Matrix.Rotation(math.radians(x),4,'X')@Matrix.Rotation(math.radians(y),4,'Y')
    z=np.array(m[2]);low=min(float((co@z[:3]+z[3]).min()) for co in weapons.values())
    cost=10000*max(0,.005-low)**2+.001*(x*x+y*y)
    options.append((cost,low,x,y))
  cost,low,x,y=min(options)
  chosen[socket]={'minimum':low,'xDegrees':x,'yDegrees':y}
 rows.append({'fraction':t,'sockets':chosen})
report={'status':'feasibility only; discontinuous search, not an accepted animation','minimum':min(q['minimum'] for row in rows for q in row['sockets'].values()),'samples':rows}
(p/'sling-motion-probe.json').write_text(json.dumps(report,indent=2));print('SLING_MINIMUM',report['minimum'],flush=True)
