"""Transplant the authored Run action; keep original geometry, UVs and other clips.
Run after build_standard_trooper.py. The v1 authoring file is never written.
"""
from pathlib import Path
import bpy,json,shutil
repo=Path(__file__).resolve().parents[3]
source=repo/'assets/blender/source/standard_trooper_v2.blend'
candidate=repo/'dist-validation/trooper-run/run-authoring.blend'
shutil.copyfile(source,candidate)
bpy.ops.wm.open_mainfile(filepath=str(repo/'assets/blender/source/standard_trooper_v1.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
old=bpy.data.actions['Run']
with bpy.data.libraries.load(str(candidate),link=False) as (available,loaded):
 loaded.actions=['Run']
run=loaded.actions[0]
for track in rig.animation_data.nla_tracks:
 for strip in track.strips:
  if strip.action==old:
   strip.action=run
   strip.action_slot=run.slots[0]
bpy.data.actions.remove(old)
run.name='Run';run.use_fake_user=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis.identity()
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.name=='STANDARD_TROOPER' or o==rig or (o.type=='MESH' and o.parent==rig):o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(repo/'public/assets/characters/standard_trooper_v2.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False)
assert len(bpy.data.actions)==12
print('PRESERVED_SOURCE',json.dumps({'source':str(source),'changed_action':'Run','actions':len(bpy.data.actions)}))
