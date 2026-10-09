import bpy,json,math
from pathlib import Path
from mathutils import Quaternion,Vector,Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-motion-candidate.blend'))
s=bpy.context.scene;target=next(o for o in s.objects if o.type=='ARMATURE' and not o.hide_render)
before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(p/'source/game-trooper.glb'));added=set(s.objects)-before
source=next(o for o in added if o.type=='ARMATURE');source.animation_data_create()
for tr in list(source.animation_data.nla_tracks):source.animation_data.nla_tracks.remove(tr)
mapping={'root':'Root','hips':'Pelvis','spine':'Spine','chest':'Chest','neck':'Neck','head':'Head'}
for side in ['L','R']:
 for a,b in [('shoulder','Clavicle'),('upper_arm','UpperArm'),('lower_arm','LowerArm'),('hand','Hand'),('upper_leg','UpperLeg'),('lower_leg','LowerLeg'),('foot','Foot'),('toes','Toe')]:mapping[a+'.'+side]=b+'_'+side
 for finger in ['thumb','index','middle','ring','little']:
  for i,seg in enumerate(['proximal','intermediate','distal'],1):mapping[finger+'_'+seg+'.'+side]=finger.title()+str(i)+'_'+side
correction=Matrix.Rotation(math.pi,4,'Z');sw=correction@source.matrix_world;tw=target.matrix_world
scale=(tw@target.data.bones['hips'].head_local).z/(sw@source.data.bones['Pelvis'].head_local).z
# Carry the existing game's weapon socket as an unweighted child of the hand.
bpy.ops.object.select_all(action='DESELECT');target.hide_set(False);target.select_set(True);bpy.context.view_layer.objects.active=target
bpy.ops.object.mode_set(mode='EDIT')
eb=target.data.edit_bones.new('RightHandWeaponSocket');eb.parent=target.data.edit_bones['hand.R'];sb=source.data.bones['RightHandWeaponSocket'];sh=source.data.bones['Hand_R']
eb.head=target.data.edit_bones['hand.R'].head+tw.to_3x3().inverted()@((sw@sb.head_local-sw@sh.head_local)*scale)
direction=tw.to_3x3().inverted()@sw.to_3x3()@(sb.tail_local-sb.head_local);eb.tail=eb.head+direction.normalized()*.06
eb.align_roll(tw.to_3x3().inverted()@sw.to_3x3()@(sb.matrix_local.to_3x3()@Vector((0,0,1))))
bpy.ops.object.mode_set(mode='OBJECT');mapping['RightHandWeaponSocket']='RightHandWeaponSocket'
restT={n:(tw@target.data.bones[n].matrix_local).to_quaternion() for n in mapping};restS={n:(sw@source.data.bones[m].matrix_local).to_quaternion() for n,m in mapping.items()}
# Match each rest bone direction before copying world-space animation deltas:
# the existing soldier is A-posed, while the new soldier is T-posed.
for n,m in mapping.items():
 if n.startswith(('upper_arm.','lower_arm.','hand.')) or any(n.startswith(f+'_') for f in ['thumb','index','middle','ring','little']):
  td=tw.to_3x3()@(target.data.bones[n].tail_local-target.data.bones[n].head_local)
  sd=sw.to_3x3()@(source.data.bones[m].tail_local-source.data.bones[m].head_local)
  restT[n]=td.normalized().rotation_difference(sd.normalized())@restT[n]
def palm_frame(rig,world,hand,index,little,middle):
 h=world@rig.data.bones[hand].head_local
 forward=(world@rig.data.bones[middle].head_local-h).normalized()
 across=world@rig.data.bones[index].head_local-world@rig.data.bones[little].head_local
 across=(across-forward*across.dot(forward)).normalized()
 return Matrix((across,forward,across.cross(forward))).transposed().to_quaternion()
for side in ['L','R']:
 tf=palm_frame(target,tw,'hand.'+side,'index_proximal.'+side,'little_proximal.'+side,'middle_proximal.'+side)
 sf=palm_frame(source,sw,'Hand_'+side,'Index1_'+side,'Little1_'+side,'Middle1_'+side)
 align=sf@tf.inverted()
 for n in mapping:
  if n=='hand.'+side or (n.endswith('.'+side) and any(n.startswith(f+'_') for f in ['thumb','index','middle','ring','little'])):
   restT[n]=align@(tw@target.data.bones[n].matrix_local).to_quaternion()
