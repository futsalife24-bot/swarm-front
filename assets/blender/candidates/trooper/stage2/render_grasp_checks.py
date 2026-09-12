import bpy,importlib.util,sys
from pathlib import Path
from mathutils import Vector
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
p.s.render.resolution_x=720;p.s.render.resolution_y=800;p.s.cycles.samples=16
visible={o.name:o.hide_render for o in bpy.data.objects if o.type=='MESH'}
cases=[('reach_rifle','rifle'),('reach_rocket','rocket'),('held_rifle','rifle'),('held_rocket','rocket')]
if '--quick' in sys.argv:cases=[('held_rifle','rifle')]
for label,kind in cases:
 for n,hidden in visible.items():bpy.data.objects[n].hide_render=hidden
 p.sample('Weapon_Idle_Rocket' if kind=='rocket' and label.startswith('held') else 'Weapon_Idle_Rifle',0)
 if label.startswith('reach'):
  n='BackWeaponSocket' if kind=='rifle' else 'BackWeaponSocket_2';gun=p.rig.pose.bones[n].matrix.copy();p.pistol_grasp(gun,pole_point=Vector((.5,-.25,1.4)),kind=kind)
  for wk,bn in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
   o=p.weapons[wk];o.hide_render=False;o.matrix_world=p.rig.matrix_world@p.rig.pose.bones[bn].matrix
  p.render('grasp_'+label+'_normal',(-4,-6,2.3))
 else:
  p.static_grip(kind);gun=p.rig.pose.bones['RightHandWeaponSocket'].matrix.copy();p.pistol_grasp(gun,kind=kind)
  if kind=='rocket':p.pistol_grasp(gun,side='L',forward=.28,kind=kind)
  p.rig.pose.bones['RightHandWeaponSocket'].matrix=gun;bpy.context.view_layer.update();p.equip(kind,'rifle' if kind=='rocket' else 'rocket');p.render('grasp_'+label+'_normal',(3,6,2.8))
 for o in bpy.data.objects:
  if o.type=='MESH':o.hide_render=o.name not in ['Study_Glove_R','Weapon_'+kind]
 target=gun@Vector((0,-.01,-.07))
 for view,delta in [('opposite',(-.5,.3,-.20)),('outer',(.5,.3,-.20)),('rear',(-.5,-.3,-.10))]:
  p.render('grasp_'+label+'_'+view,gun@Vector(delta),target,.38)
 if label=='held_rocket':
  bpy.data.objects['Study_Glove_R'].hide_render=True;bpy.data.objects['Study_Glove_L'].hide_render=False
  for view,delta in [('outer',(-.5,.5,-.2)),('rear',(-.5,.0,-.2))]:p.render('grasp_launcher_left_'+view,gun@Vector(delta),gun@Vector((0,.27,-.07)),.38)
