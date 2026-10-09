"""Candidate support-hand release/return, keeping the wrist at its idle bend.

Input is the right-flank switch candidate. Only left-arm/finger tracks of the
two switch clips are written; weapon handoff transforms must remain unchanged.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
p=Path(__file__).resolve().parent
source=next((Path(a.split('=',1)[1]) for a in sys.argv if a.startswith('--source=')),p/'soldier-switch-candidate.blend')
stem=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--output-stem=')),'soldier-switch-support-candidate')
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0]
s.frame_set(0);bpy.context.view_layer.update()
names=['upper_arm.L','lower_arm.L','hand.L']+[b.name for b in rig.pose.bones if b.name.endswith('.L') and any(f in b.name for f in ['thumb_','index_','middle_','ring_','little_'])]
base={n:rig.pose.bones[n].matrix_basis.copy() for n in names}
runtime=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))@rig.matrix_world
chest=rig.pose.bones['chest'].matrix.copy()
shift=chest.to_3x3().inverted()@runtime.to_3x3().inverted()@Vector((-.065,-.11,.025))
report=[]
for name in ['Soldier_Weapon_Switch','Soldier_Weapon_Switch_Back']:
 action=bpy.data.actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 start,end=action.frame_range;samples=[];errors=[];wrist=[]
 for tick in range(round(start*4),round(end*4)+1):
  f=tick/4;t=(f-start)/(end-start);s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  for n,m in base.items():rig.pose.bones[n].matrix_basis=m
  bpy.context.view_layer.update()
  u=max(0,min(1,t/.2,(1-t)/.18));weight=u*u*(3-2*u)
  upper=rig.pose.bones['upper_arm.L'];lower=rig.pose.bones['lower_arm.L'];hand=rig.pose.bones['hand.L']
  a=upper.head.copy();b=lower.head.copy();c=hand.head.copy()
  dest=c+(rig.pose.bones['chest'].matrix.to_3x3()@shift)*weight
  l1=(b-a).length;l2=(c-b).length;axis=(dest-a).normalized()
  distance=min(max((dest-a).length,abs(l1-l2)+.0001),l1+l2-.0001)
  pole=(b-a-axis*(b-a).dot(axis)).normalized()
  along=(l1*l1-l2*l2+distance*distance)/(2*distance)
  elbow=a+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
  q=(b-a).rotation_difference(elbow-a)
  upper.matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-a)@upper.matrix;bpy.context.view_layer.update()
  pivot=lower.head.copy();q=(hand.head-pivot).rotation_difference(dest-pivot)
  lower.matrix=Matrix.Translation(pivot)@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@lower.matrix;bpy.context.view_layer.update()
  # Preserve hand-to-forearm bend instead of freezing its world orientation.
  hand.matrix_basis=base['hand.L'];bpy.context.view_layer.update()
  errors.append((hand.head-dest).length)
  angle=math.degrees(hand.matrix_basis.to_quaternion().rotation_difference(base['hand.L'].to_quaternion()).angle)
  wrist.append(min(angle,360-angle))
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
 report.append({'action':name,'samples':len(samples),'maxHandResidualMetres':max(errors),'maxWristDeltaFromIdleDegrees':max(wrist)})
 assert max(errors)<.002
rig.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=str(p/(stem+'.blend')))
reportName='switch-support-candidate' if stem=='soldier-switch-support-candidate' else stem
(p/(reportName+'.json')).write_text(json.dumps({'status':'candidate; rendered verification required','checks':report},indent=2))
print(json.dumps(report),flush=True)
