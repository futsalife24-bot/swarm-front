import bpy
from pathlib import Path
from mathutils import Vector
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_anatomy_stage1.blend'))
s=bpy.context.scene;s.render.resolution_x=600;s.render.resolution_y=600;s.cycles.samples=24
m=bpy.data.materials.new('Detail_Clay');m.diffuse_color=(.52,.55,.56,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.52,.55,.56,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8
s.view_layers[0].material_override=m
camera=s.camera
shots={'hand_palm':((-.39,3,.81),(-.39,.05,.81),.30),'hand_back':((-.39,-3,.81),(-.39,.05,.81),.30),'hand_side':((-3,.05,.81),(-.39,.05,.81),.30)}
for name,(pos,target,scale) in shots.items():
 camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale;s.render.filepath=str(Q/f'detail_{name}.png');bpy.ops.render.render(write_still=True)
# Complete the unchanged viewing directions with the revised gloves too.
s.render.resolution_y=800;camera.data.ortho_scale=2.14
for mode in ['color','clay']:
 s.view_layers[0].material_override=m if mode=='clay' else None
 for name,pos in {'side':(-6,0,1.04),'back':(0,-6,1.04)}.items():
  camera.location=pos;camera.rotation_euler=(Vector((0,0,.97))-camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(Q/f'after_{mode}_{name}.png');bpy.ops.render.render(write_still=True)
