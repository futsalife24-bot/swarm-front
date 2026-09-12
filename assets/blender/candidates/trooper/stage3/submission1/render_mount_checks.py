import bpy,sys,importlib.util,math,bmesh
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent;sys.argv.extend(['--source','../stage3/trooper_stage3_animated.blend']);sp=importlib.util.spec_from_file_location('p',Q.parent/'stage2/render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p);p.Q=Q;p.s.render.resolution_x=720;p.s.render.resolution_y=800;p.s.cycles.samples=16
visibility={o.name:o.hide_render for o in bpy.data.objects if o.type=='MESH'}
def restore():
 for n,h in visibility.items():bpy.data.objects[n].hide_render=h
 for b in p.rig.pose.bones:b.rotation_mode='QUATERNION'
def racks():
 for kind,bn in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:p.weapons[kind].hide_render=False;p.weapons[kind].matrix_world=p.rig.matrix_world@p.rig.pose.bones[bn].matrix
p.reset();racks();p.render('mount_final_normal',(5,-.3,1.35),(0,-.12,1.30),1.25);p.render('mount_final_back',(-3,-6,2.2),(0,-.15,1.3),1.4)
for o in bpy.data.objects:
 if o.type=='MESH' and not o.name.startswith('Weapon'):o.hide_render=visibility.get(o.name,True) or o.name not in ['Helmet','Boots']
body=bpy.data.objects['Study_Body'];mesh=body.data.copy();ob=bpy.data.objects.new('Diagnostic_half_body',mesh);p.s.collection.objects.link(ob);bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(.01,0,0),plane_no=(1,0,0),clear_outer=True,clear_inner=False);bm.to_mesh(mesh);bm.free();p.render('mount_final_cutaway',(5,-.3,1.35),(0,-.12,1.30),1.25);ob.hide_render=True;restore()
p.sample('Trial_Switch_1_to_2',27);racks();gun=p.rig.pose.bones['RightHandWeaponSocket'].matrix.copy();p.render('mount_final_reach',(-3,-6,2.4));p.render('mount_final_reach_side',(5,-.3,1.7),(0,-.15,1.4),1.3)
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=o.name not in ['Study_Glove_R','Weapon_rifle']
for view,delta in [('outer',(.5,.3,-.2)),('opposite',(-.5,.3,-.2)),('thumb',(-.5,-.3,-.1))]:p.render('mount_final_grip_'+view,gun@Vector(delta),gun@Vector((0,-.01,-.07)),.38)
restore();ob.hide_render=True;p.reset()
for name,angle in [('Spine',-.4),('SpineMid',-.45),('Chest',-.4),('UpperLeg_L',1.4),('UpperLeg_R',1.4),('LowerLeg_L',-2),('LowerLeg_R',-2),('UpperArm_L',.6),('UpperArm_R',.6),('LowerArm_L',1.7),('LowerArm_R',1.7)]:b=p.rig.pose.bones[name];b.rotation_mode='XYZ';b.rotation_euler.x=angle
bpy.context.view_layer.update();p.back_rest();racks();p.render('mount_final_tuck_side',(5,0,1.7));p.render('mount_final_tuck_back',(-3,-5,2.5))
restore();ob.hide_render=True;p.sample('Trial_Switch_1_to_2',0);p.equip('rifle','rocket');p.render('mount_final_rifle_held',(3,6,2.8));target=p.rig.pose.bones['Hand_L'].head.copy();p.render('mount_final_left_support',target+Vector((-1,.8,.3)),target,.48)
print('MOUNT CHECKS COMPLETE')
