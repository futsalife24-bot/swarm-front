import bpy,importlib.util,math
from pathlib import Path
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
p.s.render.resolution_x=800;p.s.render.resolution_y=650;p.s.cycles.samples=20
for angle in [60,120]:
 p.reset()
 for side in ['L','R']:
  b=p.rig.pose.bones['LowerLeg_'+side];b.rotation_mode='XYZ';b.rotation_euler.x=math.radians(-angle)
 bpy.context.view_layer.update()
 for mode in ['bare','armored']:
  for o in p.armor:o.hide_render=mode=='bare'
  p.render(f'knee_{angle}_{mode}_front',(1,3,1.1),(0,.025,.56),.82)
  p.render(f'knee_{angle}_{mode}_side',(3,0,.72),(.175,.025,.56),.70)
