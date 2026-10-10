"""Keep the support arm in front of the vest during the stylized launcher reload.

Only Rocket_Reload upper/lower left arm and hand change. Preserve all other
motions, endpoints, right-hand weapon attachment, timing and ground correction.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-sling-motion-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
a=bpy.data.actions['Soldier_Rocket_Reload'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
start,end=a.frame_range
basis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))@rig.matrix_world
inverse=basis.inverted();samples=[];residual=[];elbows=[]
for tick in range(round(start*4),round(end*4)+1):
 f=tick/4;t=(f-start)/(end-start);s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
 upper=rig.pose.bones['upper_arm.L'];lower=rig.pose.bones['lower_arm.L'];hand=rig.pose.bones['hand.L']
 shoulder=upper.head.copy();oldElbow=lower.head.copy();oldHand=hand.head.copy();hq=hand.matrix.to_quaternion()
 chest=basis@rig.pose.bones['chest'].head
 # These are visual staging positions relative to the chest in runtime axes.
 # They keep the palm on the visible front/left side instead of through the vest.
 points=[(0,Vector((.240,.265,-.240))),(.18,Vector((-.195,-.080,-.200))),(.38,Vector((.065,.275,-.225))),(.57,Vector((.090,.285,-.230))),(.75,Vector((.110,.270,-.250))),(1,Vector((.240,.265,-.240)))]
 for (at,p0),(bt,p1) in zip(points,points[1:]):
  if t<=bt:
   u=max(0,min(1,(t-at)/(bt-at)));dest=inverse@(chest+p0.lerp(p1,u*u*(3-2*u)));break
 # Blend both target and elbow plane into the exact existing endpoint poses.
 w=min(1,t/.12,(1-t)/.12);w=max(0,w);w=w*w*(3-2*w)
 dest=oldHand.lerp(dest,w)
 l1=(oldElbow-shoulder).length;l2=(oldHand-oldElbow).length
 axis=(dest-shoulder).normalized();distance=min(max((dest-shoulder).length,.001),l1+l2-.0001)
 polePoint=inverse@(chest+Vector((-.280,.025,-.240)))
 oldPole=oldElbow-shoulder-axis*(oldElbow-shoulder).dot(axis)
 newPole=polePoint-shoulder-axis*(polePoint-shoulder).dot(axis)
 pole=oldPole.normalized().lerp(newPole.normalized(),w).normalized()
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=shoulder+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
 q=(oldElbow-shoulder).rotation_difference(elbow-shoulder)
 upper.matrix=Matrix.Translation(shoulder)@q.to_matrix().to_4x4()@Matrix.Translation(-shoulder)@upper.matrix;bpy.context.view_layer.update()
 pivot=lower.head.copy();q=(hand.head-pivot).rotation_difference(dest-pivot)
 lower.matrix=Matrix.Translation(pivot)@q.to_matrix().to_4x4()@Matrix.Translation(-pivot)@lower.matrix;bpy.context.view_layer.update()
 hand.matrix=Matrix.LocRotScale(hand.head,hq,Vector((1,1,1)));bpy.context.view_layer.update()
 residual.append((hand.head-dest).length);elbows.append(list(basis@lower.head-chest))
 samples.append((f,{b.name:b.matrix_basis.copy() for b in [upper,lower,hand]}))
previous={}
for f,pose in samples:
 for n,m in pose.items():
  b=rig.pose.bones[n];loc,q,scale=m.decompose()
  if n in previous:q.make_compatible(previous[n])
  previous[n]=q.copy();b.location=loc;b.rotation_quaternion=q;b.scale=scale
  for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=f)
for layer in a.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:key.interpolation='LINEAR'
rig.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-reload-candidate.blend'))
report={'status':'candidate; rendered validation pending','changedAction':a.name,'samples':len(samples),'maxHandResidualMetres':max(residual),'elbowRuntimeChestRelativeBounds':[[min(v[i] for v in elbows),max(v[i] for v in elbows)] for i in range(3)]}
(p/'rocket-reload-candidate.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
