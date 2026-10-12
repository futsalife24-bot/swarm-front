"""Measure the v13 tip displacement from each candidate shoulder axis."""
import bpy
import importlib.util
import json
from pathlib import Path
from mathutils import Quaternion, Vector

P = Path(__file__).resolve().parents[1]
SOURCE = P.parent / 'charakuru-20261011'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'harrow.blend'))
spec = importlib.util.spec_from_file_location(
    'harrow_v13_motion', P.parent / 'biped-v13' / 'animation_contract.py')
motion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(motion)
rig = bpy.data.objects['HARROW']
metadata = json.loads((SOURCE / 'rig-metadata.json').read_text(encoding='utf-8-sig'))
cache = motion._wing_cache(rig, metadata)
motion._pose(rig, metadata, cache, 'Spin', 1.675)
metadata['_spin_wing_reference'] = {
    side: {part: rig.pose.bones['Wing ' + part + side].rotation_quaternion.copy()
           for part in ('upper', 'fore')}
    for side in ('.L', '.R')}

def point(side):
    bpy.context.view_layer.update()
    return motion._point_now(rig, metadata['wing_contacts'][side]).copy()

rows = []
for clip, time in [('Flight', 4.2), ('Takeoff', 1.5), ('TakeoffB', 1.5),
                   ('TakeoffC', 1.5), ('TakeoffD', 1.5)]:
    for side in ('.L', '.R'):
        motion._pose(rig, metadata, cache, clip, time)
        base = point(side)
        row = {'clip': clip, 'time': time, 'side': side,
               'base': list(base), 'axis_delta': {}}
        for axis in ('X', 'Y', 'Z'):
            motion._rotate(rig, 'Wing upper' + side, axis, 0.1)
            moved = point(side)
            row['axis_delta'][axis] = list(moved - base)
            motion._pose(rig, metadata, cache, clip, time)
        bone = rig.pose.bones['Wing upper' + side]
        bpy.context.view_layer.update()
        local_axis = bone.matrix.to_quaternion().inverted() @ Vector((1, 0, 0))
        bone.rotation_quaternion = bone.rotation_quaternion @ Quaternion(local_axis, 0.1)
        row['axis_delta']['ARMATURE_X'] = list(point(side) - base)
        motion._pose(rig, metadata, cache, clip, time)
        rows.append(row)
(P / 'review' / 'flap-axis-probe.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
for row in rows:
    print(row['clip'], row['side'], row['axis_delta'])
