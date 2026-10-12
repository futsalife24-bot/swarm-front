"""Measure support-claw world drift before the expensive GLB bake."""
import json
import math
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
samples = {side: {} for side in ('.L', '.R')}
for frame in range(85):
    t = frame * 0.05
    motion._pose(rig, metadata, cache, 'Locomotion', t)
    bpy.context.view_layer.update()
    for side, phase in (('.L', 0.0), ('.R', 0.5)):
        cycle = t * motion.WALK_STEPS_PER_CLIP / motion.DURATIONS['Locomotion'] + phase
        if cycle % 1 >= 0.72:
            continue
        group = math.floor(cycle)
        point = motion._point_now(rig, metadata['ground_contacts'][side])
        world = (point.y * motion.GAME_SCALE,
                 -point.x * motion.GAME_SCALE + 0.64 * t,
                 point.z * motion.GAME_SCALE)
        samples[side].setdefault(group, []).append((t, world))
rows = []
for side, groups in samples.items():
    for group, points in groups.items():
        first = points[0][1]
        drift = max(math.hypot(world[0] - first[0], world[1] - first[1])
                    for _, world in points)
        rows.append({'side': side, 'cycle': group,
                     'begin': points[0][0], 'end': points[-1][0],
                     'drift_m': drift})
report = {'method': '20Hz rigid planted claw, +0.64m/s authority motion',
          'max_drift_m': max(row['drift_m'] for row in rows), 'rows': rows}
(p / 'review' / 'source-gait.json').write_text(
    json.dumps(report, indent=2), encoding='utf-8')
print('SOURCE_GAIT', round(report['max_drift_m'], 6), flush=True)
