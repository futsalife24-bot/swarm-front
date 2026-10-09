"""Adapt the CC0 unarmed roll to a two-handed, chest-tucked weapon hold.

Writes a separate candidate: the established polished source is preserved.
The feet/spine/roll timing are retained; only arms, grips and fingers change.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
idle=bpy.data.actions['Soldier_Rifle_Idle']
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0]
s.frame_set(0);bpy.context.view_layer.update()
runtimeBasis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
chest=rig.pose.bones['chest'].matrix.copy()
socket=rig.pose.bones['RightHandWeaponSocket'].matrix.copy()
hands={side:socket.inverted()@rig.pose.bones['hand.'+side].matrix for side in ['R','L']}
idleSocket=chest.inverted()@socket
worldChest=runtimeBasis@rig.matrix_world@chest
# Across the chest, muzzle to the soldier's left; the magazine faces down.
target=Matrix(((0,-1,0,0),(0,0,1,0),(-1,0,0,0),(0,0,0,1)))
target.translation=worldChest.translation+Vector((.16,.22,-.24))
tuckedSocket=(runtimeBasis@rig.matrix_world@chest).inverted()@target
fingerNames=[b.name for b in rig.pose.bones if any(k in b.name for k in ['thumb_','index_','middle_','ring_','little_'])]
fingerPose={n:rig.pose.bones[n].rotation_quaternion.copy() for n in fingerNames}
socketBasis=rig.pose.bones['RightHandWeaponSocket'].matrix_basis.copy()
idleArm={n:rig.pose.bones[n].rotation_quaternion.copy() for n in ['shoulder.L','shoulder.R','upper_arm.L','upper_arm.R','lower_arm.L','lower_arm.R','hand.L','hand.R']}

def solve(side,goal):
 upper=rig.pose.bones['upper_arm.'+side];lower=rig.pose.bones['lower_arm.'+side];hand=rig.pose.bones['hand.'+side]
 a=upper.head.copy();b=lower.head.copy();c=hand.head.copy();dest=goal.translation
 l1=(b-a).length;l2=(c-b).length;axis=(dest-a).normalized()
 distance=min(max((dest-a).length,.001),l1+l2-.0001)
 pole=b-a-axis*(b-a).dot(axis)
 if pole.length<.0001:pole=Vector((0,0,-1))-axis*axis.z*-1
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=a+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
 q=(b-a).rotation_difference(elbow-a)
 upper.matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-a)@upper.matrix
 bpy.context.view_layer.update()
 pivot=lower.head.copy();q=(hand.head-pivot).rotation_difference(dest-pivot)
 lower.matrix=Matrix.Translation(pivot)@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@lower.matrix
 bpy.context.view_layer.update()
 hand.matrix=Matrix.LocRotScale(hand.head,goal.to_quaternion(),Vector((1,1,1)))
 bpy.context.view_layer.update()
 return (hand.head-dest).length

action=bpy.data.actions['Soldier_Dodge_Roll']
rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
start,end=action.frame_range;samples=[];errors=[]
names=list(idleArm)+fingerNames+['RightHandWeaponSocket']
for tick in range(round(start*4),round(end*4)+1):
 f=tick/4;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
 # Capture no previous edited key: collect every sample before writing keys.
 for n,q in idleArm.items():rig.pose.bones[n].rotation_quaternion=q
 for n,q in fingerPose.items():rig.pose.bones[n].rotation_quaternion=q
 rig.pose.bones['RightHandWeaponSocket'].matrix_basis=socketBasis
 bpy.context.view_layer.update()
 t=(f-start)/(end-start);w=min(1,max(0,t/.14),max(0,(1-t)/.20));w=w*w*(3-2*w)
 local=Matrix.LocRotScale(idleSocket.translation.lerp(tuckedSocket.translation,w),idleSocket.to_quaternion().slerp(tuckedSocket.to_quaternion(),w),Vector((1,1,1)))
 wanted=rig.pose.bones['chest'].matrix@local
 errors.append(max(solve(side,wanted@hands[side]) for side in ['R','L']))
 samples.append((f,{n:rig.pose.bones[n].matrix_basis.copy() for n in names}))
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
rig.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-armed-roll-candidate.blend'))
(p/'armed-roll-check.json').write_text(json.dumps({'status':'candidate; ground and rendered validation pending','samples':len(samples),'maxHandTargetErrorMetres':max(errors),'changedBones':names},indent=2))
print('ARMED_ROLL',len(samples),'max hand residual',max(errors),flush=True)
