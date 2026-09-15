import bpy,sys,importlib.util
from pathlib import Path
from mathutils import Vector
Q=Path(__file__).resolve().parent;sys.argv.extend(['--source','../stage3/trooper_stage3_animated.blend']);sp=importlib.util.spec_from_file_location('p',Q.parent/'stage2/render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p);p.Q=Q;p.s.render.resolution_x=720;p.s.render.resolution_y=800;p.s.cycles.samples=16
for b in p.rig.pose.bones:b.rotation_mode='QUATERNION'
p.sample('Trial_Switch_1_to_2',0);p.equip('rifle','rocket');p.render('mount_final_rifle_held',(3,6,2.8));target=p.rig.pose.bones['Hand_L'].head.copy();p.render('mount_final_left_support',target+Vector((-1,.8,.3)),target,.48)
