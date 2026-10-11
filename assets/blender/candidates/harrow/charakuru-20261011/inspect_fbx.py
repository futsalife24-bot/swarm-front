import bpy
import json
import sys
from pathlib import Path

source, report = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert meshes, 'FBX contains no mesh'
data = {'source': source, 'meshes': len(meshes),
        'vertices': sum(len(obj.data.vertices) for obj in meshes),
        'polygons': sum(len(obj.data.polygons) for obj in meshes)}
assert data['vertices'] > 0 and data['polygons'] > 0
Path(report).write_text(json.dumps(data, indent=2), encoding='utf-8')
print(json.dumps(data))
