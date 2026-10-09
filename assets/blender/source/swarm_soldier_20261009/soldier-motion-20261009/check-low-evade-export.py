"""Scope evidence for user-approved low evade and close back-mount integration."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('glb_evidence',p/'check-roll-grips-export.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
old,before,geometry,sha=module.read(p/'low-evade-baseline.glb')
new,after,newgeometry,newsha=module.read(p/'low-evade-integrated-preview/swarm-soldier.glb')
rolls={'Trial_Dodge_Roll','Trial_Dodge_Roll_Shotgun','Trial_Dodge_Roll_Rocket'}
switches={'Trial_Switch_1_to_2','Trial_Switch_2_to_1'}
backs={'BackWeaponSocket','BackWeaponSocket_2'}
errors=[];roundoff=[]
if set(after)!=set(before)|rolls:errors.append('Unexpected clip set')
for name,tracks in before.items():
 if name in rolls|switches:continue
 for key,track in tracks.items():
  if key[0] in backs:continue
  other=after.get(name,{}).get(key)
  if other==track:continue
  delta=max(abs(a-b) for x,y in zip(other[2],track[2]) for a,b in zip(x,y)) if other and other[:2]==track[:2] and len(other[2])==len(track[2]) else float('inf')
  if delta>1e-6:errors.append('Unrelated track changed: '+str((name,key)))
  else:roundoff.append({'clip':name,'track':key,'delta':delta})
for a,b in zip(old['nodes'],new['nodes']):
 if a!=b and a['name'] not in backs:errors.append('Unrelated rest node changed: '+a['name'])
if len(old['nodes'])!=len(new['nodes']):errors.append('Rest node count changed')
assert len(old['skins'])==len(new['skins'])==1
if geometry[:-1]!=newgeometry[:-1]:errors.append('Mesh geometry or skin weights changed')
for joint,a,b in zip(old['skins'][0]['joints'],geometry[-1],newgeometry[-1]):
 if a!=b and old['nodes'][joint]['name'] not in backs:errors.append('Unrelated bind matrix changed: '+old['nodes'][joint]['name'])
baseDuration=max(v[1][-1][0] for v in before['Trial_Dodge_Roll'].values())
for name in rolls:
 if max(v[1][-1][0] for v in after[name].values())!=baseDuration:errors.append('Evade clip time changed: '+name)
report={'beforeSha256':sha,'candidateSha256':newsha,'clips':len(after),'unchangedOriginalClipsExceptBackAnchors':len(before)-3,'allowedChanges':['three user-approved low evade profiles','two switch arm/hand paths','two non-deforming back anchors and their tracks'],'roundoff':roundoff,'errors':errors,'scope':'Animation, rest and mesh scope check; visual/contact/gameplay evidence is separate.'}
(p/'low-evade-export-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='roundoff'},indent=2))
if errors:raise SystemExit(1)
