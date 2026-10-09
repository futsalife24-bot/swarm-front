import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
p=Path(__file__).resolve().parent
quick='--quick' in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-combat-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE' and not o.hide_render);body=bpy.data.objects['Body']
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
sole=[v.index for v in body.data.vertices if (body.matrix_world@v.co).z<.06]
grounded={'Idle','Walk','Hit','Revive','Rifle_Idle','Rifle_LowReady','Rifle_Aim','Rifle_Fire','Rifle_Reload','Rifle_Walk','Shotgun_Idle','Shotgun_LowReady','Shotgun_Aim','Shotgun_Fire','Shotgun_Reload','Rocket_Idle','Rocket_Walk','Rocket_Fire','Rocket_Reload','Weapon_Switch','Weapon_Switch_Back'}
running={'Jog','Sprint','Rifle_Run','Rifle_Backward','Rocket_Run','Rocket_Backward'}
loops={'Idle','Walk','Jog','Sprint','Jump_Air','Revive','Rifle_Idle','Rifle_LowReady','Rifle_Walk','Rifle_Run','Rifle_Backward','Shotgun_Idle','Shotgun_LowReady','Rocket_Idle','Rocket_Walk','Rocket_Run','Rocket_Backward'}
report={'corrections':{},'fingerWeightedVertices':{g.name:sum(any(w.group==g.index and w.weight>.1 for w in v.groups) for v in body.data.vertices) for g in body.vertex_groups if any(x in g.name for x in ['index','middle','thumb'])}}
# Calibrated support frame from the rifle idle, in weapon space.
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(round(idle.frame_range[0]));bpy.context.view_layer.update()
socket0=rig.pose.bones['RightHandWeaponSocket'].matrix.copy();sq0=socket0.to_quaternion();socket0.translation+=sq0@Vector((0,.060,.025))
supportAnchor=socket0.inverted()@(rig.pose.bones['hand.L'].head+sq0@Vector((0,.030,.075)))
supportRotation=sq0.inverted()@rig.pose.bones['hand.L'].matrix.to_quaternion()@Quaternion(Vector((0,1,0)),-math.pi/2)
def reload_position(t):
 points=[(0,supportAnchor),(.16,Vector((.085,.100,-.100))),(.30,Vector((.085,.100,-.205))),(.50,Vector((.170,-.020,-.290))),(.66,Vector((.085,.100,-.210))),(.82,Vector((.085,.100,-.100))),(1,supportAnchor)]
 for (a,p0),(b,p1) in zip(points,points[1:]):
  if t<=b:
   u=max(0,min(1,(t-a)/(b-a)));return p0.lerp(p1,u*u*(3-2*u))
 return supportAnchor.copy()
