import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from bpy_extras.object_utils import world_to_camera_view
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
s.render.resolution_x=600;s.render.resolution_y=600;s.cycles.samples=20
cam=s.camera;cam.data.ortho_scale=.31;report={}
for side,sign in [('L',-1),('R',1)]:
 for name,amount in [('open',0),('half',.45),('grip',.9)]:
  for b in rig.pose.bones:
   if b.name.startswith(('Thumb','Index','Middle','Ring','Little')):
    b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),amount*.8 if 'Thumb' in b.name else amount)
    if b.name=='Thumb1_'+side:b.rotation_quaternion=Quaternion((0,0,1),-sign*amount*.65)@b.rotation_quaternion
  bpy.context.view_layer.update()
  for view in ['palm','side']:
   if '--quick' in sys.argv and (side!='L' or name!='grip' or view!='palm'):continue
   target=Vector((sign*.39,.045,.82));cam.location=(sign*.39,3,.90) if view=='palm' else (sign*3,.24,.88);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
   key=f'hand_{side}_{name}_{view}';s.render.filepath=str(Q/(key+'.png'));bpy.ops.render.render(write_still=True)
   lines=[]
   for b in rig.pose.bones:
    if b.name.endswith('_'+side) and b.name.startswith(('Thumb','Index','Middle','Ring','Little')):
     pts=[world_to_camera_view(s,cam,rig.matrix_world@p) for p in [b.head,b.tail]];lines.append({'bone':b.name,'points':[[p.x*600,(1-p.y)*600] for p in pts]})
   report[key]=lines
(Q/'hand_fit_projection.json').write_text(json.dumps(report,indent=2))
