"""Find measured downstroke intervals before the expensive animation bake."""
import bpy
import importlib.util
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parents[1]
SOURCE = P.parent / 'charakuru-20261011'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'harrow.blend'))
spec = importlib.util.spec_from_file_location('harrow_v14_motion', P / 'animation_contract.py')
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

rows = []
for clip in ('Takeoff', 'TakeoffB', 'TakeoffC', 'TakeoffD', 'Flight'):
    duration = motion.DURATIONS[clip]
    # During flight the opening two seconds contain several independent wingbeats.
    end = min(duration, 2.5 if clip.startswith('Takeoff') else 3.0)
    for side in ('.L', '.R'):
        contact = metadata['wing_contacts'][side]
        outer = max(metadata['wing_samples'][side],
                    key=lambda item: abs(item['point'][1]))
        for name, item in (('claw', contact), ('outer', outer)):
            samples = []
            count = int(end / 0.05)
            for step in range(count + 1):
                t = step * 0.05
                motion._pose(rig, metadata, cache, clip, t)
                bpy.context.view_layer.update()
                tip = motion._point_now(rig, item)
                shoulder = rig.pose.bones['Wing upper' + side].head
                relative = tip - shoulder
                samples.append((t, tuple(relative)))
            down = []
            # A quarter-second pair captures the push, not its later recovery.
            for i in range(len(samples) - 5):
                j = i + 5
                a, b = samples[i], samples[j]
                d = [b[1][k] - a[1][k] for k in range(3)]
                horizontal = math.hypot(d[0], d[1])
                if d[2] < 0:
                    down.append(((-d[2]) / max(horizontal, 1e-6),
                                 -d[2], horizontal, a[0], b[0]))
            strong = max(down, key=lambda row: row[1], default=None)
            rows.append({'clip': clip, 'side': side, 'point': name,
                         'largest_downstroke': strong})
(P / 'review' / 'source-flap.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
for row in rows:
    print(row['clip'], row['side'], row['point'], row['largest_downstroke'])
