"""Replace only the walking action in an isolated copy of the v14 rig."""
import json
import sys
from pathlib import Path

import bpy

here = Path(__file__).resolve().parent
v14 = here.parent / "biped-v14"
args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
long_stride = "--v16" in args[1:]
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(v14))
import animation_contract as motion

bpy.ops.wm.open_mainfile(filepath=str(v14 / "harrow.blend"))
rig = bpy.data.objects["HARROW"]
original = [(track.name, track.strips[0].action)
            for track in rig.animation_data.nla_tracks]
rig.animation_data_clear()
old_walk = bpy.data.actions["Locomotion"]
old_walk.name = "Previous locomotion"
metadata = json.loads((here.parent / "charakuru-20261011" /
                       "rig-metadata.json").read_text(encoding="utf-8-sig"))
motion.WALK_STEPS_PER_CLIP = 1
motion.WALK_LIFT = 1.05
# Lower the hips at full extension so the planted claw stays within leg reach.
motion.WALK_MID_DROP = 1.45 if long_stride else 0.35
if long_stride:
    motion.WALK_SPEED = 1.92 / motion.GAME_SCALE
    motion.WALK_SMOOTH_FOOTFALL = True
motion.animate(rig, metadata, clips={"Locomotion"})
walk = rig.animation_data.nla_tracks["Locomotion"].strips[0].action
rig.animation_data_clear()
rig.animation_data_create()
for name, action in original:
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, walk if name == "Locomotion" else action)
    track.mute = True
bpy.data.actions.remove(old_walk)
bpy.context.scene.frame_set(0)
bpy.context.preferences.filepaths.save_version = 0
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
