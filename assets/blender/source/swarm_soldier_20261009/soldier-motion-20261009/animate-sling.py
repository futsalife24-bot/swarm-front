"""背面の接続位置を維持し、回避中の武器の向きを連続経路で調整する制作候補。体の持ち上げ・非表示・拡縮は行わない。"""
import bpy, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
p=Path(__file__).resolve().parent
repo=next((root for root in p.parents if (root/'public/assets/weapons/realism-v2').is_dir()),Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion'))
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-grounded-down-candidate.blend'))
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


# Fixed strap anchors; only socket orientation changes. Optimize a continuous
# path across the complete roll, rather than choosing unrelated poses per frame.
angles=np.array([(x,y) for x in range(-90,91,10) for y in range(-90,91,30)],dtype=float)
rotations=[Matrix.Rotation(math.radians(x),4,'X')@Matrix.Rotation(math.radians(y),4,'Y') for x,y in angles]
zero=next(i for i,(x,y) in enumerate(angles) if x==0 and y==0)
transition=.001*np.sum((angles[:,None,:]-angles[None,:,:])**2,axis=2)
transition[np.max(np.abs(angles[:,None,:]-angles[None,:,:]),axis=2)>30]=1e9
rest={n:rig.data.bones['chest'].matrix_local@m for n,m in back.items()}
rig.animation_data.action=None;bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,m in rest.items():
 bone=rig.data.edit_bones.new(name);bone.parent=rig.data.edit_bones['chest'];bone.head=bone.parent.head;bone.tail=bone.head+Vector((0,0,.06));bone.use_deform=False;bone.matrix=m
bpy.ops.object.mode_set(mode='OBJECT')
# Identity keys in every other action make attachment reset explicit.
for action in list(bpy.data.actions):
 if not action.name.startswith('Soldier_') or action.name=='Soldier_Dodge_Roll':continue
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 for name in back:
  bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION';bone.rotation_quaternion=(1,0,0,0)
  bone.keyframe_insert(data_path='rotation_quaternion',frame=action.frame_range[0])
action=bpy.data.actions['Soldier_Dodge_Roll'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
frames=[t/4 for t in range(round(action.frame_range[0]*4),round(action.frame_range[1]*4)+1)]
worlds={n:[] for n in back}
for f in frames:
 s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
 for n,m in back.items():worlds[n].append(rig.matrix_world@rig.pose.bones['chest'].matrix@m)
report={}
for name in back:
 lows=np.empty((len(frames),len(angles)))
 for fi,world in enumerate(worlds[name]):
  for ai,rotation in enumerate(rotations):
   z=np.array((world@rotation)[2]);lows[fi,ai]=min(float((co@z[:3]+z[3]).min()) for co in weapons.values())
 costs=1e5*np.maximum(0,.012-lows)**2+.00005*np.sum(angles**2,axis=1)[None,:]
 costs[:round(len(frames)*.12),:]=1e9;costs[:round(len(frames)*.12),zero]=0
 costs[round(len(frames)*.75):,:]=1e9;costs[round(len(frames)*.75):,zero]=0
 previous=np.empty((len(frames),len(angles)),dtype=np.int32);score=costs[0].copy()
 for fi in range(1,len(frames)):
  matrix=score[:,None]+transition;previous[fi]=np.argmin(matrix,axis=0);score=costs[fi]+np.min(matrix,axis=0)
 path=[int(np.argmin(score))]
 for fi in range(len(frames)-1,0,-1):path.append(int(previous[fi,path[-1]]))
 path=path[::-1];last=None
 for f,idx in zip(frames,path):
  bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION';q=rotations[idx].to_quaternion()
  if last:q.make_compatible(last)
  last=q.copy();bone.rotation_quaternion=q;bone.keyframe_insert(data_path='rotation_quaternion',frame=f)
 report[name]={'minimum':float(min(lows[i,v] for i,v in enumerate(path))),'maximumStepDegrees':float(np.max(np.abs(np.diff(angles[path],axis=0)))),'samples':[{'frame':f,'angles':angles[idx].tolist(),'minimum':float(lows[i,idx])} for i,(f,idx) in enumerate(zip(frames,path))]}
 print(name,report[name]['minimum'],report[name]['maximumStepDegrees'],flush=True)
for layer in action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:key.interpolation='LINEAR'
rig.animation_data.action=None
for n in back:rig.pose.bones[n].rotation_quaternion=(1,0,0,0)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-sling-motion-candidate.blend'))
(p/'sling-motion-candidate.json').write_text(json.dumps(report,indent=2))
