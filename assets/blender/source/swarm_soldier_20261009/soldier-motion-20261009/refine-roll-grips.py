"""Add weapon-profile roll grips while retaining the established weapon path.

Only two new action copies are edited. Existing 32 actions and rest geometry
remain intact. Hand/finger targets come from each weapon's authored idle grip.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

p=Path(__file__).resolve().parent
source=p/'soldier-switch-support-candidate.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE')
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
base=bpy.data.actions['Soldier_Dodge_Roll']
fingerNames=[b.name for b in rig.pose.bones if any(f in b.name for f in ['thumb_','index_','middle_','ring_','little_'])]
names=['upper_arm.R','lower_arm.R','hand.R','upper_arm.L','lower_arm.L','hand.L','RightHandWeaponSocket']+fingerNames

def evaluate(action,frame):
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 s.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()

def solve(side,goal):
 upper=rig.pose.bones['upper_arm.'+side];lower=rig.pose.bones['lower_arm.'+side];hand=rig.pose.bones['hand.'+side]
 a=upper.head.copy();b=lower.head.copy();c=hand.head.copy();dest=goal.translation
 l1=(b-a).length;l2=(c-b).length;axis=(dest-a).normalized()
 distance=min(max((dest-a).length,abs(l1-l2)+1e-5),l1+l2-1e-5)
 pole=b-a-axis*(b-a).dot(axis)
 if pole.length<1e-5:raise RuntimeError('Degenerate elbow pole')
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

reports=[]
for profile in ['Shotgun','Rocket']:
 idle=bpy.data.actions['Soldier_'+profile+'_Idle'];evaluate(idle,idle.frame_range[0])
 socket=rig.pose.bones['RightHandWeaponSocket']
 hands={side:socket.matrix.inverted()@rig.pose.bones['hand.'+side].matrix for side in ['R','L']}
 fingers={n:rig.pose.bones[n].matrix_basis.copy() for n in fingerNames}
 action=base.copy();action.name='Soldier_Dodge_Roll_'+profile;action.use_fake_user=True
 start,end=base.frame_range;samples=[];errors={side:[] for side in ['R','L']}
 for tick in range(round(start*4),round(end*4)+1):
  frame=tick/4;evaluate(base,frame)
  wanted=socket.matrix.copy()
  for n,matrix in fingers.items():rig.pose.bones[n].matrix_basis=matrix
  bpy.context.view_layer.update()
  for side in ['R','L']:errors[side].append(solve(side,wanted@hands[side]))
  # Recompute the child socket offset after changing the firing hand, so the
  # already-grounded weapon trajectory is unchanged by the new grasp.
  socket.matrix=wanted;bpy.context.view_layer.update()
  samples.append((frame,{n:rig.pose.bones[n].matrix_basis.copy() for n in names}))
 evaluate(action,start);previous={}
 for frame,pose in samples:
  for name,matrix in pose.items():
   bone=rig.pose.bones[name];loc,q,scale=matrix.decompose()
   if name in previous:q.make_compatible(previous[name])
   previous[name]=q.copy();bone.location=loc;bone.rotation_quaternion=q;bone.scale=scale
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=prop,frame=frame)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     if any('"'+name+'"' in curve.data_path for name in names):
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 report={'profile':profile,'samples':len(samples),'maxHandResidualMetres':{side:max(values) for side,values in errors.items()}}
 reports.append(report);print(json.dumps(report),flush=True)
rig.animation_data.action=None
out=p/'soldier-roll-grips-candidate.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
(p/'roll-grips-candidate.json').write_text(json.dumps({'status':'candidate; exported path, grip, body contact and rendering validation required','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'actions':reports},indent=2))
