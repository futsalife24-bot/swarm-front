import bpy,json
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p/'swarm-soldier.glb'))
print(json.dumps([{'name':o.name,'vertices':len(o.data.vertices),'hideRender':o.hide_render,'modifiers':[m.type for m in o.modifiers],'collections':[c.name for c in o.users_collection]} for o in bpy.context.scene.objects if o.type=='MESH']))
