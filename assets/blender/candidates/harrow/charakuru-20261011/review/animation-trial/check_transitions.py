"""Quantify local pose jumps at report/game clip connections."""
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
import animation_contract as motion

bpy.ops.wm.open_mainfile(filepath=str(HERE.parent.parent / "harrow.blend"))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE" and len(o.pose.bones) == 39)
metadata = json.loads((HERE.parent.parent / "rig-metadata.json").read_text())
cache = motion._wing_cache(rig, metadata)
transitions = [
    ("Spin", 3, "Idle", 0), ("Idle", .8, "Threat", 0),
    ("Threat", 7, "Idle", 0), ("Idle", .8, "Takeoff", 0),
    ("Takeoff", 3.5, "Flight", 0), ("Flight", 16.8, "AirThreat", 0),
    ("AirThreat", 7, "Glide", 0), ("Glide", 2.1, "Dive", 0),
    ("Dive", .9, "Land", 0), ("Land", 1.75, "Idle", 0),
    ("Flight", 16.8, "StaggerFall", 0),
    ("StaggerFall", 2.625, "Land", 0),
    ("Idle", 0, "Locomotion", 0), ("Locomotion", 4.2, "Idle", 0),
    ("Idle", 0, "Attack", 0), ("Attack", 5.25, "Idle", 0),
]

def snapshot(clip, time):
    motion._pose(rig, metadata, cache, clip, time)
    bpy.context.view_layer.update()
    return {
        bone.name: {
            "head": bone.head.copy(),
            "tail": bone.tail.copy(),
            "quat": bone.matrix.to_quaternion().copy(),
        }
        for bone in rig.pose.bones
    }

rows = []
for from_clip, from_time, to_clip, to_time in transitions:
    a = snapshot(from_clip, from_time)
    b = snapshot(to_clip, to_time)
    jumps = []
    for name in a:
        point_jump = max((a[name][key] - b[name][key]).length for key in ("head", "tail")) * motion.GAME_SCALE
        angle = math.degrees(a[name]["quat"].rotation_difference(b[name]["quat"]).angle)
        jumps.append((point_jump, angle, name))
    worst = max(jumps)
    rotations = max(jumps, key=lambda x: x[1])
    rows.append({"from": from_clip, "from_time": from_time,
                 "to": to_clip, "max_point_m": round(worst[0], 3),
                 "point_bone": worst[2], "max_angle_deg": round(rotations[1], 1),
                 "angle_bone": rotations[2]})
(HERE / "transition-check.json").write_text(json.dumps(rows, indent=2))
motion._pose(rig, metadata, cache, "Spin", 0)
bpy.context.view_layer.update()
torso_start = rig.pose.bones["Torso"].matrix.copy()
motion._pose(rig, metadata, cache, "Spin", 0.8)
bpy.context.view_layer.update()
torso_coil = rig.pose.bones["Torso"].matrix.copy()
torso_delta = max(abs(torso_start[row][col] - torso_coil[row][col])
                  for row in range(4) for col in range(4))
(HERE / "spin-torso-check.json").write_text(
    json.dumps({"matrix_max_delta_0_to_0_8": torso_delta}, indent=2))
assert torso_delta > 0.1, torso_delta
print("TRANSITIONS", len(rows))
