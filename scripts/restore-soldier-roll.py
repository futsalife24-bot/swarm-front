"""Restore only three authored roll clips, retaining the current rig/back mounts.

Rebuild base: swarm-soldier.glb from commit c529694 (SHA below).
The original Blender authoring source and exported roll bank are tracked under
assets/blender/source/swarm_soldier_20261009/soldier-motion-20261009.
"""
import argparse, copy, hashlib, json, struct
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='public/assets/characters/swarm-soldier.glb')
parser.add_argument('--output', default='test-results/soldier-roll/swarm-soldier.glb')
args = parser.parse_args()

def read(path):
    raw = Path(path).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    start = 20+length
    size, kind = struct.unpack_from('<II', raw, start)
    assert kind == 0x004e4942
    return raw, doc, bytearray(raw[start+8:start+8+size])

raw, doc, binary = read(args.base)
assert hashlib.sha256(raw).hexdigest() == 'bea4886cd676e602816df15de52424dc953279d0b463de61ba9860c3bfef280e'
bank_path = Path('assets/blender/source/swarm_soldier_20261009/soldier-motion-20261009/roll-grips-preview/swarm-soldier.glb')
bank_raw, bank, bank_binary = read(bank_path)
assert hashlib.sha256(bank_raw).hexdigest() == '0940595f3105edf94b9f86cc392e8352fa1fe1bac5fe903303713b8ea0fc2738'
original = copy.deepcopy(doc)
nodes = {node['name']: i for i, node in enumerate(doc['nodes'])}
accessors, views = {}, {}

def copy_accessor(index):
    if index in accessors:
        return accessors[index]
    accessor = copy.deepcopy(bank['accessors'][index])
    assert 'sparse' not in accessor
    view_index = accessor['bufferView']
    if view_index not in views:
        view = copy.deepcopy(bank['bufferViews'][view_index])
        assert view.get('buffer', 0) == 0
        start = view.get('byteOffset', 0)
        binary.extend(b'\0' * (-len(binary) % 4))
        view['byteOffset'] = len(binary)
        binary.extend(bank_binary[start:start+view['byteLength']])
        views[view_index] = len(doc['bufferViews'])
        doc['bufferViews'].append(view)
    accessor['bufferView'] = views[view_index]
    accessors[index] = len(doc['accessors'])
    doc['accessors'].append(accessor)
    return accessors[index]

rolls = {'Trial_Dodge_Roll', 'Trial_Dodge_Roll_Shotgun', 'Trial_Dodge_Roll_Rocket'}
back_mounts = {'BackWeaponSocket', 'BackWeaponSocket_2'}
bank_clips = {clip['name']: clip for clip in bank['animations']}
replaced = []
for index, current in enumerate(doc['animations']):
    if current['name'] not in rolls:
        continue
    source = bank_clips[current['name']]
    clip = {'name': current['name'], 'channels': [], 'samplers': []}
    # Keep the current constant back-socket local transforms from the final rig.
    for channel in current['channels']:
        if doc['nodes'][channel['target']['node']]['name'] in back_mounts:
            channel = copy.deepcopy(channel)
            sampler = copy.deepcopy(current['samplers'][channel['sampler']])
            channel['sampler'] = len(clip['samplers'])
            clip['channels'].append(channel)
            clip['samplers'].append(sampler)
    for channel in source['channels']:
        name = bank['nodes'][channel['target']['node']]['name']
        if name in back_mounts:
            continue
        channel = copy.deepcopy(channel)
        sampler = copy.deepcopy(source['samplers'][channel['sampler']])
        sampler['input'] = copy_accessor(sampler['input'])
        sampler['output'] = copy_accessor(sampler['output'])
        channel['target']['node'] = nodes[name]
        channel['sampler'] = len(clip['samplers'])
        clip['channels'].append(channel)
        clip['samplers'].append(sampler)
    assert len(clip['channels']) == len(current['channels'])
    doc['animations'][index] = clip
    replaced.append(clip['name'])

assert set(replaced) == rolls
for old, new in zip(original['animations'], doc['animations']):
    if old['name'] not in rolls:
        assert old == new
for key in ['nodes', 'skins', 'meshes', 'materials', 'textures', 'images', 'scenes']:
    assert original[key] == doc[key]
assert binary[:len(raw)-28-struct.unpack_from('<I', raw, 12)[0]] == read(args.base)[2]
doc['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary.extend(b'\0' * (-len(binary) % 4))
result = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(binary))
result += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
result += struct.pack('<II', len(binary), 0x004e4942) + binary
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(result)
report = {'sha256': hashlib.sha256(result).hexdigest(), 'replacedClips': replaced,
          'unchangedClips': len(doc['animations'])-3, 'rigMeshMaterialsUnchanged': True,
          'currentBackMountsPreserved': True, 'gameplayTimingChanged': False}
output.with_suffix('.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
