"""回避の時間変換と、GLBの主要ボーンのキーフレームを読む隔離調査。"""
import bisect
import json
import math
import re
import struct
from pathlib import Path

root = Path('.')
defs = (root / 'src/shared/defs.ts').read_text(encoding='utf8')
trooper = (root / 'src/client/standard-trooper.ts').read_text(encoding='utf8')
duration = float(re.search(r'export const EVADE_DURATION = ([0-9.]+)', defs).group(1))
end = float(re.search(r'const SOLDIER_ROLL_ROTATION_END = ([0-9.]+)', trooper).group(1))
glb = (root / 'public/assets/characters/swarm-soldier.glb').read_bytes()
assert glb[:4] == b'glTF' and struct.unpack_from('<I', glb, 4)[0] == 2
n = struct.unpack_from('<I', glb, 12)[0]
gltf = json.loads(glb[20:20+n])
blob = glb[20+n+8:]
animation = next(a for a in gltf['animations'] if a['name'] == 'Trial_Dodge_Roll')


def accessor(index):
    a = gltf['accessors'][index]
    view = gltf['bufferViews'][a['bufferView']]
    count = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    assert a['componentType'] == 5126
    size = 4 * count
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', size)
    return [struct.unpack_from('<' + 'f' * count, blob, start + i * stride) for i in range(a['count'])]


def sample(sampler, time, path):
    times = [t[0] for t in accessor(sampler['input'])]
    values = accessor(sampler['output'])
    i = max(0, min(len(times) - 2, bisect.bisect_right(times, time) - 1))
    a, b = values[i], values[i + 1]
    interpolation = sampler.get('interpolation', 'LINEAR')
    assert interpolation in ('LINEAR', 'STEP')
    f = 0 if interpolation == 'STEP' else (time - times[i]) / (times[i+1] - times[i])
    if path == 'rotation' and interpolation == 'LINEAR':
        dot = sum(x*y for x, y in zip(a, b))
        if dot < 0:
            b, dot = tuple(-x for x in b), -dot
        dot = max(-1, min(1, dot))
        theta = math.acos(dot)
        if theta > 1e-6:
            return [(math.sin((1-f)*theta)*x + math.sin(f*theta)*y)/math.sin(theta) for x, y in zip(a, b)]
    return [x + f * (y-x) for x, y in zip(a, b)]


times = [.15, 1/6]
clip_times = [t / duration * end for t in times]
channels = []
names = {'Root', 'Pelvis', 'Spine', 'Chest', 'BackWeaponSocket', 'BackWeaponSocket_2'}
for channel in animation['channels']:
    target = channel['target']
    name = gltf['nodes'][target['node']].get('name')
    if name not in names or target['path'] not in ('translation', 'rotation'):
        continue
    sampler = animation['samplers'][channel['sampler']]
    values = [sample(sampler, t, target['path']) for t in clip_times]
    channels.append({'bone': name, 'path': target['path'], 'interpolation': sampler.get('interpolation', 'LINEAR'), 'values': values})
out = {'scope': 'Local GLB clip keys; no movement, transition blending, ground collision, actual game controls or device.',
       'duration': duration, 'clipEnd': end, 'speedRatio': end/duration,
       'runtimeTimes': times, 'clipTimes': clip_times, 'channels': channels}
path = root / 'dist-validation/floor-body-probe/clip-report.json'
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({k: out[k] for k in ('duration', 'clipEnd', 'speedRatio', 'runtimeTimes', 'clipTimes')}, ensure_ascii=False))
for row in channels:
    if row['bone'] in ('Pelvis', 'BackWeaponSocket', 'BackWeaponSocket_2'):
        print(row['bone'], row['path'], row['interpolation'], row['values'])
