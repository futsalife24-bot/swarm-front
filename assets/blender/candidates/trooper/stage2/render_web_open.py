import bpy,importlib.util
from pathlib import Path
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p);p.reset();p.s.render.resolution_x=600;p.s.render.resolution_y=600;p.s.cycles.samples=16
for side,sign in [('L',-1),('R',1)]:p.render('web_open_'+side,(sign*.39,3,.90),(sign*.39,.045,.82),.31)
