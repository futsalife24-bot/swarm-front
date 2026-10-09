"""Export the authored soldier with the runtime rig/clip contract, without kit donors."""
import bpy, json, math, struct, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
# Preserve the quarter-frame grounding keys when glTF force-samples the rig.
# Scale frame numbers and FPS together, leaving every clip's seconds unchanged.
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:
      key.co.x*=4;key.handle_left.x*=4;key.handle_right.x*=4
s.render.fps*=4
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig,bpy.data.objects['Body'],bpy.data.objects['Head']]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(p/'soldier-motion-candidate.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
beforeObjects=set(bpy.data.objects);beforeActions=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(p/'source/game-trooper.glb'))
added=set(bpy.data.objects)-beforeObjects
source=next(o for o in added if o.type=='ARMATURE')
sw=Matrix.Rotation(math.pi,4,'Z')@source.matrix_world;tw=rig.matrix_world
ratio=(tw@rig.data.bones['hips'].head_local).z/(sw@source.data.bones['Pelvis'].head_local).z
backFrames={}
for name in ['BackWeaponSocket','BackWeaponSocket_2']:
 bone=source.data.bones[name];frame=tw.inverted()@sw@bone.matrix_local
 frame.translation=rig.data.bones['chest'].head_local+tw.to_3x3().inverted()@((sw@bone.head_local-sw@source.data.bones['Chest'].head_local)*ratio)
 backFrames[name]=frame
for obj in added:bpy.data.objects.remove(obj,do_unlink=True)
for action in set(bpy.data.actions)-beforeActions:bpy.data.actions.remove(action)
mapping={'root':'Root','hips':'Pelvis','spine':'Spine','chest':'Chest','neck':'Neck','head':'Head'}
for side in ['L','R']:
 for a,b in [('shoulder','Clavicle'),('upper_arm','UpperArm'),('lower_arm','LowerArm'),('hand','Hand'),('upper_leg','UpperLeg'),('lower_leg','LowerLeg'),('foot','Foot'),('toes','Toe')]:mapping[a+'.'+side]=b+'_'+side
 for finger in ['thumb','index','middle','ring','little']:
  for i,seg in enumerate(['proximal','intermediate','distal'],1):mapping[finger+'_'+seg+'.'+side]=finger.title()+str(i)+'_'+side
# Bone rename updates groups, but detached layered actions also need explicit paths.
for old,new in mapping.items():rig.data.bones[old].name=new
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for old,new in mapping.items():
      curve.data_path=curve.data_path.replace('pose.bones["'+old+'"]','pose.bones["'+new+'"]')
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,parent,offset in [('SpineMid','Spine',(0,0,.05)),('LeftHandSupportSocket','Hand_L',(0,0,0)),('BackWeaponSocket','Chest',(.13,.15,.12)),('BackWeaponSocket_2','Chest',(-.13,.15,.12))]:
 if name in rig.data.edit_bones:continue
 b=rig.data.edit_bones.new(name);b.parent=rig.data.edit_bones[parent]
 b.head=b.parent.head+Vector(offset);b.tail=b.head+Vector((0,0,.06));b.use_deform=False
 if name in backFrames:b.matrix=backFrames[name]
bpy.ops.object.mode_set(mode='OBJECT')
clips={'Idle':'Idle','Walk':'UAL_Walk','Jog':'UAL_Jog','Sprint':'UAL_sprint','Jump_Start':'Jump_Start','Jump_Air':'Jump_Air','Jump_Land':'Jump_Land','Dodge_Roll':'Trial_Dodge_Roll','Hit':'Trial_Hit_Heavy','Down':'Down','Revive':'Revive','Rifle_Idle':'Trial_Weapon_Idle_Rifle','Rifle_LowReady':'Low_Ready_Rifle','Rifle_Aim':'Aim_Raise_Rifle','Rifle_Fire':'Trial_Fire_Rifle','Rifle_Reload':'Trial_Reload_Rifle','Rifle_Walk':'Combat_Walk','Rifle_Run':'Trial_Run','Rifle_Backward':'Trial_Run_Backward','Weapon_Switch':'Trial_Switch_1_to_2','Weapon_Switch_Back':'Trial_Switch_2_to_1','Shotgun_Idle':'Trial_Weapon_Idle_Shotgun','Shotgun_LowReady':'Low_Ready_Shotgun','Shotgun_Aim':'Aim_Raise_Shotgun','Shotgun_Fire':'Trial_Fire_Shotgun','Shotgun_Reload':'Trial_Reload_Shotgun','Rocket_Idle':'Trial_Weapon_Idle_Rocket','Rocket_Walk':'Combat_Walk_Rocket','Rocket_Run':'Trial_Run_Rocket','Rocket_Backward':'Trial_Run_Backward_Rocket','Rocket_Fire':'Trial_Fire_Rocket','Rocket_Reload':'Trial_Reload_Rocket'}
for old,new in clips.items():
 a=bpy.data.actions.get('Soldier_'+old)
 if not a:raise RuntimeError('Missing authored clip: '+old)
 a.name=new;a.use_fake_user=True
for b in rig.pose.bones:b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
s.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
for o in [rig,bpy.data.objects['Body'],bpy.data.objects['Head']]:o.hide_set(False);o.select_set(True)
out=p/'swarm-soldier.glb'
bpy.ops.export_scene.gltf(filepath=str(out),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_extras=True)
# A static basis parent changes -Y Blender forward to the game's +Y convention.
# Keeping it below the scene root preserves it when gameplay sets model.rotation.
raw=out.read_bytes();jlen,jtype=struct.unpack_from('<II',raw,12);g=json.loads(raw[20:20+jlen]);tail=raw[20+jlen:]
for mesh_node in g['nodes']:
 if 'mesh' in mesh_node:mesh_node['name']='SoldierMesh_'+mesh_node.get('name','mesh')
scene=g['scenes'][g.get('scene',0)]
node=len(g['nodes']);g['nodes'].append({'name':'SoldierBasis','rotation':[0,1,0,0],'children':scene['nodes']});scene['nodes']=[node]
scene['extras']={'trooperMotionVersion':10,'trooperDesignVersion':11,'soldierReferenceVersion':'20261009','heightMetres':1.67,'status':'integration-candidate'}
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-game.blend'))
(p/'game-export.json').write_text(json.dumps({'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'clips':list(clips.values()),'boneNames':list(mapping.values()),'status':'not yet validated in gameplay'},indent=2))
