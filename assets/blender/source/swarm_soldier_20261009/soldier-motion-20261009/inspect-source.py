import bpy,json
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(next((p/'source').rglob('*.glb'))))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
report={'rig':r.name,'matrix':[list(row) for row in r.matrix_world],'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local)} for b in r.data.bones},'actions':[{'name':a.name,'range':list(a.frame_range),'slots':[s.identifier for s in a.slots]} for a in bpy.data.actions],'objects':[{'name':o.name,'type':o.type} for o in bpy.context.scene.objects]}
(p/'source-inspect.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(p/'source/ual-source.blend'))
