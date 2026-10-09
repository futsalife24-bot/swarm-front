"""装備の接地に合わせた胴体・足の補正候補。採用工程は --down-only。回避への全身持ち上げは視覚不合格。"""
import bpy, math, json, sys, numpy as np
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


# Preserve the soles that were already grounded while supporting the torso on
# its equipment. This is an isolated candidate, not an accepted runtime asset.
def solve_leg(side, goal):
 upper=rig.pose.bones['upper_leg.'+side];lower=rig.pose.bones['lower_leg.'+side];foot=rig.pose.bones['foot.'+side]
 a=upper.head.copy();b=lower.head.copy();c=foot.head.copy();dest=goal.translation
 l1=(b-a).length;l2=(c-b).length;axis=(dest-a).normalized()
 distance=min(max((dest-a).length,.001),l1+l2-.0001)
 pole=b-a-axis*(b-a).dot(axis)
 if pole.length<.0001: return (c-dest).length
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=a+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
 q=(b-a).rotation_difference(elbow-a)
 upper.matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-a)@upper.matrix
 bpy.context.view_layer.update()
 pivot=lower.head.copy();q=(foot.head-pivot).rotation_difference(dest-pivot)
 lower.matrix=Matrix.Translation(pivot)@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@lower.matrix
 bpy.context.view_layer.update()
 foot.matrix=Matrix.LocRotScale(foot.head,goal.to_quaternion(),Vector((1,1,1)))
 bpy.context.view_layer.update()
 return (foot.head-dest).length

# Use skinned boot vertices rather than bone axes: a fallen sole points forward.
body_obj=bpy.data.objects['Body']
foot_indices={}
for side in ['L','R']:
 groups={body_obj.vertex_groups[n].index for n in ['foot.'+side,'toes.'+side] if n in body_obj.vertex_groups}
 foot_indices[side]=np.array([v.index for v in body_obj.data.vertices if sum(g.weight for g in v.groups if g.group in groups)>.5],dtype=np.int32)
def foot_lows():
 obj=body_obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
 co=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',co)
 m=np.array(obj.matrix_world[2]);height=co.reshape(-1,3)@m[:3]+m[3]
 result={side:float(height[indices].min()) for side,indices in foot_indices.items()};obj.to_mesh_clear();return result
out={}
for name in (['Down'] if '--down-only' in sys.argv else ['Dodge_Roll','Down']):
 action=bpy.data.actions['Soldier_'+name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 samples=[];changes=[];errors=[];names=['hips']+[joint+'.'+side for side in ['L','R'] for joint in ['upper_leg','lower_leg','foot']]
 for tick in range(round(action.frame_range[0]*4),round(action.frame_range[1]*4)+1):
  f=tick/4;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  feet={side:rig.pose.bones['foot.'+side].matrix.copy() for side in ['L','R']}
  lows=foot_lows()
  pins={side:max(0,min(1,(.035-height)/.025)) for side,height in lows.items()}
  # The unarmed source ends with the heels slightly airborne. Settle them
  # during the second half of the fall instead of lifting those heels too.
  settle=0
  if name=='Down':
   t=(f-action.frame_range[0])/(action.frame_range[1]-action.frame_range[0])
   settle=max(0,min(1,(t-.5)/.3));settle=settle*settle*(3-2*settle)
   for side in feet:
    feet[side].translation-=rig.matrix_world.to_quaternion().inverted()@Vector((0,0,max(0,lows[side]-.005)*settle))
    pins[side]=max(pins[side],settle)
  low=min(equipment().values());lift=max(0,.005-low)
  if lift or settle:
   hip=rig.pose.bones['hips'];basis=(rig.matrix_world@hip.parent.matrix).to_quaternion()@(hip.parent.bone.matrix_local.inverted()@hip.bone.matrix_local).to_quaternion()
   hip.location+=basis.inverted()@Vector((0,0,lift));bpy.context.view_layer.update()
   for side,w in pins.items():
    if w:
     wanted=feet[side].copy();wanted.translation=rig.pose.bones['foot.'+side].matrix.translation.lerp(wanted.translation,w)
     errors.append(solve_leg(side,wanted))
  samples.append((f,{n:rig.pose.bones[n].matrix_basis.copy() for n in names}))
  changes.append({'frame':f,'lift':lift,'pins':pins,'bodyMin':floor_body(),'equipmentMin':min(equipment().values())})
 previous={}
 for f,pose in samples:
  for n,m in pose.items():
   b=rig.pose.bones[n];loc,q,scale=m.decompose()
   if n in previous:q.make_compatible(previous[n])
   previous[n]=q.copy();b.location=loc;b.rotation_quaternion=q;b.scale=scale
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=f)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 out[name]={'maximumLift':max(x['lift'] for x in changes),'footTargetResidual':max(errors,default=0),'minimumBody':min(x['bodyMin'] for x in changes),'minimumEquipment':min(x['equipmentMin'] for x in changes),'samples':changes}
 print(name,{k:v for k,v in out[name].items() if k!='samples'},flush=True)
rig.animation_data.action=None
stem='soldier-grounded-down-candidate' if '--down-only' in sys.argv else 'soldier-equipped-contact-candidate'
bpy.ops.wm.save_as_mainfile(filepath=str(p/(stem+'.blend')))
(p/('grounded-down-check.json' if '--down-only' in sys.argv else 'equipped-contact-candidate.json')).write_text(json.dumps(out,indent=2))
