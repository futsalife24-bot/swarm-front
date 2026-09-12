"""Shorten rigid thorax plates for flexion; no bind/action changes."""
import bpy,json
from pathlib import Path
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
for name,lo,hi,newlo,newhi in [('Trial_Chest',1.19,1.437,1.295,1.420),('Trial_Back',1.17,1.425,1.290,1.420)]:
 o=bpy.data.objects[name]
 if not o.get('shortened'):
  for v in o.data.vertices:v.co.z=newlo+(v.co.z-lo)*(newhi-newlo)/(hi-lo)
  o['shortened']=True
for name in ['Trial_Back_Ceramic']:
 o=bpy.data.objects[name]
 if not o.get('shortened'):
  for v in o.data.vertices:v.co.z=1.320+(v.co.z-1.235)*.53
  o['shortened']=True
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
