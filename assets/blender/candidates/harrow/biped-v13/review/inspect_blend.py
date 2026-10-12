"""Read-only audit of the saved HARROW source scene.

Run: blender -b harrow.blend --python review/inspect_blend.py -- review/blend-inspection.json
"""

import hashlib
import json
import pathlib
import sys

import bpy


def main():
    output = pathlib.Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    blend = pathlib.Path(bpy.data.filepath).resolve()
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    actions = sorted(bpy.data.actions, key=lambda action: action.name)
    nla = []
    for obj in bpy.data.objects:
        animation = obj.animation_data
        if animation:
            for track in animation.nla_tracks:
                for strip in track.strips:
                    nla.append({"object": obj.name, "track": track.name, "strip": strip.name,
                                "action": strip.action.name if strip.action else None,
                                "start": strip.frame_start, "end": strip.frame_end})
    images = []
    for image in bpy.data.images:
        images.append({
            "name": image.name,
            "width": image.size[0],
            "height": image.size[1],
            "packed": bool(image.packed_file or image.packed_files),
            "source": image.source,
        })
    report = {
        "source": str(blend),
        "source_sha256": hashlib.sha256(blend.read_bytes()).hexdigest(),
        "blender_version": bpy.app.version_string,
        "scene_frame_rate": bpy.context.scene.render.fps / bpy.context.scene.render.fps_base,
        "armatures": [{"name": obj.name, "bones": len(obj.data.bones),
                       "bone_names": [bone.name for bone in obj.data.bones]} for obj in armatures],
        "meshes": [{"name": obj.name, "vertices": len(obj.data.vertices),
                    "faces": len(obj.data.polygons),
                    "material_primitives": len({polygon.material_index for polygon in obj.data.polygons}),
                    "armature_modifiers": [modifier.object.name for modifier in obj.modifiers
                                           if modifier.type == "ARMATURE" and modifier.object],
                    "materials": [slot.material.name if slot.material else None for slot in obj.material_slots]}
                   for obj in meshes],
        "actions": [{"name": action.name, "frame_start": action.frame_range[0],
                     "frame_end": action.frame_range[1],
                     "duration_seconds": (action.frame_range[1] - action.frame_range[0]) /
                     (bpy.context.scene.render.fps / bpy.context.scene.render.fps_base)} for action in actions],
        "nla": nla,
        "images": images,
    }
    report["checks"] = {
        "one_39_bone_armature": len(armatures) == 1 and len(armatures[0].data.bones) == 39,
        "22_export_primitives": sum(len({polygon.material_index for polygon in obj.data.polygons})
                                     for obj in meshes) == 22,
        "all_meshes_skinned": all(any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
                                  for obj in meshes),
        "18_actions_or_nla": len({action.name for action in actions} |
                                  {strip["action"] for strip in nla if strip["action"]}) >= 18,
        "all_images_packed": all(image["packed"] for image in images),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"checks": report["checks"], "output": str(output)}))


if __name__ == "__main__":
    main()
