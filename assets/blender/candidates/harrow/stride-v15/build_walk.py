"""Replace only the walking action in an isolated copy of the v14 rig."""
import json
import sys
from pathlib import Path

import bpy

here = Path(__file__).resolve().parent
v14 = here.parent / "biped-v14"
args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
spread_toes = "--v17" in args[1:]
long_stride = spread_toes or "--v16" in args[1:]
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(v14))
import animation_contract as motion

bpy.ops.wm.open_mainfile(filepath=str(v14 / "harrow.blend"))
rig = bpy.data.objects["HARROW"]
original = [(track.name, track.strips[0].action)
            for track in rig.animation_data.nla_tracks]
rig.animation_data_clear()
replace_clips = {"Locomotion", "Idle"} if spread_toes else {"Locomotion"}
old_actions = {name: bpy.data.actions[name] for name in sorted(replace_clips)}
for name, action in old_actions.items():
    action.name = "Previous " + name
metadata = json.loads((here.parent / "charakuru-20261011" /
                       "rig-metadata.json").read_text(encoding="utf-8-sig"))
motion.WALK_STEPS_PER_CLIP = 1
motion.WALK_LIFT = 1.05
# Lower the hips at full extension so the planted claw stays within leg reach.
motion.WALK_MID_DROP = 1.45 if long_stride else 0.35
if long_stride:
    motion.WALK_SPEED = 1.92 / motion.GAME_SCALE
    motion.WALK_SMOOTH_FOOTFALL = True
if spread_toes:
    motion.WALK_PALM_DROP = 1.55
motion.animate(rig, metadata, clips=replace_clips)
updated = {name: rig.animation_data.nla_tracks[name].strips[0].action
           for name in replace_clips}
rig.animation_data_clear()
rig.animation_data_create()
if spread_toes:
    sys.path.insert(0, str(here.parent / "footfall-v17"))
    from plant_toes import animate_toes
    animate_toes(rig, updated["Locomotion"], updated["Idle"], motion.FPS,
                 motion.DURATIONS["Locomotion"],
                 motion.WALK_PALM_DROP, motion.walking_toe_spread)
for name, action in original:
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, updated.get(name, action))
    track.mute = True
for old in old_actions.values():
    bpy.data.actions.remove(old)
bpy.context.scene.frame_set(0)
bpy.context.preferences.filepaths.save_version = 0
if not spread_toes:
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "harrow-stride.blend"))
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in bpy.data.objects:
    if obj.type == "MESH" and any(m.type == "ARMATURE" and m.object == rig
                                  for m in obj.modifiers):
        obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(out / "harrow-stride.glb"),
    export_format="GLB", use_selection=True, export_yup=True,
    export_animations=True, export_animation_mode="NLA_TRACKS",
    export_force_sampling=True, export_frame_range=False,
    export_cameras=False, export_lights=False, export_extras=True)

if spread_toes:
    # Open the deliverable on its editable walk, after exporting all NLA clips.
    rig.animation_data.action = updated["Locomotion"]
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = round(updated["Locomotion"].frame_range[1])
    bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "harrow-stride.blend"))
