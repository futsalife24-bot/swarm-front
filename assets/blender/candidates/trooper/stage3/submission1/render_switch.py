"""Reopen baked candidate, evaluate time, then resolve weapon attachment events."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'))
s=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG'];rig.data.pose_position='POSE'
for tr in rig.animation_data.nla_tracks:tr.mute=True
cam=s.camera;s.render.resolution_x=480;s.render.resolution_y=560;s.cycles.samples=8
s.render.image_settings.file_format='PNG';s.render.resolution_percentage=100
weapons={k:bpy.data.objects['Weapon_'+k] for k in ['rifle','rocket','shotgun']};weapons['shotgun'].hide_render=True
quick='--quick' in sys.argv;frames=[0,6,15,22,25,27,30,34,36,39,42,48,54,60] if quick else sorted(set(range(0,61,2))|{25,27,35,37})
if '--frames' in sys.argv:frames=[int(f) for f in sys.argv[sys.argv.index('--frames')+1].split(',')]
views={'back':((-3,-6,2.5),(0,-.04,1.02)),'side':((6,-1,2.15),(0,-.04,1.02))}
if '--view' in sys.argv:views={sys.argv[sys.argv.index('--view')+1]:views[sys.argv[sys.argv.index('--view')+1]]}
for direction,source,dest in [('1_to_2','rifle','rocket'),('2_to_1','rocket','rifle')]:
 if '--direction' in sys.argv and direction!=sys.argv[sys.argv.index('--direction')+1]:continue
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=bpy.data.actions['Trial_Switch_'+direction]
 for view,(pos,target) in views.items():
  out=Q/('quick' if quick else 'frames')/(direction+'_'+view);out.mkdir(parents=True,exist_ok=True)
  cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.25
  if '--close' in sys.argv:
   target=(.25,-.1,1.38);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.1
  for f in frames:
   s.frame_set(f);bpy.context.view_layer.update()
   for kind in [source,dest]:
    ishand=(kind==source and f<27) or (kind==dest and f>=36)
    bn='RightHandWeaponSocket' if ishand else 'BackWeaponSocket' if kind=='rifle' else 'BackWeaponSocket_2'
    weapons[kind].hide_render=False;weapons[kind].matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
   s.render.filepath=str(out/f'{f:03}.png');bpy.ops.render.render(write_still=True)
print('SWITCH RENDER COMPLETE',bpy.app.build_options.codec_ffmpeg)
