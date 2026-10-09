"""Candidate: align held and stowed weapon frames at the two attachment events."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-reload-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(0);bpy.context.view_layer.update()
socket=rig.pose.bones['RightHandWeaponSocket'];handFromSocket=socket.matrix.inverted()@rig.pose.bones['hand.R'].matrix
socketBasis=socket.matrix_basis.copy();idleSocket=rig.pose.bones['chest'].matrix.inverted()@socket.matrix
runtimeBasis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))@rig.matrix_world
chestRight=rig.pose.bones['chest'].matrix.to_3x3().inverted()@runtimeBasis.to_3x3().inverted()@Vector((1,0,0))
names=['upper_arm.R','lower_arm.R','hand.R','RightHandWeaponSocket']
fingerNames=[b.name for b in rig.pose.bones if b.name.endswith('.R') and any(f in b.name for f in ['thumb_','index_','middle_','ring_','little_'])]
base={n:rig.pose.bones[n].matrix_basis.copy() for n in names+fingerNames}
report=[]
def blend(a,b,u):
 u=max(0,min(1,u));u=u*u*(3-2*u)
 return Matrix.LocRotScale(a.translation.lerp(b.translation,u),a.to_quaternion().slerp(b.to_quaternion(),u),Vector((1,1,1)))
for actionName,backNames in [('Weapon_Switch',['BackWeaponSocket','BackWeaponSocket_2']),('Weapon_Switch_Back',['BackWeaponSocket_2','BackWeaponSocket'])]:
 action=bpy.data.actions['Soldier_'+actionName];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];start,end=action.frame_range
 samples=[];errors=[]
 frames=sorted(set([i/4 for i in range(round(start*4),round(end*4)+1)]+[start+(end-start)*t for t in [.45,.6]]))
 for f in frames:
  t=(f-start)/(end-start);s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  for n,m in base.items():rig.pose.bones[n].matrix_basis=m
  bpy.context.view_layer.update()
  ready=rig.pose.bones['chest'].matrix@idleSocket
  first=rig.pose.bones[backNames[0]].matrix.copy();second=rig.pose.bones[backNames[1]].matrix.copy()
  wanted=blend(ready,first,t/.45) if t<=.45 else blend(first,second,(t-.45)/.15) if t<=.6 else blend(second,ready,(t-.6)/.4)
  # Route the held weapon around the right flank. The bump and its derivative
  # vanish at both ends, preserving the two measured attachment transforms.
  travel=t/.45 if t<=.45 else (t-.6)/.4 if t>=.6 else None
  if travel is not None:
   outward=(rig.pose.bones['chest'].matrix.to_3x3()@chestRight).normalized()
   wanted.translation+=outward*(.26*math.sin(math.pi*travel)**2)
  target=wanted@handFromSocket
  upper=rig.pose.bones['upper_arm.R'];lower=rig.pose.bones['lower_arm.R'];hand=rig.pose.bones['hand.R']
  a=upper.head.copy();b=lower.head.copy();c=hand.head.copy();dest=target.translation
  l1=(b-a).length;l2=(c-b).length;axis=(dest-a).normalized();distance=min(max((dest-a).length,.001),l1+l2-.0001)
  pole=b-a-axis*(b-a).dot(axis)
  along=(l1*l1-l2*l2+distance*distance)/(2*distance)
  elbow=a+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
  q=(b-a).rotation_difference(elbow-a);upper.matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-a)@upper.matrix;bpy.context.view_layer.update()
  pivot=lower.head.copy();q=(hand.head-pivot).rotation_difference(dest-pivot);lower.matrix=Matrix.Translation(pivot)@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@lower.matrix;bpy.context.view_layer.update()
  hand.matrix=Matrix.LocRotScale(hand.head,target.to_quaternion(),Vector((1,1,1)));bpy.context.view_layer.update()
  actual=rig.pose.bones['RightHandWeaponSocket'].matrix
  errors.append((actual.translation-wanted.translation).length)
  if abs(t-.45)<1e-6 or abs(t-.6)<1e-6:
   angle=math.degrees(actual.to_quaternion().rotation_difference(wanted.to_quaternion()).angle)
   report.append({'action':actionName,'fraction':t,'originGapMetres':errors[-1],'rotationGapDegrees':min(angle,360-angle)})
  samples.append((f,{n:rig.pose.bones[n].matrix_basis.copy() for n in names+fingerNames}))
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
 print(actionName,'maximum socket position residual',max(errors),flush=True)
 if max(errors)>.002:raise RuntimeError('Candidate hand path exceeds arm reach')
rig.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-switch-candidate.blend'))
(p/'switch-handoff-candidate.json').write_text(json.dumps({'status':'candidate; right-flank route; rendered and exported verification required','events':report},indent=2));print(json.dumps(report),flush=True)
