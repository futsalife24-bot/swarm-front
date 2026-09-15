import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from bpy_extras.object_utils import world_to_camera_view
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q.parent/'stage1/trooper_anatomy_stage1.blend'))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
s.render.resolution_x=700;s.render.resolution_y=700;s.cycles.samples=24
cam=s.camera;cam.data.ortho_scale=.3;target=Vector((-.39,.05,.815));cam.location=(-1.7,3,.99);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
report={}
for name,angle in [('open',0),('curl',.78)]:
 for b in rig.pose.bones:
  if b.name.startswith(('Thumb','Index','Middle','Ring','Little')):b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),angle*.65 if 'Thumb' in b.name else angle)
 bpy.context.view_layer.update();s.render.filepath=str(Q/f'diagnostic_hand_{name}.png');bpy.ops.render.render(write_still=True)
 lines=[]
 for b in rig.pose.bones:
  if b.name.endswith('_L') and b.name.startswith(('Thumb','Index','Middle','Ring','Little')):
   pts=[world_to_camera_view(s,cam,rig.matrix_world@p) for p in [b.head,b.tail]];lines.append({'bone':b.name,'points':[[p.x*700,(1-p.y)*700] for p in pts]})
 report[name]=lines
(Q/'diagnostic_hand_projection.json').write_text(json.dumps(report,indent=2))