for action in list(bpy.data.actions):
 if not action.name.startswith('Soldier_'):continue
 if quick and action.name!='Soldier_Rifle_Idle':continue
 name=action.name[8:];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 start,end=map(round,action.frame_range);samples=[]
 for f in range(start,end+1):
  s.frame_set(f);bpy.context.view_layer.update()
  # Read all samples before editing keyframes, avoiding evaluation feedback.
  sample={b.name:{'q':b.rotation_quaternion.copy(),'loc':b.location.copy()} for b in rig.pose.bones}
  if name.startswith(('Rifle_','Shotgun_','Rocket_')):
   # Grip pose is calibrated to this model's own finger axes and proportions.
   # Keep the support hand free during reload; the firing hand keeps its grip.
   sides=['R','L'];supportWeight=1.0
   if 'Reload' in name:
    t=(f-start)/max(1,end-start);edge=max(0,min(1,min(t,1-t)/.18));supportWeight=1-edge*edge*(3-2*edge)
   for side in sides:
    weight=supportWeight if side=='L' else 1.0
    roll=Quaternion(Vector((0,1,0)),-math.pi/2*weight if side=='L' else 0)
    sample['hand.'+side]['q']=sample['hand.'+side]['q']@roll
    if side=='R':
     sn='RightHandWeaponSocket';b=rig.data.bones[sn];rest=rig.data.bones['hand.R'].matrix_local.inverted()@b.matrix_local
     basis=Matrix.LocRotScale(sample[sn]['loc'],sample[sn]['q'],Vector((1,1,1)))
     corrected=rest.inverted()@roll.inverted().to_matrix().to_4x4()@rest@basis
     sample[sn]['loc']=corrected.translation;sample[sn]['q']=corrected.to_quaternion()
    across=(rig.data.bones['index_proximal.'+side].head_local-rig.data.bones['little_proximal.'+side].head_local).normalized()
    for finger in ['index','middle','ring','little']:
     angles=[25,55,40] if finger=='index' and side=='R' and 'Reload' not in name else [55,70,40]
     for seg,angle in zip(['proximal','intermediate','distal'],angles):
      bn=finger+'_'+seg+'.'+side;axis=rig.data.bones[bn].matrix_local.to_quaternion().inverted()@across
      sample[bn]['q']=sample[bn]['q'].slerp(Quaternion(axis,math.radians(angle)*(1 if side=='R' else -1)),weight)
   for n,v in sample.items():rig.pose.bones[n].rotation_quaternion=v['q'];rig.pose.bones[n].location=v['loc']
   bpy.context.view_layer.update()
   socket=rig.pose.bones['RightHandWeaponSocket'];sq=socket.matrix.to_quaternion()
   mat=socket.matrix.copy();mat.translation+=sq@Vector((0,.060,.025));socket.matrix=mat
   sample[socket.name]={'q':socket.rotation_quaternion.copy(),'loc':socket.location.copy()}
   if 'L' in sides:
    upper=rig.pose.bones['upper_arm.L'];lower=rig.pose.bones['lower_arm.L'];hand=rig.pose.bones['hand.L'];hq=hand.matrix.to_quaternion()
    a0=upper.head.copy();b0=lower.head.copy();c0=hand.head.copy();goal=c0+(sq@Vector((0,.030,.075)))*supportWeight;l1=(b0-a0).length;l2=(c0-b0).length
    if name=='Rifle_Reload':
     goal=socket.matrix@reload_position((f-start)/max(1,end-start));hq=sq@supportRotation
    axis=(goal-a0).normalized();dist=min((goal-a0).length,l1+l2-.0001);pole=b0-a0-axis*(b0-a0).dot(axis)
    along=(l1*l1-l2*l2+dist*dist)/(2*dist);elbow=a0+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
    q=(b0-a0).rotation_difference(elbow-a0);upper.matrix=Matrix.Translation(a0)@q.to_matrix().to_4x4()@Matrix.Translation(-a0)@upper.matrix;bpy.context.view_layer.update()
    pt=lower.head.copy();q=(hand.head-pt).rotation_difference(goal-pt);lower.matrix=Matrix.Translation(pt)@q.to_matrix().to_4x4()@Matrix.Translation(-pt)@lower.matrix;bpy.context.view_layer.update()
    hand.matrix=Matrix.LocRotScale(hand.head,hq,Vector((1,1,1)))
    for pb in [upper,lower,hand]:sample[pb.name]={'q':pb.rotation_quaternion.copy(),'loc':pb.location.copy()}
  lift=0
  if name in grounded|running:
   obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh();low=min((obj.matrix_world@mesh.vertices[i].co).z for i in sole);obj.to_mesh_clear()
   lift=.002-low if name in grounded else max(0,.002-low)
   hip=rig.pose.bones['hips'];basis=(rig.matrix_world@hip.parent.matrix).to_quaternion()@(hip.parent.bone.matrix_local.inverted()@hip.bone.matrix_local).to_quaternion()
   sample['hips']['loc']+=basis.inverted()@Vector((0,0,lift))
  samples.append(sample)
 if name in loops:
  # Blend only the last 10% into the exact first pose to close the cycle.
  width=max(2,round((end-start)*.1))
  for j in range(width+1):
   idx=len(samples)-1-width+j;t=j/width;t=t*t*(3-2*t)
   for n,v in samples[idx].items():
    v['q']=v['q'].slerp(samples[0][n]['q'],t);v['loc']=v['loc'].lerp(samples[0][n]['loc'],t)
 previous={}
 for i,sample in enumerate(samples):
  for n,v in sample.items():
   b=rig.pose.bones[n];q=v['q']
   if n in previous:q.make_compatible(previous[n])
   previous[n]=q.copy();b.rotation_quaternion=q;b.location=v['loc'];b.keyframe_insert(data_path='rotation_quaternion',frame=start+i);b.keyframe_insert(data_path='location',frame=start+i)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
 report['corrections'][name]={'frames':len(samples),'groundCorrection':name in grounded|running,'loopClosed':name in loops}
 action.use_fake_user=True;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.strips.new(name,start,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_quaternion=Quaternion();b.location=(0,0,0)
s.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
for o in [rig,body,bpy.data.objects['Head']]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=rig
for o in list(bpy.data.objects):
 if o not in [rig,body,bpy.data.objects['Head']]:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.outliner.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.file.pack_all()
if quick:
 for a in list(bpy.data.actions):
  if a.name!='Soldier_Rifle_Idle':bpy.data.actions.remove(a)
 bpy.ops.export_scene.gltf(filepath=str(p/'grip-preview.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
 raise SystemExit(0)
bpy.ops.export_scene.gltf(filepath=str(p/'soldier-motion-candidate.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
(p/'polish-report.json').write_text(json.dumps(report,indent=2))
