"""Keep thorax cloth attached to the rib-cage, with soft axilla/collar borders."""
import bpy
from pathlib import Path
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
o=bpy.data.objects['Study_Body'];ch=o.vertex_groups['Chest']
def ramp(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
count=0
for v in o.data.vertices:
 p=v.co;a=ramp((.255-abs(p.x))/.055)*ramp((p.z-1.23)/.06)*ramp((1.49-p.z)/.06)
 if a<=0:continue
 ws={g.group:g.weight*(1-a) for g in v.groups};ws[ch.index]=ws.get(ch.index,0)+a
 ws=sorted([(i,w) for i,w in ws.items() if w>1e-6],key=lambda p:-p[1])[:4];total=sum(w for _,w in ws)
 for g in o.vertex_groups:g.remove([v.index])
 for i,w in ws:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
 count+=1
print('Thorax vertices adjusted',count)
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
