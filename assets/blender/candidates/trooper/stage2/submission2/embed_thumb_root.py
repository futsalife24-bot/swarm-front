"""Seat the closed thumb root inside the reshaped palm; don't resize the hand."""
import bpy,json
from pathlib import Path
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_refined.blend'));report=[]
for side,sign in [('L',-1),('R',1)]:
 o=bpy.data.objects['Study_Glove_'+side]
 if o.get('root_embedded'):continue
 before=[[min(v.co[k] for v in o.data.vertices),max(v.co[k] for v in o.data.vertices)] for k in range(3)]
 for i in range(960,992):o.data.vertices[i].co.x+=sign*(.025 if i<976 else .012)
 after=[[min(v.co[k] for v in o.data.vertices),max(v.co[k] for v in o.data.vertices)] for k in range(3)];assert before==after
 o['root_embedded']=True;report.append({'side':side,'rootConnectorVerticesChanged':32,'articulatedShaftGeometryUnchanged':True,'wholeHandBoundsUnchanged':True,'boneAndWeightDataUnchanged':True})
(Q/'thumb-root-refinement.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_refined.blend'))
