"""Downsample the existing atlas only; preserve high-resolution proof and mesh."""
from pathlib import Path
import json, struct, shutil
import numpy as np
from PIL import Image
out=Path.cwd()/'dist-validation/astra-pbr-proof'
for src,dst in [('heavy_0.glb','heavy_0-high.glb'),('base.jpg','base-1024.jpg'),('orm.jpg','orm-512.jpg'),('summary.json','summary-high.json')]:
    if not (out/src).is_file():raise FileNotFoundError(f'Required bake output missing: {out/src}')
    p=out/dst
    if not p.exists():shutil.copy2(out/src,p)
for src,dst in [('integrity.json','integrity-high.json'),('comparison.png','comparison-high.png')]:
    if (out/src).is_file() and not (out/dst).exists():shutil.copy2(out/src,out/dst)

def resize(src,dst,size,srgb):
    a=np.array(Image.open(src).convert('RGB'),dtype=np.float32)/255
    if srgb:a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
    a=np.stack([np.array(Image.fromarray(a[:,:,i],mode='F').resize((size,size),Image.Resampling.BOX)) for i in range(3)],axis=-1)
    if srgb:a=np.where(a<=.0031308,a*12.92,1.055*np.maximum(a,0)**(1/2.4)-.055)
    Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).save(dst,quality=88,subsampling=0)
resize(out/'base-1024.jpg',out/'base-512.jpg',512,True)
resize(out/'orm-512.jpg',out/'orm-256.jpg',256,False)

d=(out/'heavy_0-high.glb').read_bytes();n=struct.unpack_from('<I',d,12)[0]
j=json.loads(d[20:20+n]);original=d[28+n:]
replace={im['bufferView']:(out/('base-512.jpg' if im['name']=='base' else 'orm-256.jpg')).read_bytes() for im in j['images']}
blob=bytearray()
for i,view in enumerate(j['bufferViews']):
    b=replace.get(i,original[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
    blob.extend(b'\0'*((-len(blob))%4));view['byteOffset']=len(blob);view['byteLength']=len(b);blob.extend(b)
j['buffers'][0]['byteLength']=len(blob);blob.extend(b'\0'*((-len(blob))%4))
b=json.dumps(j,separators=(',',':')).encode();b+=b' '*((-len(b))%4)
result=struct.pack('<4sIIII',b'glTF',2,28+len(b)+len(blob),len(b),0x4e4f534a)+b+struct.pack('<II',len(blob),0x004e4942)+blob
(out/'heavy_0.glb').write_bytes(result)
summary=json.loads((out/'summary-high.json').read_text(encoding='utf8'));summary['bytes']=len(result)
summary['atlas_dimensions']={'base':[512,512],'orm':[256,256]}
summary['downsample']='Existing color atlas filtered in linear light; ORM filtered as non-color linear data; JPEG 88 4:4:4. No rebake.'
summary['gpu_texture_rgba8_with_mips_estimate_bytes']=int((512*512+256*256)*4*4/3)
(out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
assert len(result)<=800000
print(json.dumps({'bytes':len(result),'images':{p.name:p.stat().st_size for p in [out/'base-512.jpg',out/'orm-256.jpg']}}))
