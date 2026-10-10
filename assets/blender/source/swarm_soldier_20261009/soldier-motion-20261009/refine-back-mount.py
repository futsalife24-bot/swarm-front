"""背面の接続位置を維持し、回避中の武器の向きを連続経路で調整する制作候補。体の持ち上げ・非表示・拡縮は行わない。"""
import bpy, math, json, hashlib, sys, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
p=Path(__file__).resolve().parent
close='--layout=close' in sys.argv
outputStem='soldier-back-mount-close-candidate' if close else 'soldier-back-mount-candidate'
reportStem='back-mount-close-candidate' if close else 'back-mount-candidate'
repo=next((root for root in p.parents if (root/'public/assets/weapons/realism-v2').is_dir()),Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion'))
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-switch-support-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
body=[bpy.data.objects[n] for n in ['Body','Head']]
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(0);bpy.context.view_layer.update()
runtimeBasis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
runtime=json.loads((p/'switch-runtime-geometry.json').read_text())
search=json.loads((p/'back-mount-floor-search.json').read_text())
def from_values(v):return Matrix([v[i:i+4] for i in range(0,16,4)]).transposed()
idleChest=from_values(runtime['poses'][0]['sockets']['Chest'])
chosen={name:next(r for r in search['results'] if r['socket']==name) for name in ['BackWeaponSocket','BackWeaponSocket_2']}
if close:
 allRows=json.loads((p/'back-mount-search.json').read_text())['candidates']
 specs={'BackWeaponSocket':([0,0,.16],0,180),'BackWeaponSocket_2':([-.06,0,.12],0,0)}
 chosen={}
 for name,(shift,lean,flip) in specs.items():
  chosen[name]=next(r for r in allRows if r['socket']==name and max(abs(a-b) for a,b in zip(r['idleWorldShift'],shift))<1e-6 and r['leanDegrees']==lean and r['flipDegrees']==flip)
back={name:idleChest.inverted()@from_values(row['idleWorldMatrix']) for name,row in chosen.items()}
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


# Candidate only: fixed rest anchors plus smooth strap rotation. Geometry/skin
# and all character body keys remain unchanged; handoff must be reauthored.
rig.animation_data.action=None
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,m in back.items():rig.data.edit_bones[name].matrix=rig.data.edit_bones['chest'].matrix@m
bpy.ops.object.mode_set(mode='OBJECT')
angles=np.array([(x,y,z) for x in range(-90,91,15) for y in range(-90,91,30) for z in range(-90,91,30)],dtype=float)
# Sling pivots above the grip, keeping a fixed attachment on the upper back.
pivot=Vector((0,.28,0))
rotations=[Matrix.Translation(pivot)@Matrix.Rotation(math.radians(x),4,'X')@Matrix.Rotation(math.radians(y),4,'Y')@Matrix.Rotation(math.radians(z),4,'Z')@Matrix.Translation(-pivot) for x,y,z in angles]
zero=next(i for i,(x,y,z) in enumerate(angles) if x==0 and y==0 and z==0)
transition=.001*np.sum((angles[:,None,:]-angles[None,:,:])**2,axis=2)
transition[np.max(np.abs(angles[:,None,:]-angles[None,:,:]),axis=2)>30]=1e9
for a in bpy.data.actions:
 if not a.name.startswith('Soldier_') or a.name in ['Soldier_Dodge_Roll','Soldier_Down']:continue
 rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for n in back:
  rig.pose.bones[n].location=(0,0,0);rig.pose.bones[n].keyframe_insert(data_path='location',frame=a.frame_range[0])
report={'status':'candidate, not adopted; body overlap and handoff not yet checked','mounts':chosen,'actions':{}}
for actionName in ['Soldier_Dodge_Roll','Soldier_Down']:
 action=bpy.data.actions.get(actionName)
 if action is None:raise RuntimeError('Missing '+actionName)
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 frames=[t/4 for t in range(round(action.frame_range[0]*4),round(action.frame_range[1]*4)+1)]
 worlds={n:[] for n in back}
 for f in frames:
  s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  for n,m in back.items():worlds[n].append(rig.matrix_world@rig.pose.bones['chest'].matrix@m)
 actionReport={}
 for name in back:
  pivot=Vector((0,.28 if close or name=='BackWeaponSocket' else 0,0))
  rotations=[Matrix.Translation(pivot)@Matrix.Rotation(math.radians(x),4,'X')@Matrix.Rotation(math.radians(y),4,'Y')@Matrix.Rotation(math.radians(z),4,'Z')@Matrix.Translation(-pivot) for x,y,z in angles]
  lows=np.empty((len(frames),len(angles)))
  for fi,world in enumerate(worlds[name]):
   for ai,rotation in enumerate(rotations):
    z=np.array((world@rotation)[2]);lows[fi,ai]=min(float((co@z[:3]+z[3]).min()) for co in weapons.values())
  costs=1e6*np.maximum(0,.015-lows)**2+.00005*np.sum(angles**2,axis=1)[None,:]
  costs[0,:]=1e9;costs[0,zero]=0
  if actionName=='Soldier_Dodge_Roll':costs[-1,:]=1e9;costs[-1,zero]=0
  previous=np.empty((len(frames),len(angles)),dtype=np.int32);score=costs[0].copy()
  for fi in range(1,len(frames)):
   scores=score[:,None]+transition;previous[fi]=np.argmin(scores,axis=0);score=costs[fi]+np.min(scores,axis=0)
  path=[int(np.argmin(score))]
  for fi in range(len(frames)-1,0,-1):path.append(int(previous[fi,path[-1]]))
  path=path[::-1];last=None
  for f,idx in zip(frames,path):
   bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION';q=rotations[idx].to_quaternion()
   if last:q.make_compatible(last)
   last=q.copy();bone.rotation_quaternion=q;bone.location=rotations[idx].translation;bone.keyframe_insert(data_path='rotation_quaternion',frame=f);bone.keyframe_insert(data_path='location',frame=f)
  actionReport[name]={'minimum':float(min(lows[i,v] for i,v in enumerate(path))),'maximumStepDegrees':float(np.max(np.abs(np.diff(angles[path],axis=0))))}
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     if any(name in curve.data_path for name in back):
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 report['actions'][actionName]=actionReport
 print(actionName,json.dumps(actionReport),flush=True)
rig.animation_data.action=None
for n in back:
 rig.pose.bones[n].rotation_quaternion=(1,0,0,0);rig.pose.bones[n].location=(0,0,0)
bpy.ops.wm.save_as_mainfile(filepath=str(p/(outputStem+'.blend')))
report['authoringBlendSha256']=hashlib.sha256((p/(outputStem+'.blend')).read_bytes()).hexdigest()
report['sourceRuntimeSha256']=runtime['sha256']
report['limits']=['未採用。持ち替え到達は旧位置。','床・体干渉・自然さの書き出し後検査が必要。']
(p/(reportStem+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
