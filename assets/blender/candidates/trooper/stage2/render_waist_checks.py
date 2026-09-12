import bpy,importlib.util
from pathlib import Path
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
p.reset()
for n,a in [('Spine',-.4),('SpineMid',-.45),('Chest',-.4),('UpperLeg_L',1.4),('UpperLeg_R',1.4),('LowerLeg_L',-2),('LowerLeg_R',-2),('UpperArm_L',.6),('UpperArm_R',.6),('LowerArm_L',1.7),('LowerArm_R',1.7)]:
 b=p.rig.pose.bones[n];b.rotation_mode='XYZ';b.rotation_euler.x=a
bpy.context.view_layer.update();p.back_rest()
for kind,n in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
 o=p.weapons[kind];o.hide_render=False;o.matrix_world=p.rig.matrix_world@p.rig.pose.bones[n].matrix
p.s.render.resolution_x=800;p.s.render.resolution_y=800;p.s.cycles.samples=20
p.render('waist_tuck_normal',(4,0,1.10),(.12,0,1.04),.72)
clay=bpy.data.materials.new('Waist diagnostic clay');clay.use_nodes=True;clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.5,.5,.5,1);clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
p.s.view_layers[0].material_override=clay;p.s.world.use_nodes=True;p.s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.8,.8,.8,1);p.s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
p.render('waist_tuck_softlight',(4,0,1.10),(.12,0,1.04),.72)
