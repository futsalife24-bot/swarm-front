import bpy,json,itertools,math,hashlib
from pathlib import Path
from mathutils import Vector,kdtree
r=Path(__file__).resolve().parent;b=r.parent
def read(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(path))
    else:bpy.ops.import_scene.gltf(filepath=str(path))
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];pts=[];faces=[];counts=[]
    for o in obs:
        off=len(pts);pts.extend(o.matrix_world@v.co for v in o.data.vertices)
        o.data.calc_loop_triangles();faces.extend(tuple(off+i for i in f.vertices) for f in o.data.loop_triangles)
        counts.append({'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'triangles':len(o.data.loop_triangles)})
    return pts,faces,{'file':str(path.relative_to(b)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'meshes':len(obs),'vertices':len(pts),'polygons':sum(x['polygons'] for x in counts),'triangles':len(faces),'bounds_min':[min(p[i] for p in pts) for i in range(3)],'bounds_max':[max(p[i] for p in pts) for i in range(3)],'objects':counts}
paths=[b/'models/segmentation-input/head.glb',b/'models/segmented/head.fbx',b/'models/textured/head/head.fbx.fbx']
sets=[read(p) for p in paths]
def compare(a,z):
    src,fs,_=a;dst,fd,_=z
    ca=sum(src,Vector())/len(src);cz=sum(dst,Vector())/len(dst)
    # Bounds center avoids changes in duplicated vertex weighting after splitting.
    ca=Vector(tuple((min(p[i] for p in src)+max(p[i] for p in src))/2 for i in range(3)))
    cz=Vector(tuple((min(p[i] for p in dst)+max(p[i] for p in dst))/2 for i in range(3)))
    sa=max(max(p[i] for p in src)-min(p[i] for p in src) for i in range(3));sz=max(max(p[i] for p in dst)-min(p[i] for p in dst) for i in range(3));scale=sa/sz
    tree=kdtree.KDTree(len(src))
    for i,p in enumerate(src):tree.insert(p,i)
    tree.balance();best=None
    sample=dst[::max(1,len(dst)//1500)]
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product((-1,1),repeat=3):
            def transform(p):return Vector(tuple((p[perm[j]]-cz[perm[j]])*signs[j]*scale+ca[j] for j in range(3)))
            mse=sum(tree.find(transform(p))[2]**2 for p in sample)/len(sample)
            if best is None or mse<best[0]:best=(mse,perm,signs)
    _,perm,signs=best
    aligned=[Vector(tuple((p[perm[j]]-cz[perm[j]])*signs[j]*scale+ca[j] for j in range(3))) for p in dst]
    distances=[tree.find(p)[2] for p in aligned]
    reverse=kdtree.KDTree(len(aligned))
    for i,p in enumerate(aligned):reverse.insert(p,i)
    reverse.balance();rev=[reverse.find(p)[2] for p in src]
    def summary(v):
        s=sorted(v);return {'max':max(v),'rms':math.sqrt(sum(d*d for d in v)/len(v)),'median':s[len(s)//2],'p99':s[int(len(s)*.99)],'above_1e-5':sum(d>1e-5 for d in v)}
    # Compare triangle geometry ignoring winding and vertex duplication.
    from collections import Counter
    def key(p):return tuple(round(v,5) for v in p)
    def triangles(points,faces):return Counter(tuple(sorted(key(points[i]) for i in f)) for f in faces)
    ta=triangles(src,fs);tz=triangles(aligned,fd)
    snapped=[src[tree.find(p)[1]] for p in aligned];ts=triangles(snapped,fd)
    return {'axis_permutation_destination_to_source':perm,'axis_signs':signs,'scale':scale,'source_center':list(ca),'destination_center':list(cz),'destination_to_source_distance':summary(distances),'source_to_destination_distance':summary(rev),'source_unique_positions_1e-5':len(set(map(key,src))),'destination_unique_positions_1e-5':len(set(map(key,aligned))),'identical_triangle_occurrences_1e-5':sum((ta&tz).values()),'source_triangle_occurrences':len(fs),'destination_triangle_occurrences':len(fd),'source_only_triangle_occurrences':sum((ta-tz).values()),'destination_only_triangle_occurrences':sum((tz-ta).values()),'nearest_vertex_snapped_identical_triangles':sum((ta&ts).values()),'nearest_vertex_snapped_source_only_triangles':sum((ta-ts).values()),'nearest_vertex_snapped_destination_only_triangles':sum((ts-ta).values()),'nearest_vertex_snapped_unique_positions':len(set(map(key,snapped)))}
out={'files':[s[2] for s in sets],'comparisons':{'segmented_vs_textured':compare(sets[1],sets[2]),'canonical_vs_segmented':compare(sets[0],sets[1]),'canonical_vs_textured':compare(sets[0],sets[2])}}
(r/'texture-return-head-comparison.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out['comparisons'],indent=2))
