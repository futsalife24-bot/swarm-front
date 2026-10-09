import json,struct,hashlib,subprocess
from pathlib import Path
p=Path(__file__).resolve().parent
def durations(raw):
 size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:];result={}
 for action in g['animations']:
  times=[]
  for sampler in action['samplers']:
   a=g['accessors'][sampler['input']];v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
   times.extend(struct.unpack_from('<f',binary,offset+i*v.get('byteStride',4))[0] for i in range(a['count']))
  result[action['name']]=max(times)-min(times)
 return result,hashlib.sha256(raw).hexdigest()
baseline=p/'timing-baseline.glb'
if baseline.exists():original=baseline.read_bytes()
else:
 repo=next(root for root in p.parents if (root/'.git').exists())
 original=subprocess.run(['git','show','6f5952901dabec09a986b734c8ecd43d92dd5fc6:public/assets/characters/swarm-soldier.glb'],cwd=repo,check=True,capture_output=True).stdout
before,bh=durations(original);after,ah=durations((p/'swarm-soldier.glb').read_bytes())
errors=[name for name,d in before.items() if name not in after or abs(after[name]-d)>1e-5]
report={'baselineSha256':bh,'exportSha256':ah,'baselineDurations':before,'exportDurations':after,'errors':errors}
(p/'export-timing-check.json').write_text(json.dumps(report,indent=2));print(json.dumps({'clips':len(after),'errors':errors}))
assert not errors and set(before)==set(after),'Export changed clip timing'
