import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist-work/run-transfer-20260913'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/candidates/trooper/stance-v7/trooper_stance_v7.blend'))
target=bpy.data.objects['STANDARD_TROOPER_RIG']
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(OUT/'source/unpacked/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb'))
source=next(o for o in bpy.data.objects if o not in before and o.type=='ARMATURE')
def rigdata(o):
 return {'name':o.name,'matrix':list(map(list,o.matrix_world)), 'bones':{b.name:{'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'matrix':list(map(list,b.matrix_local))} for b in o.data.bones},'tracks':[{ 'name':t.name,'strips':[{'action':s.action.name,'frames':list(s.action.frame_range)} for s in t.strips]} for t in o.animation_data.nla_tracks]}
report={'blender':bpy.app.version_string,'target':rigdata(target),'source':rigdata(source)}
(OUT/'rig-inventory.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'source':source.name,'sourceBones':list(report['source']['bones']),'sourceTracks':report['source']['tracks'],'targetBones':len(target.data.bones)}),flush=True)
