import struct,json,math,hashlib
from pathlib import Path
p=Path(__file__).resolve().parent;path=p/'soldier-motion-candidate.glb';data=path.read_bytes();offset=12;g=None;binary=None
while offset<len(data):
 n,t=struct.unpack_from('<II',data,offset);chunk=data[offset+8:offset+8+n];offset+=8+n
 if t==0x4e4f534a:g=json.loads(chunk)
 if t==0x004e4942:binary=chunk
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',width*4);base=v.get('byteOffset',0)+a.get('byteOffset',0)
 assert a['componentType']==5126
 return [struct.unpack_from('<'+'f'*width,binary,base+j*stride) for j in range(a['count'])]
errors=[];clips=[]
for a in g.get('animations',[]):
 end=0
 for c in a['channels']:
  sampler=a['samplers'][c['sampler']];times=[x[0] for x in accessor(sampler['input'])];vals=accessor(sampler['output'])
  if any(t2<=t1 for t1,t2 in zip(times,times[1:])):errors.append(a['name']+': non-increasing time')
  if any(not math.isfinite(x) for row in vals for x in row):errors.append(a['name']+': non-finite value')
  if c['target']['path']=='rotation' and any(abs(sum(x*x for x in q)-1)>.002 for q in vals):errors.append(a['name']+': quaternion norm')
  end=max(end,times[-1])
 clips.append({'name':a['name'],'duration':end,'channels':len(a['channels'])})
if len({c['name'] for c in clips})!=len(clips):errors.append('duplicate animation names')
out={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'clips':clips,'errors':errors,'meshes':[m.get('name') for m in g.get('meshes',[])],'nodes':len(g.get('nodes',[]))}
(p/'export-check.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
if errors:raise SystemExit(1)
