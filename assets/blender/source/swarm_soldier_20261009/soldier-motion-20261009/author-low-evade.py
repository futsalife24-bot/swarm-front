"""User-approved low, weapon-supported evasive step, replacing the somersault.

Visual authoring only: the game's evade duration/distance/invulnerability remain
unchanged. Per-profile idle upper bodies preserve established weapon grips.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-roll-grips-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
duration=44
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def curve(t,points):
 for (a,x),(b,y) in zip(points,points[1:]):
  if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
 return points[-1][1]
def evaluate(action,f):
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
def solve_leg(side,dest,footQ):
 upper=rig.pose.bones['upper_leg.'+side];lower=rig.pose.bones['lower_leg.'+side];foot=rig.pose.bones['foot.'+side]
 a=upper.head.copy();b=lower.head.copy();c=foot.head.copy();l1=(b-a).length;l2=(c-b).length
 axis=(dest-a).normalized();distance=min(max((dest-a).length,abs(l1-l2)+1e-5),l1+l2-1e-5)
 pole=Vector((0,-1,0));pole-=axis*pole.dot(axis)
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=a+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
 q=(b-a).rotation_difference(elbow-a);upper.matrix=Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-a)@upper.matrix;bpy.context.view_layer.update()
 b=lower.head.copy();q=(foot.head-b).rotation_difference(dest-b);lower.matrix=Matrix.Translation(b)@q.to_matrix().to_4x4()@Matrix.Translation(-b)@lower.matrix;bpy.context.view_layer.update()
 foot.matrix=Matrix.LocRotScale(foot.head,footQ,Vector((1,1,1)));bpy.context.view_layer.update()
 return (foot.head-dest).length
report={'status':'candidate; rendering and transitions required','approval':'2026-10-09 user selected low stepping evade; transient weapon floor penetration accepted','profiles':{}}
for profile in ['Rifle','Shotgun','Rocket']:
 idle=bpy.data.actions['Soldier_'+profile+'_Idle'];evaluate(idle,idle.frame_range[0])
 base={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
 feet={side:rig.pose.bones['foot.'+side].matrix.copy() for side in ['R','L']}
 name='Soldier_Dodge_Roll'+('' if profile=='Rifle' else '_'+profile)
 old=bpy.data.actions[name];old.name=name+'_ArchivedRoll'
 action=bpy.data.actions.new(name);action.use_fake_user=True
 samples=[];maxError=0
 for tick in range(duration*4+1):
  f=tick/4;t=f/duration;evaluate(idle,idle.frame_range[0])
  for n,m in base.items():rig.pose.bones[n].matrix_basis=m
  bpy.context.view_layer.update()
  drop=curve(t,[(0,0),(.2,.16),(.5,.20),(.76,.15),(1,0)])
  lean=curve(t,[(0,0),(.25,13),(.6,16),(.8,9),(1,0)])
  hip=rig.pose.bones['hips'];m=hip.matrix.copy();m.translation+=Vector((0,0,-drop));hip.matrix=m;bpy.context.view_layer.update()
  # Rotate from the pelvis so the shoulders and weapon stay connected.
  spine=rig.pose.bones['spine'];pivot=spine.head.copy();rotation=Matrix.Rotation(math.radians(lean),4,'X')
  spine.matrix=Matrix.Translation(pivot)@rotation@Matrix.Translation(-pivot)@spine.matrix;bpy.context.view_layer.update()
  for side in ['R','L']:
   goal=feet[side].translation.copy()
   if side=='L':
    forward=curve(t,[(0,0),(.2,.10),(.5,.32),(.72,.25),(1,0)])
    lift=curve(t,[(0,0),(.12,.025),(.35,.085),(.62,0),(1,0)])
   else:
    forward=curve(t,[(0,0),(.2,-.24),(.5,-.29),(.72,-.12),(1,0)])
    lift=curve(t,[(0,0),(.32,0),(.6,.07),(.85,.025),(1,0)])
   goal+=Vector((0,-forward,lift));maxError=max(maxError,solve_leg(side,goal,feet[side].to_quaternion()))
  samples.append((f,{b.name:b.matrix_basis.copy() for b in rig.pose.bones}))
 rig.animation_data.action=action;previous={}
 for f,pose in samples:
  for n,m in pose.items():
   b=rig.pose.bones[n];loc,q,scale=m.decompose();b.rotation_mode='QUATERNION'
   if n in previous:q.make_compatible(previous[n])
   previous[n]=q.copy();b.location=loc;b.rotation_quaternion=q;b.scale=scale
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=f)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
 bpy.data.actions.remove(old)
 report['profiles'][profile]={'samples':len(samples),'maxFootTargetErrorMetres':maxError}
 print(profile,json.dumps(report['profiles'][profile]),flush=True)
rig.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-low-evade-candidate.blend'))
report['sha256']=hashlib.sha256((p/'soldier-low-evade-candidate.blend').read_bytes()).hexdigest()
(p/'low-evade-candidate.json').write_text(json.dumps(report,indent=2))
