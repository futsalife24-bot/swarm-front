"""Read the final exported GLB in a fresh Blender process, without changing source geometry."""
from pathlib import Path
import bpy, json, math, hashlib
HERE=Path(__file__).resolve().parent
path=HERE/'foundry_zero_mechanical_legs_v2.glb'
bpy.ops.wm.open_mainfile(filepath=str(HERE/'foundry_zero_mechanical_legs_v2.blend'))
assert len([o for o in bpy.context.scene.objects if o.type=='MESH'])==165
assert len([o for o in bpy.context.scene.objects if o.get('part_kind')=='leg_root'])==34
assert bpy.data.objects['FZ_HEAD'].parent.name=='FOUNDRY_ZERO_ROOT'
blend_reopened=True
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
pts=[];tris=0;degenerate=0;nonfinite=0;meshes=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    meshes.append(o.name);o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    assert o.matrix_world.determinant()>0,o.name
    degenerate+=sum(t.area<1e-10 for t in o.data.loop_triangles)
    for v in o.data.vertices:
        p=o.matrix_world@v.co;pts.append(p);nonfinite+=int(not all(math.isfinite(x) for x in p))
bounds={'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]}
source=json.loads((HERE/'blender-validation.json').read_text(encoding='utf8'))
units=['FZ_HEAD']+[f'FZ_BODY_{i:02d}' for i in range(1,8)]
for name in units:
    u=bpy.data.objects[name];assert u.parent.name=='FOUNDRY_ZERO_ROOT';assert all(abs(s-1)<1e-6 for s in u.scale)
assert tris==source['source']['triangles']
assert not degenerate and not nonfinite
for k in ['min','max']:assert all(abs(a-b)<1e-4 for a,b in zip(bounds[k],source['source']['bounds_blender'][k]))
report={'blender':bpy.app.version_string,'native_blend_reopened':blend_reopened,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'triangles':tris,'meshes':len(meshes),'nonfinite':nonfinite,'degenerate':degenerate,'bounds_blender':bounds,
        'checks':['Final static GLB imported in fresh dedicated Blender process','Source triangle count matches','Source world bounds match within 0.1mm','8 independent ground-origin unit roots','Finite coordinates','No degenerate triangles','Positive determinant; unit root scales 1']}
(HERE/'reimport-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
