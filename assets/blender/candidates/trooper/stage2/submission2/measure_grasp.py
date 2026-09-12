import bpy,importlib.util,json
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
p.sample('Weapon_Idle_Rifle',0);gun=p.rig.pose.bones['RightHandWeaponSocket'].matrix.copy();p.pistol_grasp(gun)
tips={f:list(gun.inverted()@p.rig.pose.bones[f+'3_R'].tail) for f in ['Index','Middle','Ring','Little','Thumb']}
dg=bpy.context.evaluated_depsgraph_get();o=bpy.data.objects['Study_Glove_R'].evaluated_get(dg);R=Matrix.Rotation(-.24,3,'X');depths=[]
for v in o.data.vertices:
 q=R@(gun.inverted()@v.co-Vector((0,-.014,-.068)));d=[h-abs(x) for h,x in zip([.025,.0335,.0575],q)]
 if min(d)>0:depths.append(min(d))
print(json.dumps({'fingerTipsWeaponLocal':tips,'gripBoxPenetratingVertices':len(depths),'maxBoxPenetration_m':max(depths,default=0)},indent=2))
