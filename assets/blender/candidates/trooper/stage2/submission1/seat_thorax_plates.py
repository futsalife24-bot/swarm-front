"""Fit short rigid plates to the actual saved cloth surface in rest space."""
import bpy
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST';bpy.context.view_layer.update()
body=bpy.data.objects['Study_Body'];tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get());col=bpy.data.collections['STAGE2_ARMOR']
for name,side,rows,offset,material,thickness in [
 ('Trial_Chest',1,[(1.285,.13),(1.305,.195),(1.370,.200),(1.410,.15),(1.425,.115)],.010,'Armor',.012),
 ('Trial_Chest_Ceramic',1,[(1.350,.106),(1.377,.121),(1.394,.095)],.026,'Ceramic',.006),
 ('Trial_Back',-1,[(1.285,.125),(1.310,.170),(1.375,.167),(1.425,.115)],.010,'Armor',.012),
 ('Trial_Back_Ceramic',-1,[(1.325,.096),(1.375,.108),(1.395,.084)],.026,'Ceramic',.006)]:
 old=bpy.data.objects[name];old.name='Diagnostic_Long_'+name;old.hide_render=True;old.hide_set(True)
 vs=[];N=16
 for z,w in rows:
  for i in range(N+1):
   x=w*(-1+2*i/N);hit=tree.ray_cast(Vector((x,side,z)),Vector((0,-side,0)))[0];assert hit is not None
   vs.append((x,hit.y+side*offset,z))
 fs=[(j*(N+1)+i,j*(N+1)+i+1,(j+1)*(N+1)+i+1,(j+1)*(N+1)+i) for j in range(len(rows)-1) for i in range(N)]
 if side<0:fs=[tuple(reversed(f)) for f in fs]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(bpy.data.materials[material]);o.parent=rig
 g=o.vertex_groups.new(name='Chest');g.add(list(range(len(vs))),1,'REPLACE');bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 m=o.modifiers.new('Rigid thickness','SOLIDIFY');m.thickness=thickness;m.offset=0;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Rounded edges','BEVEL');m.width=.003;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in me.polygons:p.use_smooth=True
 m=o.modifiers.new('Plate normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Rigid ribcage binding','ARMATURE');m.object=rig
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
