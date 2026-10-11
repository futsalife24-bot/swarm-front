"""Isolated HARROW animation smoke test; writes only under this directory."""
import json
import sys
import time
import traceback
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
CANDIDATE = HERE.parent.parent
sys.path.insert(0, str(CANDIDATE))
from animation_contract import animate

start = time.monotonic()
result = {"status": "started", "source": str(CANDIDATE / "harrow.blend")}
try:
    bpy.ops.wm.open_mainfile(filepath=str(CANDIDATE / "harrow.blend"))
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"
            and len(obj.pose.bones) == 39]
    if len(rigs) != 1:
        raise ValueError(f"expected one 39-bone rig, found {len(rigs)}")
    rig = rigs[0]
    rig.animation_data_clear()  # Test a fresh bake even if the candidate saved NLA.
    metadata = json.loads((CANDIDATE / "rig-metadata.json").read_text())
    result["animation"] = animate(rig, metadata)
    result["status"] = "baked"
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "trial.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.parent == rig:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(HERE / "trial.glb"), export_format="GLB",
        use_selection=True, export_yup=True, export_animations=True,
        export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_range=False, export_cameras=False, export_lights=False,
        export_extras=True,
    )
    result["status"] = "exported"
except Exception:
    result["status"] = "failed"
    result["traceback"] = traceback.format_exc()
finally:
    result["elapsed_seconds"] = round(time.monotonic() - start, 2)
    (HERE / "trial-result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("ANIMATION_TRIAL", result["status"], result["elapsed_seconds"])
if result["status"] != "exported":
    raise RuntimeError("Animation trial failed; see trial-result.json")
