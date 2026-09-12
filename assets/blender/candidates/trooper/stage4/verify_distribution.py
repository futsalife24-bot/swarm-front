"""Read-only deployed/distribution asset and API verification."""
import json,hashlib,re,sys,urllib.request
from pathlib import Path
Q=Path(__file__).resolve().parent;GAME=Q.parents[4];BASE=sys.argv[1] if len(sys.argv)>1 else 'https://swarm-front.melosalife-24.workers.dev'
out=GAME/'dist-validation/trooper-v5';out.mkdir(exist_ok=True)
def get(path):
 with urllib.request.urlopen(BASE+path,timeout=30) as r:return r.status,r.read()
html=(GAME/'dist/index.html').read_text(encoding='utf-8');paths=re.findall(r'(?:src|href)="([^" ]+\.(?:js|css))"',html)
paths+=['/assets/characters/standard_trooper_v5.glb','/assets/characters/standard_trooper_v5.json']+['/assets/characters/standard_'+k+'_v4.glb' for k in ['rifle','shotgun','rocket']]
report={'base':BASE,'assets':[]}
status,remote=get('/');assert status==200
for p in paths:
 status,data=get(p);local=GAME/'dist'/p.lstrip('/');actual=hashlib.sha256(data).hexdigest();expected=hashlib.sha256(local.read_bytes()).hexdigest();assert actual==expected,p
 report['assets'].append({'path':p,'bytes':len(data),'sha256':actual,'matches':True})
if 'workers.dev' in BASE:
 status,data=get('/api/health');body=json.loads(data);assert status==200 and body['ok'] is True;report['health']={'status':status,'ok':True}
report['passed']=True
(out/('published-assets.json' if 'workers.dev' in BASE else 'distribution-assets.json')).write_text(json.dumps(report,indent=2))
print('ASSET VERIFICATION PASS',len(paths),report.get('health'))
