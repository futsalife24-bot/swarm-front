"""Isolated comparison: rigid patella cups follow distal femur, not shin."""
import bpy,importlib.util,math
from pathlib import Path
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
for side in ['L','R']:
 o=bpy.data.objects['Trial_Knee_'+side];o.vertex_groups.clear();g=o.vertex_groups.new(name='UpperLeg_'+side);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
body=bpy.data.objects['Study_Body']
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
for v in body.data.vertices:
 x,y,z=v.co
 if not (.43<z<.66):continue
 blend=smooth((z-.43)/.035)*smooth((.66-z)/.035)
 side='R' if x>0 else 'L';upper=smooth((z-(.53-.60*(y-.025))+.045)/.09)
 ws={g.group:g.weight*(1-blend) for g in v.groups}
 for name,w in [('UpperLeg_',upper),('LowerLeg_',1-upper)]:
  g=body.vertex_groups[name+side];ws[g.index]=ws.get(g.index,0)+w*blend
 ws=sorted([(i,w) for i,w in ws.items() if w>1e-7],key=lambda p:-p[1])[:4];total=sum(w for _,w in ws)
 for g in body.vertex_groups:g.remove([v.index])
 for i,w in ws:body.vertex_groups[i].add([v.index],w/total,'REPLACE')
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_knee_trial.blend'))
p.reset()
for side in ['L','R']:
 for name,angle in [('LowerArm_',120),('LowerLeg_',-120)]:
  b=p.rig.pose.bones[name+side];b.rotation_mode='XYZ';b.rotation_euler.x=math.radians(angle)
bpy.context.view_layer.update();p.render('knee_trial_flex',(-5,4,2.2))
