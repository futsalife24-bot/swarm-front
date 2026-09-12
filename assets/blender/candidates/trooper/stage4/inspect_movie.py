import bpy
from pathlib import Path
s=bpy.context.scene;s.render.fps=30
m=s.sequence_editor_create().strips.new_movie('test',str(Path(__file__).parent/'normalized.webm'),channel=1,frame_start=1)
for p in m.bl_rna.properties:
 if any(x in p.identifier for x in ['fps','speed','frame','rate','duration']):
  try:print(p.identifier,getattr(m,p.identifier),p.description)
  except:pass
