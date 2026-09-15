"""Materialize the exact v10 runtime rig and its baked curves as editable Blender data.
Run after node scripts/build-trooper-kling.mjs using Blender 5.2.
The GLB is authoritative; do not re-export meshes over v9 from an older .blend.
"""
import bpy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/characters/standard_trooper_v10.glb'))
scene = bpy.context.scene
scene.render.fps = 60
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert len(rig.data.bones) == 57
scene['motion_reference'] = 'Kling: walking 1.792-3.917s; running 2.208-3.875s; aim 1.5-2.625s. Reconstructed, not motion capture.'
scene['runtime_source'] = 'public/assets/characters/standard_trooper_v10.glb'
scene['authoring_generator'] = 'scripts/build-trooper-kling.mjs'
out = ROOT / 'assets/blender/source/standard_trooper_v10.blend'
for action in bpy.data.actions:
    action.use_fake_user = True
if rig.animation_data:
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = None
scene.frame_start = 0
scene.frame_end = 60
bpy.ops.wm.save_as_mainfile(filepath=str(out))
report = {'fps':scene.render.fps,'rig':rig.name,'bones':len(rig.data.bones),'actions':[a.name for a in bpy.data.actions], 'source':str(out.relative_to(ROOT))}
(ROOT / 'public/assets/characters/standard_trooper_v10.blender.json').write_text(json.dumps(report,indent=2)+'\n')
print('BLENDER_VERIFIED',json.dumps(report))
