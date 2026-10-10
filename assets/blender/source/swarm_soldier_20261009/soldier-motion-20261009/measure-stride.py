import bpy,json
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
report={}
for name in ['Walk','Sprint','Jog']:
 a=bpy.data.actions['Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];rows=[]
 start,end=map(round,a.frame_range)
 for f in range(start,end+1):
  s.frame_set(f)
  rows.append({'phase':(f-start)/(end-start),'feet':{side:list(r.matrix_world@r.pose.bones['foot.'+side].head) for side in ['L','R']}})
 report[name]=rows
(p/'stride-samples.json').write_text(json.dumps(report,indent=2))
fits={}
for name,windows in {'Walk':{'L':(.05,.25),'R':(.55,.75)},'Sprint':{'L':(.05,.20),'R':(.60,.75)}}.items():
 slopes={}
 for side,(lo,hi) in windows.items():
  pts=[(row['phase'],row['feet'][side][1]) for row in report[name] if lo-1e-6<=row['phase']<=hi+1e-6]
  mx=sum(x for x,y in pts)/len(pts);my=sum(y for x,y in pts)/len(pts)
  slopes[side]=sum((x-mx)*(y-my) for x,y in pts)/sum((x-mx)**2 for x,y in pts)
 fits[name]={'units':'metres per full cycle','method':'ankle forward displacement regression during planted midstance; rolling sole may vary','phaseWindows':windows,'sides':slopes,'mean':sum(slopes.values())/2}
(p/'stride-fit.json').write_text(json.dumps(fits,indent=2));print(json.dumps(fits))
