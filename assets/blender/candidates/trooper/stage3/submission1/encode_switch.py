import bpy,sys
from pathlib import Path
Q=Path(__file__).resolve().parent;test='--test' in sys.argv;root=Q/('video_test_frames' if test else 'video_frames')
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.resolution_x=960;s.render.resolution_y=600;s.render.resolution_percentage=100;s.render.fps=120;s.render.image_settings.media_type='VIDEO';s.render.ffmpeg.format='MPEG4';s.render.ffmpeg.codec='H264';s.render.ffmpeg.constant_rate_factor='MEDIUM';s.render.ffmpeg.ffmpeg_preset='GOOD';s.view_settings.view_transform='Standard';s.view_settings.look='None';s.sequencer_colorspace_settings.name='sRGB'
for direction in ['1_to_2','2_to_1']:
 for label,speed in [('normal',1),('slow25',4)]:
  if test and (direction!='1_to_2' or label!='normal'):continue
  if s.sequence_editor:s.sequence_editor_clear()
  ed=s.sequence_editor_create();files=sorted((root/direction).glob('*.png'));assert files and files[-1].stem=='060'
  for repeat in range(3 if speed==1 else 1):
   start=1+repeat*(60*speed+30)
   for i,p in enumerate(files):
    f=int(p.stem);n=int(files[i+1].stem) if i+1<len(files) else 60+30/speed
    strip=ed.strips.new_image(p.stem,filepath=str(p),channel=1,frame_start=start+f*speed);strip.frame_final_duration=round((n-f)*speed)
  s.frame_start=1;s.frame_end=270 if speed==1 else 270;s.render.filepath=str(Q/(('test_' if test else 'P3_')+direction+'_'+label+'.mp4'));bpy.ops.render.render(animation=True)
print('VIDEO ENCODE COMPLETE')

