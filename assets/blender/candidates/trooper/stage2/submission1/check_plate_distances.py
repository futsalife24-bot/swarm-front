import bpy,importlib.util,json
from pathlib import Path
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
report={}
for state in ['rest','tuck']:
 p.reset()
 if state=='tuck':
  for n,a in [('Spine',-.4),('SpineMid',-.45),('Chest',-.4)]:
   b=p.rig.pose.bones[n];b.rotation_mode='XYZ';b.rotation_euler.x=a
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(bpy.data.objects['Study_Body'],dg)
 report[state]={}
 for n in ['Trial_Chest','Trial_Chest_Ceramic','Trial_Back','Trial_Back_Ceramic']:
  ob=bpy.data.objects[n].evaluated_get(dg);ds=[tree.find_nearest(v.co)[3] for v in ob.data.vertices]
  report[state][n]={'min_m':min(ds),'mean_m':sum(ds)/len(ds),'max_m':max(ds)}
(Q/'plate-distances.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
