"""Inspect every pose-bone matrix at key source-clip boundaries before baking."""
import json
import sys
from pathlib import Path

import bpy

p = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(p))
import animation_contract as motion

source = p.parent / 'charakuru-20261011'
bpy.ops.wm.open_mainfile(filepath=str(source / 'harrow.blend'))
rig = bpy.data.objects['HARROW']
metadata = json.loads((source / 'rig-metadata.json').read_text(encoding='utf-8-sig'))
cache = motion._wing_cache(rig, metadata)
motion._pose(rig, metadata, cache, 'Spin', 1.675)
metadata['_spin_wing_reference'] = {
    side: {part: rig.pose.bones['Wing ' + part + side].rotation_quaternion.copy()
           for part in ('upper', 'fore')}
    for side in ('.L', '.R')
}

def snapshot(clip, t):
    motion._pose(rig, metadata, cache, clip, t)
    bpy.context.view_layer.update()
    return {bone.name: tuple(v for row in bone.matrix for v in row)
            for bone in rig.pose.bones}

pairs = [('Idle', 0, 'Locomotion', 0),
         ('Locomotion', 4.2, 'Idle', 0),
         ('Locomotion', 4.2, 'Locomotion', 0),
         ('Idle', 0, 'Spin', 0), ('Spin', 3, 'Idle', 0),
         ('Idle', 0, 'Takeoff', 0), ('Takeoff', 3.5, 'Flight', 0),
         ('Flight', 16.8, 'Glide', 0), ('Glide', 2.1, 'Dive', 0),
         ('Dive', 0.9, 'Land', 0), ('StaggerFall', 2.625, 'Land', 0),
         ('Land', 1.75, 'Idle', 0)]
rows = []
for left, lt, right, rt in pairs:
    a, b = snapshot(left, lt), snapshot(right, rt)
    differences = [(max(abs(x - y) for x, y in zip(a[name], b[name])), name)
                   for name in a]
    value, bone = max(differences)
    rows.append({'from': left, 'to': right, 'maximum_matrix_component_difference': value,
                 'bone': bone})
    print('BOUNDARY', left, right, bone, round(value, 9), flush=True)
    if value >= 1e-5:
        raise ValueError(f'{left}->{right} matrix mismatch {bone}: {value}')
(p / 'review' / 'source-boundaries.json').write_text(
    json.dumps({'limit': 1e-5, 'pairs': rows}, indent=2), encoding='utf-8')
