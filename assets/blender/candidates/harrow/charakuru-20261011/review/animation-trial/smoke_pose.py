"""Fast pose contract probe without writing actions or production assets."""
import json
import sys
import traceback
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
import animation_contract as motion

bpy.ops.wm.open_mainfile(filepath=str(HERE.parent.parent / "harrow.blend"))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE" and len(o.pose.bones) == 39)
metadata = json.loads((HERE.parent.parent / "rig-metadata.json").read_text())
cache = motion._wing_cache(rig, metadata)
result = []
for clip, duration in motion.DURATIONS.items():
    times = sorted({0.0, duration / 4, duration / 2,
                    3 * duration / 4, duration})
    if clip == "Spin":
        times = sorted(set(times + [1.15, 1.675, 2.20]))
    if clip in ("Threat", "AirThreat"):
        times = sorted(set(times + [3.5]))
    if clip == "Land":
        times = [i / motion.FPS for i in range(round(duration * motion.FPS) + 1)]
    if clip in ("StaggerFall", "Dive"):
        times = sorted(set(times + [i / motion.FPS for i in range(round(duration * motion.FPS * 0.9), round(duration * motion.FPS) + 1)]))
    for t in times:
        try:
            motion._pose(rig, metadata, cache, clip, t)
            result.append({"clip": clip, "time": t, "status": "ok"})
        except Exception:
            result.append({"clip": clip, "time": t, "status": "failed",
                           "traceback": traceback.format_exc()})
            break
(HERE / "pose-smoke.json").write_text(json.dumps(result, indent=2))
print("POSE_SMOKE", len(result), "samples", sum(x["status"] == "failed" for x in result), "failures")
