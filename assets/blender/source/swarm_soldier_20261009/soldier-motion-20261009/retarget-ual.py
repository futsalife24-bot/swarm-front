import bpy,json,math
from pathlib import Path
from mathutils import Quaternion,Vector,Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-rig-input.blend'))
s=bpy.context.scene;target=next(o for o in s.objects if o.type=='ARMATURE' and not o.hide_render)
with bpy.data.libraries.load(str(p/'source/ual-source.blend'),link=False) as (a,b):
 b.objects=['Rig'];b.actions=a.actions
source=b.objects[0];sourceActions=list(b.actions);s.collection.objects.link(source);source.hide_render=True
source.animation_data_create()
for t in list(source.animation_data.nla_tracks):source.animation_data.nla_tracks.remove(t)
target.animation_data_clear();target.animation_data_create()
mapping={'root':'root','hips':'DEF-hips','spine':'DEF-spine.001','chest':'DEF-spine.003','neck':'DEF-neck','head':'DEF-head'}
for side in ['L','R']:
 for a,b in [('shoulder','shoulder'),('upper_arm','upper_arm'),('lower_arm','forearm'),('hand','hand'),('upper_leg','thigh'),('lower_leg','shin'),('foot','foot'),('toes','toe')]:mapping[a+'.'+side]='DEF-'+b+'.'+side
 for finger,sf in [('thumb','thumb'),('index','f_index'),('middle','f_middle'),('ring','f_ring'),('little','f_pinky')]:
  for i,seg in enumerate(['proximal','intermediate','distal'],1):mapping[finger+'_'+seg+'.'+side]='DEF-'+sf+'.0'+str(i)+'.'+side
clips={'Idle':'Idle_Loop','Walk':'Walk_Loop','Jog':'Jog_Fwd_Loop','Sprint':'Sprint_Loop','Jump_Start':'Jump_Start','Jump_Air':'Jump_Loop','Jump_Land':'Jump_Land','Dodge_Roll':'Roll','Hit':'Hit_Chest','Down':'Death01','Revive':'Fixing_Kneeling'}
scale=(target.matrix_world@target.data.bones['hips'].head_local).z/(source.matrix_world@source.data.bones['DEF-hips'].head_local).z
report={'source':'Quaternius Universal Animation Library Standard CC0','scale':scale,'clips':[],'status':'candidate-not-approved'}
restT={n:(target.matrix_world@target.data.bones[n].matrix_local).to_quaternion() for n in mapping}
restS={n:(source.matrix_world@source.data.bones[m].matrix_local).to_quaternion() for n,m in mapping.items()}
for n,m in mapping.items():
 if n.startswith(('upper_arm.','lower_arm.','hand.','upper_leg.','lower_leg.')):
  td=target.matrix_world.to_3x3()@(target.data.bones[n].tail_local-target.data.bones[n].head_local)
  sd=source.matrix_world.to_3x3()@(source.data.bones[m].tail_local-source.data.bones[m].head_local)
  restT[n]=td.normalized().rotation_difference(sd.normalized())@restT[n]
originalFPS=s.render.fps;s.render.fps=30
for name,ref in clips.items():
 a=next(a for a in sourceActions if a.name==ref or a.name.startswith(ref+'.'))
 source.animation_data.action=a;source.animation_data.action_slot=a.slots[0]
 duration=(a.frame_range[1]-a.frame_range[0])/24;end=round(duration*30)
 out=bpy.data.actions.new('Soldier_'+name);target.animation_data.action=out
 for pb in target.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
 for f in range(end+1):
  sf=a.frame_range[0]+f/max(end,1)*(a.frame_range[1]-a.frame_range[0]);s.frame_set(math.floor(sf),subframe=sf%1)
  desired={n:(source.matrix_world@source.pose.bones[m].matrix).to_quaternion()@restS[n].inverted()@restT[n] for n,m in mapping.items()}
  for pb in target.pose.bones:
   if pb.name not in mapping:continue
   parentQ=desired.get(pb.parent.name,(target.matrix_world@pb.parent.matrix).to_quaternion()) if pb.parent else target.matrix_world.to_quaternion()
   localRest=(pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local).to_quaternion() if pb.parent else pb.bone.matrix_local.to_quaternion()
   pb.rotation_quaternion=localRest.inverted()@parentQ.inverted()@desired[pb.name]
   pb.keyframe_insert(data_path='rotation_quaternion',frame=f)
  hip=target.pose.bones['hips'];sm=source.pose.bones['DEF-hips'];delta=(source.matrix_world@sm.matrix.translation)-(source.matrix_world@sm.bone.head_local)
  hip.location=hip.bone.matrix_local.to_quaternion().inverted()@(delta*scale)
  hip.keyframe_insert(data_path='location',frame=f)
 out.use_fake_user=True
 target.animation_data.action=None
 tr=target.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,out);tr.mute=True
 report['clips'].append({'name':name,'reference':ref,'duration':duration,'frames':end+1})
source.hide_set(True)
source.animation_data_clear()
for a in list(bpy.data.actions):
 if not a.name.startswith('Soldier_'):bpy.data.actions.remove(a)
target.animation_data.action=None
for pb in target.pose.bones:pb.rotation_quaternion=Quaternion();pb.location=(0,0,0)
s.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
for o in [target,bpy.data.objects['Body'],bpy.data.objects['Head']]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=target
bpy.ops.export_scene.gltf(filepath=str(p/'soldier-motion-candidate.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-motion-candidate.blend'))
(p/'retarget-report.json').write_text(json.dumps(report,indent=2))
