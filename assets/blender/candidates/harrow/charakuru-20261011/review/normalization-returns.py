import bpy,json,importlib.util,hashlib,math,sys
from pathlib import Path
from mathutils import Vector,kdtree
r=Path(__file__).resolve().parent;b=r.parent;out=b/'models/normalized-returns';out.mkdir(exist_ok=True)
kit=Path('C:/Users/futsa/Documents/Codex/2026-10-07/https-x-com-dstudio-ai-status/tools/charakuru-1.0.2/charakuru-1.0.2-2026-10-07T16-58-19-992Z')
spec=importlib.util.spec_from_file_location('original_production',kit/'scripts/production.py');prod=importlib.util.module_from_spec(spec);spec.loader.exec_module(prod)
base=b;p=json.loads((base/'production-baseline.json').read_text(encoding='utf-8-sig'));report=[]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def clear():bpy.ops.wm.read_factory_settings(use_empty=True)
def bbox(points):
    lo,hi=map(Vector,prod.bounds(points));return lo,hi,(lo+hi)/2
for group in p['production']['textureGroups']:
    kind=group['id'];clear()
    canonical=b/f'models/segmentation-input/{kind}.glb'
    bpy.ops.import_scene.gltf(filepath=str(canonical))
    cp=sorted({tuple(o.matrix_world@v.co) for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices})
    cp=list(map(Vector,cp));clo,chi,cc=bbox(cp);tree=kdtree.KDTree(len(cp))
    for i,v in enumerate(cp):tree.insert(v,i)
    tree.balance();clear()
    lookup=prod.inventory(p,base);orig=[lookup[c] for c in group['components']]
    returned_path=b/f'models/textured/{kind}/{kind}.fbx.fbx';ret=prod.imported(returned_path)
    files=[canonical,base/p['production']['inventory']['path'],returned_path,kit/'scripts/production.py']
    before={str(f):sha(f) for f in files}
    def mapping(objects):
        pts=[v.co for o in objects for v in o.data.vertices];lo,hi,c=bbox(pts);scale=max(chi-clo)/max(hi-lo)
        ids={};max_error=0;min_margin=float('inf')
        for o in objects:
            for v in o.data.vertices:
                q=(v.co-c)*scale+cc;nearest=sorted(tree.find_n(q,2),key=lambda x:x[2]);dist=nearest[0][2];margin=nearest[1][2]-dist
                assert dist<0.0001,(kind,dist)
                assert margin>1e-7,(kind,'ambiguous vertex',dist,margin)
                ids[o.name,v.index]=nearest[0][1];max_error=max(max_error,dist);min_margin=min(min_margin,margin)
        return ids,{'scale':scale,'center':list(c),'maxCanonicalDistance':max_error,'minNearestMargin':min_margin}
    oi,os=mapping(orig);ri,rs=mapping(ret)
    def face_map(objects,ids):
        result={}
        for o in objects:
            for f in o.data.polygons:
                ci=[ids[o.name,i] for i in f.vertices]
                assert len(ci)==3 and len(set(ci))==3,'Degenerate or non-triangle corner correspondence'
                key=tuple(sorted(ci));assert key not in result,'Ambiguous coincident triangle'
                result[key]=(o,f,ci)
        return result
    om=face_map(orig,oi);rm=face_map(ret,ri);assert om.keys()==rm.keys(),'Missing/extra face'
    texture_images=set();max_displacement=0;loops=0
    for o in orig:
        o.data.materials.clear()
        while o.data.uv_layers:o.data.uv_layers.remove(o.data.uv_layers[0])
        o.data.uv_layers.new(name='UVMap')
    for key,(o,f,ci) in om.items():
        ro,rf,rci=rm[key];layer=ro.data.uv_layers.active;assert layer
        mat=ro.data.materials[rf.material_index];assert mat and mat.use_nodes
        if mat.name not in o.data.materials:o.data.materials.append(mat)
        f.material_index=o.data.materials.find(mat.name)
        uvmap={ri[ro.name,ro.data.loops[li].vertex_index]:layer.data[li].uv.copy() for li in rf.loop_indices}
        coordmap={ri[ro.name,i]:ro.data.vertices[i].co for i in rf.vertices}
        assert len(uvmap)==3
        for li in f.loop_indices:
            vid=o.data.loops[li].vertex_index;cid=oi[o.name,vid]
            o.data.uv_layers.active.data[li].uv=uvmap[cid];loops+=1
            max_displacement=max(max_displacement,(o.data.vertices[vid].co-coordmap[cid]).length)
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image:
                img=node.image;img.filepath=str(Path(bpy.path.abspath(img.filepath)).resolve());texture_images.add(img)
    assert max_displacement<0.0001,('coordinate repair exceeds bound',max_displacement)
    images=[]
    for img in texture_images:
        ip=Path(img.filepath);assert tuple(img.size)==(4096,4096) and ip.is_file()
        images.append({'path':str(ip),'sha256':sha(ip),'size':list(img.size)})
    assert len(images)==1,'Expected original 4K image'
    expected_uv={key:{ri[ro.name,ro.data.loops[li].vertex_index]:ro.data.uv_layers.active.data[li].uv.copy() for li in rf.loop_indices} for key,(ro,rf,rci) in rm.items()}
    dest=out/f'{kind}.fbx'
    if '--verify-existing' in sys.argv:assert dest.exists()
    else:
        assert not dest.exists(),'Refuse overwrite'
        prod.export(orig,dest)
    clear();fresh=prod.inventory(p,base);test_orig=[fresh[c] for c in group['components']];test_return=prod.imported(dest)
    validation=prod.restore_uv(test_orig,test_return,rotation=(0,0,0))
    ni,ns=mapping(test_return);nf=face_map(test_return,ni);assert nf.keys()==expected_uv.keys();max_uv_error=0
    for key,(no,nface,nci) in nf.items():
        for li in nface.loop_indices:
            cid=ni[no.name,no.data.loops[li].vertex_index]
            max_uv_error=max(max_uv_error,(no.data.uv_layers.active.data[li].uv-expected_uv[key][cid]).length)
    assert max_uv_error<1e-6,('UV roundtrip changed',max_uv_error)
    after={str(f):sha(f) for f in files};assert before==after
    report.append({'group':kind,'output':str(dest),'sha256':sha(dest),'facesBijection':len(om),'cornersBijection':loops,'maxRawCoordinateRestoration':max_displacement,'repairLimit':0.0001,'originalCanonicalMapping':os,'returnedCanonicalMapping':rs,'texture':images,'unmodifiedProductionRestoreUV':validation,'exportedUVMaxError':max_uv_error,'inputHashesUnchanged':before})
    (r/'normalization-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps([{'group':v['group'],'validation':v['unmodifiedProductionRestoreUV']} for v in report]))
