"""Local thenar/web shaping only; keep full glove bounds and all finger geometry."""
import bpy,math,json
from pathlib import Path
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_refined.blend'))
report=[]
for side,sign in [('L',-1),('R',1)]:
 old=bpy.data.objects['Study_Glove_'+side]
 if old.get('web_refined'):continue
 old.name='Diagnostic_PreWeb_Glove_'+side;old.hide_render=True;old.hide_set(True);o=old.copy();o.data=old.data.copy();o.name='Study_Glove_'+side;bpy.context.scene.collection.objects.link(o);o.hide_render=False;o.hide_set(False)
 def bounds(ob):return [[min(v.co[k] for v in ob.data.vertices),max(v.co[k] for v in ob.data.vertices)] for k in range(3)]
 before=bounds(o);changed=0
 for v in o.data.vertices[:192]:
  c=math.cos((v.index%32)*math.tau/32)
  if c*sign>=0:continue
  z=v.co.z;amount=.017*math.exp(-((z-.857)/.028)**2)+.007*math.exp(-((z-.875)/.022)**2)
  v.co.x-=amount*math.copysign(abs(c)**.75,c);changed+=1
 after=bounds(o);assert all(abs(a-b)<1e-6 for pair1,pair2 in zip(before,after) for a,b in zip(pair1,pair2))
 o['web_refined']=True;report.append({'side':side,'palmVerticesLocallyChanged':changed,'wholeGloveBoundsUnchanged':True,'fingerGeometryAndWeightsUnchanged':True,'before':before,'after':after})
(Q/'thumb-web-refinement.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_refined.blend'))
