import bpy,json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'dist-work/run-transfer-20260913'
scene=bpy.context.scene;editor=scene.sequence_editor_create();scene.render.fps=30;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.sequencer_colorspace_settings.name='sRGB';scene.render.use_sequencer=True;scene.render.use_compositing=False
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
report=[]
for key in ['jog','sprint']:
 p=OUT/('SwarmFront-'+key+'-vs-current-20260913.mp4');strip=editor.strips.new_movie(key,str(p),channel=1,frame_start=1)
 assert abs(strip.fps-30)<.1;assert strip.frame_final_duration==360
 # Decode representative phases across every camera section after H264 encoding.
 for frame in [12,24,36,48,144,156,168,180,264,276,288,300]:
  scene.frame_set(frame);scene.render.filepath=str(OUT/f'{key}-decoded-{frame:03}.png');bpy.ops.render.render(write_still=True)
 report.append({'key':key,'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'fps':strip.fps,'frames':strip.frame_final_duration,'seconds':12,'decodedSampleFrames':[12,24,36,48,144,156,168,180,264,276,288,300]});editor.strips.remove(strip)
(OUT/'video-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
