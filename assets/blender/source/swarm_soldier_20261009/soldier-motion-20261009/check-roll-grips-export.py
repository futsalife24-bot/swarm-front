"""Validate additive profile rolls without accepting changes to existing content."""
import hashlib, json, struct
from pathlib import Path

p = Path(__file__).resolve().parent
def read(path):
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    binary = raw[28+size:]
    def accessor(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        n = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        fmt = {5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']]
        width = struct.calcsize(fmt)*n
        offset = v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*n,binary,offset+i*v.get('byteStride',width)) for i in range(a['count'])]
    animations = {}
    for animation in doc['animations']:
        tracks = {}
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            target = channel['target']
            key = (doc['nodes'][target['node']]['name'],target['path'])
            tracks[key] = (sampler.get('interpolation','LINEAR'),accessor(sampler['input']),accessor(sampler['output']))
        animations[animation['name']] = tracks
    geometry = []
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            geometry.append(accessor(primitive['indices']))
            geometry.extend(accessor(i) for _,i in sorted(primitive['attributes'].items()))
    geometry.extend(accessor(s['inverseBindMatrices']) for s in doc['skins'])
    return doc, animations, geometry, hashlib.sha256(raw).hexdigest()

old, before, geometry, sha = read(p/'swarm-soldier.glb')
new, after, newgeometry, newsha = read(p/'roll-grips-preview/swarm-soldier.glb')
added = {'Trial_Dodge_Roll_Shotgun','Trial_Dodge_Roll_Rocket'}
errors = []
if set(after) != set(before)|added: errors.append('Unexpected clip set')
for name, tracks in before.items():
    if after.get(name) != tracks: errors.append('Existing clip changed: '+name)
if old['nodes'] != new['nodes']: errors.append('Rest nodes changed')
if geometry != newgeometry: errors.append('Geometry or bind matrices changed')
allowed = {'UpperArm_'+s for s in ['R','L']} | {'LowerArm_'+s for s in ['R','L']} | {'Hand_'+s for s in ['R','L']} | {'RightHandWeaponSocket'}
allowed |= {f+str(i)+'_'+s for f in ['Thumb','Index','Middle','Ring','Little'] for i in [1,2,3] for s in ['R','L']}
base = before['Trial_Dodge_Roll']
for name in sorted(added):
    tracks = after.get(name,{})
    if tracks.keys() != base.keys(): errors.append('Track set changed: '+name)
    for key, values in tracks.items():
        reference = base.get(key)
        # glTF folds constant tracks to two endpoints; changed fingers may gain
        # or lose this optimization. Require equal extent, not identical key count.
        constant = lambda track: max(abs(a-b) for row in track[2] for a,b in zip(row,track[2][0])) <= 1e-6
        interpolation_ok = reference and (values[0] == reference[0] or (key[0] in allowed and constant(values) and constant(reference)))
        if not reference or not interpolation_ok or values[1][0] != reference[1][0] or values[1][-1] != reference[1][-1]: errors.append('Timing changed: '+str((name,key)))
        if key[0] not in allowed and values != reference:
            # This non-deforming child of the changed left wrist exhibits only
            # matrix decomposition roundoff. All body/back tracks remain exact.
            delta = max(abs(a-b) for x,y in zip(values[2],reference[2]) for a,b in zip(x,y)) if values[:2] == reference[:2] else float('inf')
            if key[0] != 'LeftHandSupportSocket' or delta > 1e-6: errors.append('Non-arm track changed: '+str((name,key)))
report = {'baselineSha256':sha,'candidateSha256':newsha,'originalClips':len(before),'candidateClips':len(after),'errors':errors,'scope':'Exact original clips, rest nodes, geometry and skin binds; new clips limited to arm/finger/socket channels with equal time extents. Constant-track interpolation and left support socket decomposition allow at most 1e-6 component roundoff. Socket world trajectory and contact require runtime checks.'}
(p/'roll-grips-export-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if errors: raise SystemExit(1)
