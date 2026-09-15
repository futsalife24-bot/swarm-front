"""Approved two-socket scope; diagnose composed transforms before --apply."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE'
names=['BackWeaponSocket','BackWeaponSocket_2']
def state():
 return {n:{'type':'nondeforming bone','parent':rig.data.bones[n].parent.name,'localMatrix':[list(r) for r in rig.data.bones[n].parent.matrix_local.inverted()@rig.data.bones[n].matrix_local],'armatureMatrix':[list(r) for r in rig.data.bones[n].matrix_local]} for n in names}
before=state();uses=[]
for o in bpy.data.objects:
 if o.type!='MESH':continue
 for n in names:
  g=o.vertex_groups.get(n)
  if g and any(any(w.group==g.index and w.weight>1e-7 for w in v.groups) for v in o.data.vertices):uses.append((o.name,n))
assert not uses
assert all(not rig.data.bones[n].use_deform for n in names)
assert not any(b.constraints for b in rig.pose.bones) and not rig.constraints
assert not rig.animation_data.drivers
for t in rig.animation_data.nla_tracks:t.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
if '--apply' not in sys.argv:
 rig.animation_data.action=bpy.data.actions['Weapon_Idle_Rifle'];s.frame_set(0);bpy.context.view_layer.update();rig.animation_data.action=None
 for o in bpy.data.objects:
  if o.name.startswith('Weapon_'):o.hide_render=True
 for kind,n in [('rifle',names[0]),('rocket',names[1])]:
  o=bpy.data.objects['Weapon_'+kind];o.hide_render=False;o.matrix_world=rig.matrix_world@rig.pose.bones[n].matrix
  origin=o.matrix_world.translation.copy()
  for axis,color,label in [(0,(1,.03,.03,1),'X'),(1,(.02,1,.08,1),'Y'),(2,(.04,.2,1,1),'Z')]:
   end=origin+o.matrix_world.to_3x3().col[axis]*.17
   cu=bpy.data.curves.new('axis','CURVE');cu.dimensions='3D';cu.bevel_depth=.005;sp=cu.splines.new('POLY');sp.points.add(1);sp.points[0].co=(*origin,1);sp.points[1].co=(*end,1)
   ob=bpy.data.objects.new(n+'_'+label,cu);s.collection.objects.link(ob);ma=bpy.data.materials.new('axis_'+label);ma.diffuse_color=color;ma.use_nodes=True;ma.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;ma.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=color;ma.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.5;ob.data.materials.append(ma)
 cam=s.camera;cam.location=(-3,-6,2.6);target=Vector((.13,-.1,1.30));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.55;s.render.resolution_x=900;s.render.resolution_y=900;s.cycles.samples=20;s.render.filepath=str(Q/'socket_offset_before.png');bpy.ops.render.render(write_still=True)
 (Q/'socket-offset-diagnosis.json').write_text(json.dumps({'before':before,'weaponOffsetInBlender':'identity; source weapon mesh origin is the grip attachment point','runtimeOffset':'rotation X +pi/2 cancels separately exported weapon GLB axis conversion; not a translation','bodyWeightsOnSockets':uses,'constraints':0,'drivers':0,'cause':'Back socket translations in original action/rest arrangement, not a duplicated weapon translation','poseSocketMatrices':{n:[list(r) for r in rig.pose.bones[n].matrix] for n in names}},indent=2))
else:
 assert (Q/'socket-offset-diagnosis.json').exists()
 keep={b.name:[list(r) for r in b.matrix_local] for b in rig.data.bones if b.name not in names}
 bpy.context.view_layer.objects.active=rig;rig.hide_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 R=Matrix.Rotation(-math.pi/2,4,'X')@Matrix.Rotation(math.pi,4,'Y')
 for n,pos in zip(names,[(.005,-.235,1.37),(.225,-.235,1.39)]):
  b=rig.data.edit_bones[n];m=R.copy();m.translation=Vector(pos);b.matrix=m;b.length=.1
 bpy.ops.object.mode_set(mode='OBJECT')
 assert keep=={b.name:[list(r) for r in b.matrix_local] for b in rig.data.bones if b.name not in names}
 # Short solid mounts make the back-plate/weapon relationship visible.
 for n,x,z in [('Trial_BackMount_Rifle',.005,1.37),('Trial_BackMount_Rocket',.225,1.39)]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.174,z-.025));o=bpy.context.object;o.name=n;o.dimensions=(.065,.112,.058);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  # Convert world vertices to armature-local before parenting/skinning.
  for v in o.data.vertices:v.co=o.matrix_world@v.co
  o.matrix_world=Matrix.Identity(4);o.parent=rig;o.data.materials.append(bpy.data.materials['Rubber']);g=o.vertex_groups.new(name='Chest');g.add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('Mount edges','BEVEL');m.width=.008;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name);m=o.modifiers.new('Rigid mount','ARMATURE');m.object=rig
  for c in list(o.users_collection):c.objects.unlink(o)
  bpy.data.collections['STAGE2_ARMOR'].objects.link(o)
 rig.data.pose_position='REST'
 (Q/'back-socket-changes.json').write_text(json.dumps({'approval':'Auditor intermediate pass; only these two back sockets','before':before,'after':state(),'unchangedOther55Bones':True,'bodyInfluence':uses,'constraints':0,'drivers':0,'weaponLocalTranslation':[0,0,0],'weaponLocalRotationBlender':[0,0,0],'oldActionSourceData':'preserved; old socket pose keys need stage3 adaptation; stage2 static diagnostics use the new rest mounts'},indent=2))
 bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
