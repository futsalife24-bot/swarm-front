"""Unsaved placement illustration; never changes socket binds or saves blend."""
import bpy,math
from pathlib import Path
from mathutils import Matrix,Vector
Q=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'))
s=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG'];body=bpy.data.objects['Study_Body'];cam=s.camera
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
rig.animation_data.action=bpy.data.actions['Trial_Switch_1_to_2'];s.frame_set(27);bpy.context.view_layer.update()
for wk,bn in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
 o=bpy.data.objects['Weapon_'+wk];o.hide_render=False;o.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
bpy.data.objects['Weapon_shotgun'].hide_render=True
visibility={o.name:o.hide_render for o in bpy.data.objects if o.type=='MESH'};materials=list(body.data.materials);rocket=bpy.data.objects['Weapon_rocket'];base=rocket.matrix_world.copy()
glass=bpy.data.materials.new('Proposal transparent cloth');glass.use_nodes=True;n=glass.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=.3;trans=n.new('ShaderNodeBsdfTransparent');diff=n.new('ShaderNodeBsdfDiffuse');diff.inputs['Color'].default_value=(.1,.65,.72,1);links=glass.node_tree.links;links.new(trans.outputs[0],mix.inputs[1]);links.new(diff.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs[0])
s.render.resolution_x=680;s.render.resolution_y=760;s.render.resolution_percentage=100;s.cycles.samples=12;target=Vector((.14,-.20,1.4));cam.location=target+Vector((-3,-6,1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.1
for proposal in [False,True]:
 rocket.matrix_world=base.copy()
 if proposal:rocket.location.x+=.15
 for diagnostic in [False,True]:
  for name,hidden in visibility.items():bpy.data.objects[name].hide_render=hidden
  body.data.materials.clear()
  for m in materials:body.data.materials.append(m)
  if diagnostic:
   for o in bpy.data.objects:
    if o.type=='MESH' and o.name not in ['Study_Body','Study_Glove_R','Weapon_rifle','Weapon_rocket']:o.hide_render=True
   body.data.materials.clear();body.data.materials.append(glass)
  s.render.filepath=str(Q/f"placement_{'idea' if proposal else 'current'}_{'transparent' if diagnostic else 'normal'}.png");bpy.ops.render.render(write_still=True)
print('PLACEMENT ILLUSTRATION COMPLETE; no bind edit and no blend saved')
