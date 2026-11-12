"""Run the unchanged production checker against the isolated textured candidate."""
import json,struct,shutil,hashlib
from pathlib import Path
root=Path.cwd();lab=root/'dist-validation/astra-pbr-proof';design=root/'design/weapon-models-20261111'
check=lab/'check-design';(check/'blender/weapons').mkdir(parents=True,exist_ok=True)
out=check/'out/heavy';out.mkdir(parents=True,exist_ok=True)
for name in ['weapon_kit.py','check_weapon.py']:
    shutil.copy2(design/'blender'/name,check/'blender'/name)
for name in ['heavy.py','__init__.py']:
    src=design/'blender/weapons'/name
    if src.exists():shutil.copy2(src,check/'blender/weapons'/name)
def read(p):
    data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+n]),data[20+n:]
def write(p,j,rest):
    b=json.dumps(j,separators=(',',':')).encode();b+=b' '*((-len(b))%4)
    p.write_bytes(struct.pack('<4sIIII',b'glTF',2,20+len(b)+len(rest),len(b),0x4e4f534a)+b+rest)
j,rest=read(lab/'heavy_0.glb');files=[];protected={}
def triangles(doc,rest,material=None):
    blob=rest[8:];result=[]
    for prim in doc['meshes'][0]['primitives']:
        if material is not None and doc['materials'][prim['material']]['name']!=material:continue
        a=doc['accessors'][prim['attributes']['POSITION']];v=doc['bufferViews'][a['bufferView']]
        off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
        pts=[struct.unpack_from('<3f',blob,off+i*stride) for i in range(a['count'])]
        a=doc['accessors'][prim['indices']];v=doc['bufferViews'][a['bufferView']]
        fmt={5121:'B',5123:'H',5125:'I'}[a['componentType']];size=struct.calcsize(fmt)
        off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
        ix=[struct.unpack_from('<'+fmt,blob,off+i*stride)[0] for i in range(a['count'])]
        result.extend(sorted(tuple(pts[x]) for x in ix[i:i+3]) for i in range(0,len(ix),3))
    return sorted(tuple(x) for x in result)
def bore(doc,rest):
    blob=rest[8:];pts=[]
    for prim in doc['meshes'][0]['primitives']:
        a=doc['accessors'][prim['attributes']['POSITION']];v=doc['bufferViews'][a['bufferView']]
        off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
        pts.extend(struct.unpack_from('<3f',blob,off+i*stride) for i in range(a['count']))
    lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
    sizes=[hi[i]-lo[i] for i in range(3)];axis=max(range(3),key=lambda i:sizes[i]);end=hi[axis] if abs(hi[axis])>=abs(lo[axis]) else lo[axis]
    tip=[p for p in pts if abs(p[axis]-end)<=sizes[axis]*.03]
    center=[sum(p[i] for p in tip)/len(tip) for i in range(3)];center[axis]=end
    return {'bounds':[lo,hi],'axis':axis,'end':end,'muzzle':center,'tip_vertex_count':len(tip)}
for grade in range(5):
    original,original_rest=read(root/f'public/assets/weapons/unique-v1/heavy_{grade}.glb')
    accent=next(m for m in original['materials'] if m['name']=='Rarity identification')
    idx=next(i for i,m in enumerate(j['materials']) if m['name']=='Rarity identification')
    j['materials'][idx]=accent
    protected[grade]={name:next(m for m in j['materials'] if m['name']==name)==next(m for m in original['materials'] if m['name']==name) for name in ['Rarity identification','Glow heat']}
    p=out/f'heavy_{grade}.glb';write(p,j,rest)
    files.append({'file':p.name,'grade':grade,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    assert p.stat().st_size<=800000
report=json.loads((design/'out/heavy/report.json').read_text(encoding='utf8'));report['files']=files
(out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
original,original_rest=read(root/'public/assets/weapons/unique-v1/heavy_0.glb')
same=triangles(j,rest)==triangles(original,original_rest)
per_material={m['name']:triangles(j,rest,m['name'])==triangles(original,original_rest,m['name']) for m in j['materials']}
b0=bore(original,original_rest);b1=bore(j,rest)
result={'protected_materials_exact_match':protected,'triangle_position_multiset_exact_match':same,'triangles':report['triangles'],'materials':len(j['materials']),'max_bytes':max(f['bytes'] for f in files),'images':len(j['images']),'production_unchanged':hashlib.sha256((root/'public/assets/weapons/unique-v1/heavy_0.glb').read_bytes()).hexdigest()==json.loads((lab/'summary.json').read_text(encoding='utf8'))['original_sha256']}
result.update({'material_triangle_correspondence':per_material,'original_bore':b0,'candidate_bore':b1,'bounds_exact_match':b0['bounds']==b1['bounds'],'muzzle_delta_m':[b1['muzzle'][i]-b0['muzzle'][i] for i in range(3)]})
result['checker_sha256']=hashlib.sha256((check/'blender/check_weapon.py').read_bytes()).hexdigest()
result['checker_exact_match']=hashlib.sha256((design/'blender/check_weapon.py').read_bytes()).hexdigest()==result['checker_sha256']
assert same
assert all(per_material.values())
assert all(v for x in protected.values() for v in x.values())
(lab/'integrity.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result))
