import bpy,json
from pathlib import Path
Q=Path(__file__).resolve().parent
s=bpy.context.scene;s.render.fps=30;s.render.resolution_x=960;s.render.resolution_y=600;s.render.resolution_percentage=100
editor=s.sequence_editor_create();strip=editor.strips.new_movie('Normal speed / Three.js isolated preview',str(Q/'normalized.webm'),channel=1,frame_start=1)
assert 29<strip.fps<31,strip.fps
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.sequencer_colorspace_settings.name='sRGB'
s.frame_start=1;s.frame_end=strip.frame_final_end-1;s.render.use_sequencer=True;s.render.use_compositing=False
out=Q/'video-frames';out.mkdir(exist_ok=True)
s.render.image_settings.file_format='PNG';s.render.image_settings.media_type='IMAGE'
for sec in [1,3,5,6.6,8,9.7,11,13,15,17,19,21,23,25,27,29,31]:
 f=round(sec*30)+1
 if f>s.frame_end:continue
 s.frame_set(f);s.render.filepath=str(out/f'{sec:04.1f}.png');bpy.ops.render.render(write_still=True)
s.render.image_settings.media_type='VIDEO';s.render.ffmpeg.format='MPEG4';s.render.ffmpeg.codec='H264';s.render.ffmpeg.constant_rate_factor='MEDIUM';s.render.ffmpeg.ffmpeg_preset='GOOD';s.render.filepath=str(Q/'normal-speed-showcase.mp4')
bpy.ops.render.render(animation=True)
(Q/'video-metadata.json').write_text(json.dumps({'frames':s.frame_end,'fps':30,'seconds':s.frame_end/30,'source':'Browser MediaRecorder, actual runtime-speed Three.js rendering, no animation speed retiming'},indent=2))
print('VIDEO PACKAGE COMPLETE',s.frame_end)
