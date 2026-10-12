"""Reanimate the preserved v11 geometry in a separate Blender process."""
import bpy, json, sys, hashlib
from pathlib import Path

P = Path(__file__).resolve().parent
SOURCE = P.parent / 'charakuru-20261011'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'harrow.blend'))
rig = bpy.data.objects['HARROW']
rig.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
sys.path.insert(0, str(P))
import animation_contract as motion
metadata = json.loads((SOURCE / 'rig-metadata.json').read_text(encoding='utf-8-sig'))
report = motion.animate(rig, metadata)
report['source_sha256'] = hashlib.sha256((SOURCE / 'harrow.blend').read_bytes()).hexdigest()
bpy.context.scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for obj in bpy.data.objects:
    if obj.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == rig for m in obj.modifiers):
        obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.context.scene.render.threads_mode = 'FIXED'
bpy.context.scene.render.threads = 6
bpy.ops.wm.save_as_mainfile(filepath=str(P / 'harrow.blend'))
bpy.ops.export_scene.gltf(filepath=str(P / 'harrow.glb'), export_format='GLB',
    use_selection=True, export_yup=True, export_animations=True,
    export_animation_mode='NLA_TRACKS', export_force_sampling=True,
    export_frame_range=False, export_cameras=False, export_lights=False, export_extras=True)
(P / 'build-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('HARROW_V13_DONE', list(report['durations']))

