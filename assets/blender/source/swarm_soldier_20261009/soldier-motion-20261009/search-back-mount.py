"""Bounded idle-pose mount search. Surface intersections only; not acceptance.

Retains weapon scale/orientation and searches chest-relative translations.
Results require roll/down floor checks, handoff reauthoring, and visual review.
"""
import json, math
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

p = Path(__file__).resolve().parent
data = json.loads((p / 'switch-runtime-geometry.json').read_text())
pose = data['poses'][0]
def matrix(values):
    return Matrix([values[i:i+4] for i in range(0, 16, 4)]).transposed()
trees = [BVHTree.FromPolygons(m['vertices'], m['triangles'], all_triangles=True) for m in pose['body']]
rows = []
for socket, sign in [('BackWeaponSocket', 1), ('BackWeaponSocket_2', -1)]:
    candidates = []
    for depth in [0, .04, .08, .12, .16]:
        for lateral in [0, .06, .12, .18]:
            for height in [0, .08, .16]:
                for lean in [-25, 0, 25]:
                    for flip in [0, 180]:
                        shift = Vector((sign * lateral, height, depth))
                        frame = matrix(pose['sockets'][socket])
                        rotation = Matrix.Rotation(math.radians(lean), 4, 'Z')
                        frame = rotation @ frame @ Matrix.Rotation(math.radians(flip), 4, 'Y')
                        frame.translation = matrix(pose['sockets'][socket]).translation + shift
                        counts = {}
                        for kind, meshes in data['weapons'].items():
                            count = 0
                            for mesh in meshes:
                                tree = BVHTree.FromPolygons([frame @ Vector(v) for v in mesh['vertices']], mesh['triangles'], all_triangles=True)
                                count += sum(len(tree.overlap(body)) for body in trees)
                            counts[kind] = count
                        candidates.append({'socket': socket, 'idleWorldShift': list(shift), 'leanDegrees': lean, 'flipDegrees': flip, 'pairs': counts, 'intersectingKinds': sum(v > 0 for v in counts.values()), 'distance': shift.length, 'idleWorldMatrix': [frame[r][c] for c in range(4) for r in range(4)]})
    candidates.sort(key=lambda r: (r['intersectingKinds'], sum(r['pairs'].values()), r['distance']))
    rows.extend(candidates)
    print(socket, json.dumps(candidates[:5]), flush=True)
(p / 'back-mount-search.json').write_text(json.dumps({'scope': __doc__, 'sha256': data['sha256'], 'candidates': rows}, indent=2))
