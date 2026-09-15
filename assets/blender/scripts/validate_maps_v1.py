import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; reports=[]
def inspect():
    count=0;points=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
        assert all(abs(v-1)<1e-5 for v in o.scale)
        assert len(o.data.uv_layers)>0
        points.extend(o.matrix_world@v.co for v in o.data.vertices)
    assert all(math.isfinite(c) for p in points for c in p)
    return {'triangles':count,'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
for i in range(6):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/blender/source/maps/map_{i}_v1.blend'));source=inspect()
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/assets/maps/map_{i}_v1.glb'));export=inspect()
    assert source['triangles']==export['triangles']
    for k in ['min','max']:assert all(abs(a-b)<.001 for a,b in zip(source[k],export[k]))
    reports.append({'map':i,'source':source,'reimport':export,'passed':True})
(ROOT/'dist-validation/maps-blender/reimport.json').write_text(json.dumps(reports,indent=2));print('ALL_REIMPORT_CHECKS_PASS',flush=True)
