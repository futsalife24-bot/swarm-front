"""Surface-overlap probe from Three.js world geometry, without GLB bone import.

Requires scripts/probe-soldier-switch-geometry.mjs output. Three authored poses
only: no gameplay blending, no solid-containment guarantee, no acceptance claim.
Offsets are diagnostic trials, not changes to the model or mounting positions.
"""
import json
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
p=Path(__file__).resolve().parent
data=json.loads((p/'switch-runtime-geometry.json').read_text())
def matrix(values):return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
idleChest=matrix(data['poses'][0]['sockets']['Chest'])
backLocal=idleChest.to_3x3().inverted()@Vector((0,0,1))
rows=[]
for pose in data['poses']:
 trees=[(mesh['name'],BVHTree.FromPolygons(mesh['vertices'],mesh['triangles'],all_triangles=True)) for mesh in pose['body']]
 for socket in ['BackWeaponSocket','BackWeaponSocket_2']:
  for depth in [0,.04,.08,.12,.16,.20,.24]:
   frame=matrix(pose['sockets'][socket]);frame.translation+=matrix(pose['sockets']['Chest']).to_3x3()@backLocal*depth
   for kind,meshes in data['weapons'].items():
    counts={name:0 for name,_ in trees}
    for mesh in meshes:
     weapon=BVHTree.FromPolygons([frame@Vector(v) for v in mesh['vertices']],mesh['triangles'],all_triangles=True)
     for name,tree in trees:counts[name]+=len(weapon.overlap(tree))
    rows.append({'action':pose['name'],'fraction':pose['fraction'],'socket':socket,'weapon':kind,'additionalBackDepthMetres':depth,'surfaceTrianglePairs':counts})
result={'scope':__doc__,'sha256':data['sha256'],'samples':rows}
(p/'back-body-runtime-check.json').write_text(json.dumps(result,indent=2))
for depth in [0,.04,.08,.12,.16,.20,.24]:
 group=[r for r in rows if r['additionalBackDepthMetres']==depth]
 print(depth,'intersecting cases',sum(any(r['surfaceTrianglePairs'].values()) for r in group),'/',len(group),flush=True)
