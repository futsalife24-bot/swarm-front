import bpy,json
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'dist-work/run-transfer-20260913'
scene=bpy.context.scene;scene.render.fps=30;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.sequencer_colorspace_settings.name='sRGB'
scene.render.use_sequencer=True;scene.render.use_compositing=False
editor=scene.sequence_editor_create()
for key in ['jog','sprint']:
 files=sorted((OUT/(key+'-frames')).glob('*.jpg'));assert len(files)==360
 strip=editor.strips.new_image(key,str(files[0]),channel=1,frame_start=1)
 for f in files[1:]:strip.elements.append(f.name)
 strip.frame_final_duration=len(files);scene.frame_start=1;scene.frame_end=len(files)
 scene.render.image_settings.media_type='VIDEO';scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264';scene.render.ffmpeg.constant_rate_factor='MEDIUM';scene.render.ffmpeg.ffmpeg_preset='GOOD';scene.render.filepath=str(OUT/('SwarmFront-'+key+'-vs-current-20260913.mp4'))
 bpy.ops.render.render(animation=True);editor.strips.remove(strip)
print('ENCODED 2 x 12 seconds, 1280x720 H264 30fps')
