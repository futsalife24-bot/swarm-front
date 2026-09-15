import bpy, math,sys
from pathlib import Path
from mathutils import Matrix,Vector
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'))
s=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG'];cam=s.camera
for tr in rig.animation_data.nla_tracks:tr.mute=True
s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100;s.cycles.samples=12
bpy.data.objects['Weapon_shotgun'].hide_render=True
checks=[('1_to_2',0,'rifle'),('1_to_2',2,'rifle'),('1_to_2',36,'rocket'),('2_to_1',10,'rocket')]
if '--frames' in sys.argv:checks=[('1_to_2',int(f),'rifle') for f in sys.argv[sys.argv.index('--frames')+1].split(',')]
for direction,f,kind in checks:
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=bpy.data.actions['Trial_Switch_'+direction];s.frame_set(f);bpy.context.view_layer.update()
 source,dest=('rifle','rocket') if direction=='1_to_2' else ('rocket','rifle')
 for wk in ['rifle','rocket']:
  held=(wk==source and f<27) or (wk==dest and f>=36)
  bn='RightHandWeaponSocket' if held else 'BackWeaponSocket' if wk=='rifle' else 'BackWeaponSocket_2'
  ob=bpy.data.objects['Weapon_'+wk];ob.hide_render=False;ob.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
 target=Vector((.30,0,1.38)) if kind=='rifle' else rig.pose.bones['LowerArm_R'].head.lerp(rig.pose.bones['Hand_R'].head,.5)
 for view,offset in [('front',(3,3,1)),('rear',(3,-3,1))]:
  cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.75
  s.render.filepath=str(Q/f'contact_{direction}_{f:02}_{view}.png');bpy.ops.render.render(write_still=True)
print('CONTACT CLOSEUPS COMPLETE')
