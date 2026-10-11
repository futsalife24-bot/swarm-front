"""Sample exported trial Blend's evaluated wing and hind-leg vertices."""
import json
import math
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / "trial.blend"))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE" and len(o.pose.bones) == 39)
for track in rig.animation_data.nla_tracks:
    track.mute = True
trial = json.loads((HERE / "trial-result.json").read_text())
action_names = trial["animation"]["actions"]
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == rig]
selected = [o for o in meshes if o.name.startswith(("Wing", "Hindlimb"))]
fps = bpy.context.scene.render.fps
report = {"fps": fps, "objects": [o.name for o in selected], "clips": {}}
for clip in ("Idle", "Locomotion", "Attack", "Threat", "AirThreat", "Spin", "Takeoff", "Flight", "Glide", "Dive", "StaggerFall", "Land"):
    action = bpy.data.actions[action_names[clip]]
    rig.animation_data.action = action
    duration = {"Idle": 7, "Locomotion": 4.2, "Attack": 5.25,
                "Threat": 7, "AirThreat": 7, "Spin": 3, "Takeoff": 3.5,
                "Flight": 16.8, "Glide": 2.1, "Dive": 0.9,
                "StaggerFall": 2.625, "Land": 1.75}[clip]
    times = sorted({min(duration, i * 0.2)
                    for i in range(math.ceil(duration / 0.2) + 1)} | {duration})
    if clip == "Spin":
        times = sorted(set(times + [1.15, 1.675, 2.2]))
    worst = {"wing_min_z": [math.inf, None],
             "wing_ground_radius": [math.inf, None],
             "hind_min_z": [math.inf, None],
             "ground_wing_min_z": [math.inf, None],
             "ground_hind_min_z": [math.inf, None]}
    for t in times:
        grounded = (clip in ("Idle", "Locomotion", "Attack", "Threat", "Spin")
                    or clip == "Takeoff" and t < 0.2 * duration
                    or clip == "StaggerFall" and t >= 0.9 * duration
                    or clip == "Land")
        frame = t * fps
        bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for obj in selected:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
            mesh.vertices.foreach_get("co", coords)
            points = coords.reshape(-1, 3)
            transform = np.asarray(obj.matrix_world, dtype=np.float64)
            points = points @ transform[:3, :3].T + transform[:3, 3]
            evaluated.to_mesh_clear()
            if obj.name.startswith("Wing"):
                low = float(points[:, 2].min())
                if low < worst["wing_min_z"][0]:
                    worst["wing_min_z"] = [low, t, obj.name]
                if grounded and low < worst["ground_wing_min_z"][0]:
                    worst["ground_wing_min_z"] = [low, t, obj.name]
                if clip == "Spin" and 1.15 <= t <= 2.2:
                    near = points[points[:, 2] * 1.95 < 2]
                    radius = (float(np.linalg.norm(near[:, :2], axis=1).max())
                              if len(near) else 0.0)
                    if radius < worst["wing_ground_radius"][0]:
                        worst["wing_ground_radius"] = [radius, t, obj.name]
            else:
                low = float(points[:, 2].min())
                if low < worst["hind_min_z"][0]:
                    worst["hind_min_z"] = [low, t, obj.name]
                if grounded and low < worst["ground_hind_min_z"][0]:
                    worst["ground_hind_min_z"] = [low, t, obj.name]
    report["clips"][clip] = worst
rig.animation_data.action = None
(HERE / "actual-mesh-check.json").write_text(json.dumps(report, indent=2))
print("ACTUAL_MESH_CHECK", len(report["clips"]))
