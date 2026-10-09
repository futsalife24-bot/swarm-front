"""Verify the isolated reload edit changes only the intended three arm tracks."""
import json,struct,hashlib,subprocess
from pathlib import Path
p=Path(__file__).resolve().parent
def read(path):
 raw=path if isinstance(path,bytes) else path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+size]);binary=raw[28+size:];result={}
 def accessor(i):
  a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
  n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  fmt={5120:'b',5121:'B',5122:'h',5126:'f',5123:'H',5125:'I'}[a['componentType']];width=struct.calcsize(fmt)*n
  offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width)
  return [struct.unpack_from('<'+fmt*n,binary,offset+j*stride) for j in range(a['count'])]
 for anim in doc['animations']:
  for c in anim['channels']:
   s=anim['samplers'][c['sampler']];key=(anim['name'],doc['nodes'][c['target']['node']]['name'],c['target']['path'])
   result[key]=(accessor(s['input']),accessor(s['output']))
 geometry=hashlib.sha256()
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   for index in [primitive['indices'],*primitive['attributes'].values()]:geometry.update(repr(accessor(index)).encode())
 for skin in doc['skins']:geometry.update(repr(accessor(skin['inverseBindMatrices'])).encode())
 return result,hashlib.sha256(raw).hexdigest(),doc['nodes'],geometry.hexdigest()
baseline=p/'sling-preview/swarm-soldier.glb'
if baseline.exists():before=baseline.read_bytes()
else:
 repo=next(root for root in p.parents if (root/'.git').exists())
 before=subprocess.run(['git','show','009fd38ddc3bffbcdee4cbf05b83d63ea5f051d7:public/assets/characters/swarm-soldier.glb'],cwd=repo,check=True,capture_output=True).stdout
candidate=p/'reload-preview/swarm-soldier.glb'
if not candidate.exists():candidate=p/'swarm-soldier.glb'
old,oldsha,oldnodes,oldgeometry=read(before);new,newsha,newnodes,newgeometry=read(candidate)
changed=[];unexpected=[];roundoff=[]
for key in old.keys()|new.keys():
 if old.get(key)==new.get(key):continue
 changed.append(list(key))
 if key[0]!='Trial_Reload_Rocket' or key[1] not in ['UpperArm_L','LowerArm_L','Hand_L']:
  x,y=old.get(key),new.get(key)
  delta=float('inf')
  if x and y and x[0]==y[0] and len(x[1])==len(y[1]):
   delta=max(max(abs(a-b) for a,b in zip(u,v)) for u,v in zip(x[1],y[1]))
  if delta<=1e-5:roundoff.append({'track':list(key),'maxComponentDelta':delta})
  else:unexpected.append({'track':list(key),'maxComponentDelta':delta})
report={'beforeSha256':oldsha,'candidateSha256':newsha,'changedTracks':changed,'roundoffTolerance':1e-5,'roundoffOnly':roundoff,'unexpectedTracks':unexpected,'restNodesIdentical':oldnodes==newnodes,'geometryAndBindIdentical':oldgeometry==newgeometry,'scopeOnly':not unexpected and oldnodes==newnodes and oldgeometry==newgeometry}
(p/'reload-export-difference.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['changedTracks','roundoffOnly']},indent=2))
if not report['scopeOnly']:raise SystemExit(1)
