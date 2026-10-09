import bpy,json,math
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-rig-input.blend'))
r=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=bpy.data.objects['Body'];errors=[]
for side in ['L','R']:
 hand=r.data.bones['hand.'+side]
 for finger in ['thumb','index','middle','ring','little']:
  base=r.data.bones[finger+'_proximal.'+side]
  if (base.head_local-hand.head_local).length>.16:errors.append(base.name+' outside palm')
  for seg in ['proximal','intermediate','distal']:
   n=finger+'_'+seg+'.'+side;g=body.vertex_groups[n]
   count=sum(any(w.group==g.index and w.weight>.1 for w in v.groups) for v in body.data.vertices)
   if count<5:errors.append(n+' lacks influenced vertices')
bad=sum(not v.groups or abs(sum(w.weight for w in v.groups)-1)>.02 for v in body.data.vertices)
if bad:errors.append('unnormalized weights '+str(bad))
if {o.name for o in bpy.data.objects}!={r.name,'Body','Head'}:errors.append('extra objects')
report={'errors':errors,'objects':[o.name for o in bpy.data.objects],'vertices':len(body.data.vertices),'boneCount':len(r.data.bones),'status':'passed' if not errors else 'failed'}
(p/'hand-rig-check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if errors:raise SystemExit(1)