clips={'Rifle_Idle':'Trial_Weapon_Idle_Rifle','Rifle_LowReady':'Low_Ready_Rifle','Rifle_Aim':'Aim_Raise_Rifle','Rifle_Fire':'Trial_Fire_Rifle','Rifle_Reload':'Trial_Reload_Rifle','Rifle_Walk':'Combat_Walk','Rifle_Run':'Combat_Run','Rifle_Backward':'Trial_Run_Backward','Weapon_Switch':'Trial_Switch_1_to_2','Weapon_Switch_Back':'Trial_Switch_2_to_1','Shotgun_Idle':'Trial_Weapon_Idle_Shotgun','Shotgun_LowReady':'Low_Ready_Shotgun','Shotgun_Aim':'Aim_Raise_Shotgun','Shotgun_Fire':'Trial_Fire_Shotgun','Shotgun_Reload':'Trial_Reload_Shotgun','Rocket_Idle':'Trial_Weapon_Idle_Rocket','Rocket_Walk':'Combat_Walk_Rocket','Rocket_Run':'Combat_Run_Rocket','Rocket_Backward':'Trial_Run_Backward_Rocket','Rocket_Fire':'Trial_Fire_Rocket','Rocket_Reload':'Trial_Reload_Rocket'}
report=json.loads((p/'retarget-report.json').read_text());report['clips']=[c for c in report['clips'] if c.get('source')!='game'];report['combatNote']='Existing Swarm Front authored clips retargeted as candidates with A/T pose alignment. Grip and contacts require validation.'
for name,ref in clips.items():
 a=bpy.data.actions[ref];source.animation_data.action=a;source.animation_data.action_slot=a.slots[0];duration=(a.frame_range[1]-a.frame_range[0])/30;end=round(duration*30)
 out=bpy.data.actions.new('Soldier_'+name);target.animation_data.action=out
 for pb in target.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
 for f in range(end+1):
  sf=a.frame_range[0]+f;s.frame_set(math.floor(sf),subframe=sf%1)
  desired={n:(sw@source.pose.bones[m].matrix).to_quaternion()@restS[n].inverted()@restT[n] for n,m in mapping.items()}
  for pb in target.pose.bones:
   if pb.name not in mapping:continue
   parentQ=desired.get(pb.parent.name,(tw@pb.parent.matrix).to_quaternion()) if pb.parent else tw.to_quaternion()
   localRest=(pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local).to_quaternion() if pb.parent else pb.bone.matrix_local.to_quaternion()
   pb.rotation_quaternion=localRest.inverted()@parentQ.inverted()@desired[pb.name];pb.keyframe_insert(data_path='rotation_quaternion',frame=f)
  hip=target.pose.bones['hips'];sm=source.pose.bones['Pelvis'];delta=(sw@sm.matrix.translation)-(sw@sm.bone.head_local);hip.location=hip.bone.matrix_local.to_quaternion().inverted()@(delta*scale);hip.keyframe_insert(data_path='location',frame=f)
  bpy.context.view_layer.update()
  # Weapon attachment has an animated position offset in the source action.
  # Omitting that channel leaves the trigger floating ahead of the right hand.
  socket=target.pose.bones['RightHandWeaponSocket']
  offset=(sw@source.pose.bones['RightHandWeaponSocket'].head-sw@source.pose.bones['Hand_R'].head)*scale
  position=tw@target.pose.bones['hand.R'].head+offset
  socket.matrix=tw.inverted()@Matrix.LocRotScale(position,desired['RightHandWeaponSocket'],Vector((1,1,1)))
  socket.keyframe_insert(data_path='location',frame=f);socket.keyframe_insert(data_path='rotation_quaternion',frame=f)
  # Preserve the source's support-hand spacing with a two-bone analytic solve.
  # Reload and switch clips retain their original independent hand motion.
  if name in ['Rifle_Idle','Rifle_LowReady','Rifle_Aim','Rifle_Fire','Rifle_Walk','Rifle_Run','Rifle_Backward']:
   upper=target.pose.bones['upper_arm.L'];lower=target.pose.bones['lower_arm.L'];hand=target.pose.bones['hand.L']
   goal=target.pose.bones['hand.R'].head+tw.to_3x3().inverted()@((sw@source.pose.bones['Hand_L'].head-sw@source.pose.bones['Hand_R'].head)*scale)
   a0=upper.head.copy();b0=lower.head.copy();c0=hand.head.copy();l1=(b0-a0).length;l2=(c0-b0).length
   axis=(goal-a0).normalized();dist=min((goal-a0).length,l1+l2-.0001)
   pole=b0-a0-axis*(b0-a0).dot(axis)
   if pole.length<.00001:pole=Vector((0,0,-1))-axis*axis.dot(Vector((0,0,-1)))
   along=(l1*l1-l2*l2+dist*dist)/(2*dist);elbow=a0+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
   q=(b0-a0).rotation_difference(elbow-a0);mat=upper.matrix.copy();upper.matrix=Matrix.Translation(a0)@q.to_matrix().to_4x4()@Matrix.Translation(-a0)@mat;bpy.context.view_layer.update()
   q=(hand.head-lower.head).rotation_difference(goal-lower.head);point=lower.head.copy();lower.matrix=Matrix.Translation(point)@q.to_matrix().to_4x4()@Matrix.Translation(-point)@lower.matrix;bpy.context.view_layer.update()
   hmat=hand.matrix.copy();hand.matrix=Matrix.LocRotScale(hmat.translation,(tw.inverted().to_quaternion()@desired['hand.L']),Vector((1,1,1)))
   for pb in [upper,lower,hand]:pb.keyframe_insert(data_path='rotation_quaternion',frame=f)
 out.use_fake_user=True;target.animation_data.action=None;tr=target.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(name,0,out);tr.mute=True
 report['clips'].append({'name':name,'reference':ref,'source':'game','duration':duration,'frames':end+1})
for o in added:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):
 if not a.name.startswith('Soldier_'):bpy.data.actions.remove(a)
for pb in target.pose.bones:pb.rotation_quaternion=Quaternion();pb.location=(0,0,0)
s.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
for o in [target,bpy.data.objects['Body'],bpy.data.objects['Head']]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=target
bpy.ops.export_scene.gltf(filepath=str(p/'soldier-motion-candidate.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-combat-candidate.blend'))
(p/'retarget-report.json').write_text(json.dumps(report,indent=2))
