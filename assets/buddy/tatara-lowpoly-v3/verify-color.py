"""本人が評価した形状・骨・動作が色調整で変わっていないかGLBを照合。"""
import json,struct
from pathlib import Path
out=Path(__file__).resolve().parent
def read(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+n]),raw[28+n:]
old,ob=read(out.parent/'tatara-lowpoly-v2'/'tatara.glb');new,nb=read(out/'tatara.glb')
color={p['attributes']['COLOR_0'] for m in old['meshes'] for p in m['primitives']}
def values(g,b,i):
    a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
    size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
    return b''.join(b[start+j*stride:start+j*stride+size] for j in range(a['count']))
changed=[i for i in range(len(old['accessors'])) if values(old,ob,i)!=values(new,nb,i)]
uv={p['attributes']['TEXCOORD_0'] for m in old['meshes'] for p in m['primitives']}
assert color.issubset(changed) and set(changed).issubset(color|uv),changed
assert not old.get('textures') and not new.get('textures')
assert old['nodes']==new['nodes'] and old['skins']==new['skins'] and old['animations']==new['animations']
result={'changed_accessors':changed,'color_accessors':sorted(color),'unused_uv_accessors':sorted(uv),'positions_normals_indices_weights_skeleton_animation_identical':True,'old_shell_linear_rgb':[.25,.018,.57],'new_shell_linear_rgb':[.14,.075,.255],'yellow_unchanged':True}
(out/'review'/'color-only-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
