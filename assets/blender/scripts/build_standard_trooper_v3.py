"""Standard Trooper authoring source. Blender 5.2; metres, +Y forward, Z up.
Rebuild only this character's files; no preferences, gameplay or other assets touched.
"""
from pathlib import Path
import bpy, math, json, random
from mathutils import Vector, Matrix, Quaternion

REPO=Path(__file__).resolve().parents[3]
OUT=REPO/'public/assets/characters'; OUT.mkdir(parents=True,exist_ok=True)
QA=REPO/'dist-validation/trooper-polish'; QA.mkdir(parents=True,exist_ok=True)
SOURCE=REPO/'assets/blender/source/standard_trooper_v3.blend'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.fps=60
cols={}
for n in ['CHARACTER','ARMATURE','ARMOR','GEAR','WEAPONS','ANIMATION','REFERENCE']:
 c=bpy.data.collections.new(n); scene.collection.children.link(c); cols[n]=c
root=bpy.data.objects.new('STANDARD_TROOPER',None); cols['CHARACTER'].objects.link(root)
root['design']='STANDARD TROOPER concept supplied 2026-09-10; modular standard infantry'
root['units']='metres; glTF Y up, forward -Z, feet at zero'

def mat(name,color,rough,metal):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 # Packed, UV-addressed PBR micro-surface map. Normal maps are exported by glTF.
 im=bpy.data.images.new(name+'_Normal',width=256,height=256);im.colorspace_settings.name='Non-Color'
 rng=random.Random(21);pixels=[]
 for y in range(256):
  for x in range(256):
   a=(.075 if name=='Cloth' else .006);v=a*math.sin(x*math.pi/2);w=a*math.cos(y*math.pi/2)
   pixels.extend([.5+v,.5+w,1,1])
 im.pixels=pixels;im.pack();tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im
 normal=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 # Deterministic fabric camouflage and subtle manufacturing wear in real PBR maps.
 size=512;imc=bpy.data.images.new(name+'_BaseColor',width=size,height=size);imr=bpy.data.images.new(name+'_Roughness',width=size,height=size);imr.colorspace_settings.name='Non-Color'
 cp=[];rp=[];rng=random.Random(117)
 for y in range(size):
  for x in range(size):
   noise=rng.random();wave=math.sin(x*.073+math.sin(y*.093)*2)+math.cos(y*.087+math.sin(x*.047)*3)+.4*math.cos((x+y)*.18)
   fac=(.82 if wave<-.6 else 1.0 if wave<.8 else 1.20) if name=='Cloth' else 1+(.018*(noise-.5))
   scratch=name in ['Armor','Metal'] and (x*17+y*31)%197<2 and noise>.78
   c=tuple(min(1,max(0,v*fac*(.54 if scratch else 1))) for v in color)
   # Linear color -> image sRGB, preserving physically authored base color.
   cp.extend([*(12.92*v if v<.0031308 else 1.055*v**(1/2.4)-.055 for v in c),1]);rr=max(0,min(1,rough+(noise-.5)*.08));rp.extend([rr,rr,rr,1])
 imc.pixels=cp;imc.pack();imr.pixels=rp;imr.pack()
 for imt,socket in [(imc,'Base Color'),(imr,'Roughness')]:
  node=nt.nodes.new('ShaderNodeTexImage');node.image=imt;nt.links.new(node.outputs['Color'],bs.inputs[socket])
 return m
M={n:mat(n,c,r,m) for n,c,r,m in [('Armor',(.32,.365,.37),.48,.12),('Cloth',(.042,.052,.046),.91,0),('Rubber',(.024,.03,.028),.78,0),('Metal',(.12,.145,.14),.32,.8),('Visor',(.16,.105,.025),.16,.72),('Orange',(.95,.28,.035),.46,.22)]}
parts=[]; current_group='Body';current_bone='Pelvis'; weapon_parts=[]; weapon_mode=False
def finish(o,n,material):
 o.name=n;o.data.materials.append(M[material]);
 for c in list(o.users_collection):c.objects.unlink(o)
 cols['WEAPONS' if weapon_mode else 'ARMOR' if 'Armor' in current_group or current_group=='Helmet' else 'GEAR' if current_group in ['Backpack','UtilityGear','Boots'] else 'CHARACTER'].objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not weapon_mode:
  g=o.vertex_groups.new(name=current_bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');o['component']=current_group;parts.append(o)
  # Blend only fabric near articulations. Hard plates retain one-bone weights.
  if n.startswith(('Body_thigh_','Body_calf_','Body_bicep_','Body_forearm_')):
   label=n[-1];hip,knee,ankle,shoulder,elbow,wrist=joints[label]
   neighbours=([(hip,'Pelvis'),(knee,'LowerLeg_'+label)] if n.startswith('Body_thigh') else [(knee,'UpperLeg_'+label),(ankle,'Foot_'+label)] if n.startswith('Body_calf') else [(shoulder,'Clavicle_'+label),(elbow,'LowerArm_'+label)] if n.startswith('Body_bicep') else [(elbow,'UpperArm_'+label),(wrist,'Hand_'+label)])
   for center,bn in neighbours:
    vg=o.vertex_groups.new(name=bn)
    for v in o.data.vertices:
     d=(o.matrix_world@v.co-center).length
     if d<.095:
      w=.5*(1-d/.095);g.add([v.index],1-w,'REPLACE');vg.add([v.index],w,'REPLACE')
 else:weapon_parts.append(o)
 o.select_set(False);return o
def box(n,p,s,ma='Armor',bevel=.015,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s;o.rotation_euler=rot
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Manufactured edge bevel','BEVEL');mod.width=bevel;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,ma)
def panel(n,p,w,h,depth,ma='Armor',taper=.78):
 # Eight-sided tapered hard-surface panel, with recessed silhouette corners.
 outline=[(-w*.5,-h*.28),(-w*.5,h*.28),(-w*.33,h*.5),(w*.33,h*.5),(w*.5,h*.28),(w*.5,-h*.28),(w*taper*.34,-h*.5),(-w*taper*.34,-h*.5)]
 verts=[(p[0]+x,p[1]+y,p[2]+z) for y in [-depth/2,depth/2] for x,z in outline];faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True);mod=o.modifiers.new('Panel edge','BEVEL');mod.width=.005;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,ma)
def ell(n,p,s,ma='Cloth'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=p);o=bpy.context.object;o.scale=s
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,n,ma)
def rod(n,a,b,r,ma='Metal',vertices=10):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return finish(o,n,ma)
def loft(n,rings,ma='Armor',segments=12):
 verts=[]
 for z,rx,ry,cy in rings:
  verts.extend([(rx*math.sin(i*math.tau/segments),cy+ry*math.cos(i*math.tau/segments),z) for i in range(segments)])
 faces=[tuple(reversed(range(segments)))]
 for j in range(len(rings)-1):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o);return finish(o,n,ma)
def mark(p,scale=1,bone=None):
 # Inlaid double-chevron insignia, model geometry rather than font dependency.
 for s in [-1,1]:rod('Unit_chevron', (p[0]+s*.034*scale,p[1],p[2]+.025*scale),(p[0],p[1],p[2]-.026*scale),.008*scale,'Metal',4)

# Anatomy and armor follow a common symmetric parameter set; no separate left/right authoring.
current_bone='Pelvis';ell('Body_pelvis',(0,0,.91),(.235,.135,.17))
current_bone='Spine';loft('Body_abdomen',[(.94,.19,.12,0),(1.1,.175,.125,0),(1.25,.23,.145,0)],'Cloth')
current_bone='Chest';loft('Body_thorax',[(1.15,.22,.14,0),(1.40,.285,.15,0),(1.48,.22,.12,0)],'Cloth')
current_group='ChestArmor'
loft('Chest_carrier',[(1.13,.22,.155,0),(1.34,.285,.175,0),(1.45,.23,.135,0)],'Rubber')
panel('Chest_main_plate',(0,.168,1.325),.345,.245,.067);mark((0,.205,1.35),1.5)
for x in [-.137,.137]:
 for z in [1.26,1.39]:rod('Chest_plate_fastener',(x,.202,z),(x,.209,z),.008,'Metal',8)
for x in [-.26,.26]:
 panel('Chest_lateral_panel',(x,.119,1.295),.073,.183,.065,'Metal')
 box('Chest_side_webbing',(x,.162,1.27),(.058,.021,.031),'Rubber',.003)
box('Chest_orange_identifier',(.15,.207,1.24),(.024,.006,.07),'Orange',.003)
for x in [-.21,.21]:
 box('Chest_harness',(x,.126,1.43),(.056,.065,.16),'Metal',.01,rot=(0,x*.7,0))
 box('Chest_harness_buckle',(x,.165,1.45),(.044,.025,.05),'Armor',.005)
current_bone='Spine'
for z,w in [(1.085,.19),(1.135,.22),(1.18,.24)]:panel('Abdominal_segment',(0,.143,z),w,.049,.038,'Metal')
for x in [-.096,0,.096]:
 box('Carrier_magazine_pouch',(x,.192,1.14),(.081,.075,.115),'Cloth',.008)
 box('Carrier_pouch_flap',(x,.235,1.183),(.077,.015,.027),'Rubber',.004)
current_bone='Neck';current_group='Body';rod('Neck_seal',(0,0,1.44),(0,0,1.6),.091,'Rubber',16)
current_bone='Chest';current_group='ChestArmor';loft('Armored_collar',[(1.455,.135,.125,0),(1.52,.128,.112,0),(1.548,.105,.098,0)],'Metal',16)
current_group='Helmet';current_bone='Head'
loft('Helmet_shell',[(1.56,.105,.11,0),(1.64,.148,.146,-.005),(1.77,.158,.14,-.01),(1.84,.10,.10,-.02),(1.865,.05,.055,-.02)],'Armor',32)
# Wide wrap-around gold smoked visor with separate brow and protective jaw.
verts=[];faces=[]
for z,rx,ry in [(1.615,.10,.125),(1.705,.145,.157),(1.75,.144,.157)]:
 for i in range(13):a=-1.19+2.38*i/12;verts.append((rx*math.sin(a),.012+ry*math.cos(a),z))
for j in range(2):
 for i in range(12):a=j*13+i;faces.append((a,a+1,a+14,a+13))
me=bpy.data.meshes.new('Visor_wrap');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Visor_wrap',me);scene.collection.objects.link(o);finish(o,'Visor_wrap','Visor')
box('Helmet_brow',(0,.137,1.763),(.242,.055,.028),'Rubber',.009)
box('Helmet_crown_inset',(0,-.007,1.84),(.066,.19,.031),'Metal',.012)
box('Helmet_crown_stripe',(.038,.027,1.855),(.016,.14,.012),'Orange',.003)
box('Helmet_rear_battery',(0,-.141,1.715),(.13,.039,.076),'Metal',.011)
for s in [-1,1]:
 box('Helmet_rear_seam',(s*.082,-.12,1.752),(.008,.018,.09),'Rubber',.002,rot=(0,s*.28,0))
 box('Helmet_temple_inset',(s*.125,.043,1.783),(.048,.088,.023),'Metal',.008,rot=(0,s*.45,0))
 rod('Helmet_temporal_rivet',(s*.132,.09,1.771),(s*.137,.096,1.773),.009,'Metal',8)
box('Helmet_chin_guard',(0,.105,1.596),(.085,.08,.041),'Metal',.012)
for s in [-1,1]:
 rod('Helmet_jaw_rail',(s*.111,.119,1.698),(s*.045,.148,1.6),.019,'Armor')
 rod('Headset_earcup',(s*.14,-.006,1.698),(s*.181,-.006,1.698),.065,'Rubber',16)
 rod('Headset_ear_inset',(s*.18,-.006,1.698),(s*.187,-.006,1.698),.044,'Metal',12)
 rod('Headset_orange_ring',(s*.188,-.006,1.698),(s*.19,-.006,1.698),.02,'Orange',10)
 box('Helmet_cheek_vent',(s*.125,.085,1.62),(.023,.047,.02),'Rubber',.003)
 for z in [1.792,1.813]:box('Helmet_side_vent',(s*.126,-.013,z),(.016,.066,.009),'Metal',.002)
rod('Comms_boom',(.174,.008,1.663),(.087,.155,1.594),.008,'Metal',8)

joints={}
for s,label in [(-1,'L'),(1,'R')]:
 hip=Vector((s*.135,0,.94));knee=Vector((s*.15,.025,.53));ankle=Vector((s*.15,0,.115))
 shoulder=Vector((s*.275,0,1.43));elbow=Vector((s*.365,.015,1.155));wrist=Vector((s*.395,.045,.895))
 joints[label]=(hip,knee,ankle,shoulder,elbow,wrist)
 current_group='Body';current_bone='UpperLeg_'+label;ell('Body_thigh_'+label,(hip+knee)/2,(.108,.109,.23))
 current_bone='LowerLeg_'+label;ell('Body_calf_'+label,(knee+ankle)/2,(.081,.08,.217))
 current_bone='UpperArm_'+label;ell('Body_bicep_'+label,(shoulder+elbow)/2,(.081,.077,.16))
 current_bone='LowerArm_'+label;ell('Body_forearm_'+label,(elbow+wrist)/2,(.07,.07,.15))
 current_group='ShoulderArmor';current_bone='UpperArm_'+label
 ell('Shoulder_floating_pad_'+label,shoulder+Vector((s*.018,0,-.025)),(.114,.107,.10),'Rubber')
 box('Shoulder_plate_'+label,(s*.325,.018,1.398),(.103,.195,.157),'Armor',.031,rot=(0,s*-.29,0))
 box('Shoulder_orange_edge_'+label,(s*.378,.014,1.406),(.012,.12,.078),'Orange',.004)
 for y in [-.055,.072]:rod('Shoulder_fastener_'+label,(s*.369,y,1.435),(s*.381,y,1.435),.009,'Metal',8)
 current_group='ArmArmor';current_bone='LowerArm_'+label
 panel('Forearm_plate_'+label,(s*.391,.069,1.019),.12,.202,.087)
 box('Forearm_recess_'+label,(s*.39,.116,1.022),(.025,.008,.13),'Metal',.004)
 box('Forearm_rank_'+label,(s*.354,.117,1.09),(.018,.009,.038),'Orange',.003)
 ell('Elbow_joint_'+label,elbow,(.076,.074,.073),'Rubber')
 for z in [.954,1.078]:box('Forearm_strap_'+label,(s*.392,0,z),(.143,.095,.03),'Rubber',.008)
 current_group='Body';current_bone='Hand_'+label
 box('Glove_palm_'+label,(s*.4,.054,.861),(.079,.075,.09),'Rubber',.022)
 for k in range(4):box('Glove_finger_'+label,(s*(.374+k*.017),.072,.802),(.016,.05,.041),'Cloth',.007)
 box('Glove_thumb_'+label,(s*.35,.071,.856),(.034,.039,.055),'Rubber',.012,rot=(0,s*.45,0))
 box('Glove_knuckles_'+label,(s*.4,.011,.852),(.064,.013,.039),'Metal',.004)
 current_group='LegArmor';current_bone='UpperLeg_'+label
 panel('Thigh_plate_'+label,(s*.165,.096,.74),.157,.253,.07)
 panel('Thigh_inset_'+label,(s*.165,.135,.75),.055,.146,.007,'Metal')
 for x in [s*.11,s*.214]:
  for z in [.665,.815]:rod('Thigh_rivet_'+label,(x,.133,z),(x,.139,z),.006,'Metal',8)
 box('Thigh_orange_rail_'+label,(s*.228,.133,.762),(.015,.01,.16),'Orange',.003)
 for z in [.67,.84]:box('Thigh_wrap_'+label,(s*.15,-.002,z),(.224,.224,.029),'Rubber',.009)
 current_bone='LowerLeg_'+label
 ell('Knee_flex_seal_'+label,knee,(.089,.083,.075),'Rubber')
 panel('Knee_shield_'+label,(s*.151,.114,.527),.145,.136,.078)
 box('Knee_indicator_'+label,(s*.2,.157,.54),(.013,.009,.045),'Orange',.003)
 panel('Shin_plate_'+label,(s*.15,.067,.311),.127,.276,.086)
 box('Shin_channel_'+label,(s*.15,.115,.31),(.038,.009,.18),'Metal',.008)
 box('Calf_rear_guard_'+label,(s*.15,-.065,.34),(.114,.043,.21),'Metal',.016)
 for z in [.25,.4]:box('Calf_strap_'+label,(s*.15,-.015,z),(.17,.17,.023),'Rubber',.005)
 current_group='Boots';current_bone='Foot_'+label
 box('Boot_sole_'+label,(s*.15,.073,.034),(.181,.321,.067),'Rubber',.023)
 box('Boot_upper_'+label,(s*.15,.068,.1),(.155,.265,.127),'Cloth',.038)
 box('Boot_toecap_'+label,(s*.15,.174,.085),(.151,.095,.071),'Metal',.019)
 box('Boot_ankle_guard_'+label,(s*.15,-.013,.149),(.163,.131,.112),'Rubber',.024)
 for y in [.065,.097,.127]:box('Boot_lace_'+label,(s*.15,y,.165),(.11,.016,.009),'Metal',.003)
 for y in [-.059,.0,.065,.14,.205]:box('Boot_tread_'+label,(s*.15,y,.015),(.181,.031,.027),'Rubber',.004)
current_group='Backpack';current_bone='Chest'
box('Backpack_frame',(0,-.181,1.274),(.372,.14,.405),'Metal',.035)
box('Backpack_fabric',(0,-.247,1.283),(.325,.126,.36),'Cloth',.039)
box('Backpack_panel',(0,-.321,1.304),(.254,.033,.258),'Armor',.028)
box('Backpack_service_pouch',(0,-.347,1.152),(.175,.06,.107),'Rubber',.011)
for s in [-1,1]:
 box('Backpack_orange_rail',(s*.156,-.317,1.286),(.018,.027,.30),'Orange',.004)
 box('Backpack_side_pouch',(s*.212,-.213,1.22),(.074,.15,.202),'Cloth',.012)
 for z in [1.13,1.38]:box('Backpack_clamp',(s*.158,-.323,z),(.042,.021,.043),'Metal',.005)
rod('Backpack_top_handle',(-.09,-.22,1.497),(.09,-.22,1.497),.016,'Rubber')
box('Radio_housing',(.206,-.19,1.434),(.07,.09,.115),'Rubber',.008)
rod('Radio_antenna',(.21,-.19,1.477),(.21,-.19,1.77),.006,'Metal',8)
# Two separated mounts let a holstered and a still-stowed weapon coexist at handoff.
for x,y in [(.18,-.43),(.37,-.35)]:box('Back_weapon_mount',(x,y,1.40),(.055,.09,.09),'Metal',.008)
current_group='UtilityGear';current_bone='Pelvis'
box('Utility_belt',(0,0,.958),(.458,.312,.068),'Rubber',.018)
box('Belt_buckle',(0,.163,.961),(.084,.021,.052),'Metal',.005)
for x in [-.172,-.085,.085,.172]:
 box('Belt_ammo_pouch',(x,.164,.985),(.068,.069,.114),'Cloth',.01)
 box('Pouch_flap',(x,.205,1.021),(.063,.013,.035),'Metal',.004)
for s,label in [(-1,'L'),(1,'R')]:
 current_bone='UpperLeg_'+label
 box('Thigh_utility_pouch',(s*.266,-.009,.798),(.08,.117,.154),'Cloth',.014)
 box('Pouch_clasp',(s*.31,.008,.802),(.009,.041,.048),'Metal',.004)

exec(compile((REPO/'assets/blender/scripts/trooper_v3_details.py').read_text(), 'trooper_v3_details.py', 'exec'), globals())

# Real deform skeleton, no constraints required at runtime.
ad=bpy.data.armatures.new('StandardHumanoid');rig=bpy.data.objects.new('STANDARD_TROOPER_RIG',ad);cols['ARMATURE'].objects.link(rig);rig.parent=root;rig.show_in_front=True
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(n,a,b,parent=None):
 p=ad.edit_bones.new(n);p.head=a;p.tail=b
 if parent:p.parent=ad.edit_bones[parent]
bone('Root',(0,0,0),(0,0,.15));bone('Pelvis',(0,0,.94),(0,0,1.06),'Root');bone('Spine',(0,0,1.06),(0,0,1.25),'Pelvis');bone('Chest',(0,0,1.25),(0,0,1.46),'Spine');bone('Neck',(0,0,1.46),(0,0,1.59),'Chest');bone('Head',(0,0,1.59),(0,0,1.83),'Neck')
for label,(hip,knee,ankle,shoulder,elbow,wrist) in joints.items():
 bone('UpperLeg_'+label,hip,knee,'Pelvis');bone('LowerLeg_'+label,knee,ankle,'UpperLeg_'+label);bone('Foot_'+label,ankle,ankle+Vector((0,.16,-.035)),'LowerLeg_'+label)
 bone('Clavicle_'+label,(0,0,1.43),shoulder,'Chest');bone('UpperArm_'+label,shoulder,elbow,'Clavicle_'+label);bone('LowerArm_'+label,elbow,wrist,'UpperArm_'+label);bone('Hand_'+label,wrist,wrist+Vector((0,0,-.10)),'LowerArm_'+label)
bone('RightHandWeaponSocket',joints['R'][5],joints['R'][5]+Vector((0,.1,0)),'Hand_R')
bone('LeftHandSupportSocket',joints['L'][5],joints['L'][5]+Vector((0,.1,0)),'Hand_L')
bone('BackWeaponSocket',(.18,-.46,1.4),(.18,-.36,1.4),'Chest')
bone('BackWeaponSocket_2',(.37,-.38,1.4),(.37,-.28,1.4),'Chest')
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
rest={b.name:b.matrix_local.copy() for b in ad.bones}
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
# Join by component and retain named vertex groups for rigid armor. UV every mesh.
meshes=[]
groups={name:[o for o in parts if o['component']==name] for name in sorted(set(o['component'] for o in parts))}
for name,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;o.data.name=name+'_Mesh'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 mod=o.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;o.parent=rig;meshes.append(o)
 o['weight_policy']='rigid armor panels; fabric blends at shoulder/elbow/wrist/hip/knee/ankle'

exec(compile((REPO/'assets/blender/scripts/trooper_v3_ao.py').read_text(), 'trooper_v3_ao.py', 'exec'), globals())

# Reusable weapon objects: local origin is trigger hand; +Y barrel, +Z up.
weapon_mode=True
for kind in ['rifle','shotgun','rocket']:
 weapon_parts=[]
 if kind!='rocket':
  box(kind+'_receiver',(0,.07,.035),(.067,.30,.10),'Metal',.008)
  box(kind+'_stock',(0,-.20,.05),(.065,.23,.105),'Rubber',.012)
  box(kind+'_grip',(0,-.014,-.068),(.05,.067,.115),'Rubber',.009,rot=(.24,0,0))
  box(kind+'_handguard',(0,.30,.035),(.075,.20,.083),'Rubber',.008)
  rod(kind+'_barrel',(0,.38,.043),(0,.64 if kind=='rifle' else .58,.043),.018 if kind=='rifle' else .025,'Metal',12)
  rod(kind+'_muzzle',(0,.59 if kind=='rifle' else .53,.043),(0,.66 if kind=='rifle' else .60,.043),.024 if kind=='rifle' else .03,'Metal',12)
  if kind=='rifle':box('Rifle_magazine',(0,.102,-.099),(.047,.089,.162),'Metal',.009,rot=(-.15,0,0))
  else:rod('Shotgun_magazine_tube',(0,.16,-.006),(0,.51,-.006),.017,'Metal')
  for y in [.18,.22,.26,.30,.34,.38]:box('Handguard_rail',(0,y,.084),(.09,.018,.015),'Metal',.002)
  box('Optic_mount',(0,.076,.116),(.045,.076,.047),'Rubber',.005)
  box('Optic_lens',(0,.117,.117),(.026,.008,.026),'Visor',.003)
  box('Weapon_identifier',(.039,.26,.04),(.007,.081,.02),'Orange',.002)
 else:
  rod('Launcher_tube',(0,-.30,.09),(0,.59,.09),.092,'Metal',16)
  rod('Launcher_rear_shield',(0,-.31,.09),(0,-.23,.09),.111,'Rubber',16)
  rod('Launcher_front_shield',(0,.48,.09),(0,.60,.09),.103,'Rubber',16)
  rod('Launcher_bore',(0,.601,.09),(0,.607,.09),.078,'Rubber',16)
  box('Launcher_trigger',(0,0,-.045),(.052,.068,.15),'Rubber',.01)
  box('Launcher_support',(0,.28,-.045),(.06,.065,.15),'Rubber',.01)
  box('Launcher_sight',(.108,.18,.16),(.057,.12,.067),'Metal',.008)
  for y in [-.20,.45]:rod('Launcher_warning_band',(0,y,.09),(0,y+.025,.09),.094,'Orange',16)
 bpy.ops.object.select_all(action='DESELECT')
 for o in weapon_parts:o.select_set(True)
 bpy.context.view_layer.objects.active=weapon_parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='Weapon_'+kind;o.data.name='Weapon_'+kind+'_Mesh'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 bpy.ops.export_scene.gltf(filepath=str(OUT/('standard_'+kind+'_v3.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
 o.hide_render=True;o.hide_set(True)

def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
def around(center,shift=(0,0,0),q=None):return Matrix.Translation(Vector(center)+Vector(shift))@(q or Quaternion()).to_matrix().to_4x4()@Matrix.Translation(-Vector(center))
def align(n,a,b):return Matrix.Translation(a)@(rest[n].to_3x3()@Vector((0,1,0))).rotation_difference(Vector(b)-Vector(a)).to_matrix().to_4x4()@rest[n].to_3x3().to_4x4()
def ik(a,target,l1,l2,pole):
 d=target-a;length=min(d.length,l1+l2-.0001);axis=d.normalized();along=(l1*l1-l2*l2+length*length)/(2*length);h=math.sqrt(max(0,l1*l1-along*along));v=Vector(pole)-axis*Vector(pole).dot(axis);return a+axis*along+v.normalized()*h,a+axis*length
def setm(n,m):rig.pose.bones[n].matrix=m;bpy.context.view_layer.update()

def run_curve(t,keys):
 # Hermite keys (phase,value,slope): preserve velocity through contact and
 # takeoff instead of easing to a stop at every pose.
 for (a,x,m),(b,y,n) in zip(keys,keys[1:]):
  if a<=t<=b:
   u=(t-a)/(b-a)
   return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*(b-a)*m+(-2*u**3+3*u*u)*y+(u**3-u*u)*(b-a)*n
 return keys[-1][1]

def run_foot(phase,label,ankle,backward=False):
 q=(phase+(.5 if label=='L' else 0))%1
 # Compact combat stride: land under the body, brief flight, low recovery.
 y=run_curve(q,[(0,.17,-1.67),(.36,-.431,-1.67),(.44,-.47,0),(.60,-.16,2.6),(.77,.25,1.3),(.88,.31,0),(1,.17,-1.67)])
 clearance=run_curve(q,[(0,0,0),(.36,0,0),(.49,.17,1.5),(.63,.23,0),(.77,.15,-1),(.9,.075,-1.0),(1,0,0)])
 angle=run_curve(q,[(0,-.06,0),(.10,0,0),(.25,-.12,-1.2),(.36,-.45,-2),(.49,-.72,0),(.69,-.22,2),(.88,.04,0),(1,-.06,0)])
 if backward:y=-y;angle=-angle*.65
 rotation=Quaternion((1,0,0),angle).to_matrix()
 # The exact boot vertex cloud keeps toe roll planted without sinking the
 # rigid sole; swing height is clearance above the same rotated sole.
 boot=next(o for o in meshes if o.name=='Boots')
 group=boot.vertex_groups['Foot_'+label].index
 bottom=min((rotation@(v.co-ankle)).z for v in boot.data.vertices if any(g.group==group and g.weight>.99 for g in v.groups))
 target=Vector((ankle.x,y,-bottom+max(0,clearance)+.002))
 return target,rotation

def pose(name,t,duration):
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 phase=t/duration;shift=Vector((0,0,0));pitch=0;recoil=0;running=name.startswith('Run');backward='Backward' in name
 if name=='Idle':shift.z=.003*math.sin(phase*math.tau)
 if name.startswith('Weapon_Idle'):shift.z=.003*math.sin(phase*math.tau)
 if name.endswith('Rocket'):shift.z-=.075
 if running:
  # Contact -> compression -> push -> airborne apex -> opposite contact.
  step_phase=phase%.5
  shift.z=run_curve(step_phase,[(0,-.045,-.2),(.14,-.075,0),(.36,-.039,.24),(.43,-.019,0),(.5,-.045,-.2)])
  pitch=-.18 if backward else -.30
 if name.startswith('Fire_'):
  recoil=math.sin(math.pi*min(1,phase/.3)) if phase<.3 else 0
  recoil+=(1-smooth((phase-.3)/.7))*.14 if phase>=.3 else 0
  recoil*=.017 if name=='Fire_Rifle' else .075 if name=='Fire_Shotgun' else .10
  shift.y=-recoil;pitch=recoil*.7;shift.z=-recoil*.25
 tuck=math.sin(math.pi*phase)**2 if name.startswith('Dodge') else 0
 if name.startswith('Dodge'):shift.z=-.04*tuck+.07*math.sqrt(max(0,math.sin(math.pi*phase)));pitch=-math.tau*phase
 if name=='Hit_Heavy':
  shift.z=.20*math.sin(math.pi*min(1,phase/.58)) if phase<.58 else -.32*math.sin(math.pi*(phase-.58)/.42)
  pitch=.9*math.sin(math.pi*phase)**2;shift.y=-.28*math.sin(math.pi*phase)**2
 B=around((0,0,.94),shift,Quaternion((1,0,0),pitch))
 U=B@around((0,0,1.06),q=Quaternion((1,0,0),-.95*tuck))
 if name.startswith('Fire_'):
  B=around((0,0,.94),(0,0,-.075 if name.endswith('Rocket') else 0))
  U=B@around((0,0,1.06),(0,-recoil,-recoil*.25),Quaternion((1,0,0),recoil*.7))
 setm('Pelvis',B@rest['Pelvis'])
 for n in ['Spine','Chest','Neck','Head']:setm(n,U@rest[n])
 if running:
  # Keep the gaze level above the leaning chest, rather than staring down.
  H=rest['Head'].copy();H.translation=U@rest['Head'].translation;setm('Head',H)
 for label,(hip,knee,ankle,shoulder,elbow,wrist) in joints.items():
  s=-1 if label=='L' else 1;h=B@hip;target=ankle.copy()
  if running:target,foot_rotation=run_foot(phase,label,ankle,backward)
  if name.startswith('Dodge'):target=B@(ankle+Vector((0,.29*tuck,.51*tuck)))
  if name=='Hit_Heavy':target=B@ankle if phase<.58 else ankle
  k,end=ik(h,target,(knee-hip).length,(ankle-knee).length,B.to_3x3()@Vector((0,1,0)))
  setm('UpperLeg_'+label,align('UpperLeg_'+label,h,k));setm('LowerLeg_'+label,align('LowerLeg_'+label,k,end))
  setm('Foot_'+label,Matrix.Translation(end)@(foot_rotation.to_4x4() if running else B.to_3x3().to_4x4() if name.startswith('Dodge') or name=='Hit_Heavy' and phase<.58 else Matrix.Identity(4))@rest['Foot_'+label].to_3x3().to_4x4())
  protract=-.75 if label=='L' and name!='Idle' else 0
  C=U@around((0,0,1.43),q=Quaternion((0,0,1),protract))
  setm('Clavicle_'+label,C@rest['Clavicle_'+label]);a=C@shoulder
  # Trigger and fore-end grips. Launcher uses a wider, lower braced stance.
  grip=Vector((.235,.255,1.325)) if label=='R' else Vector((.235,.49,1.34))
  if name=='Idle':grip=Vector((s*.35,.14,1.04))
  if name.endswith('Rocket'):grip=Vector((.245,.225,1.39)) if label=='R' else Vector((.245,.49,1.36))
  grip.y-=recoil*.3
  if name.startswith('Switch'):
   # The trigger hand carries the old gun round the outer shoulder to its rack,
   # releases, crosses behind the helmet, grips the other rack, then returns.
   old=(.18,-.46,1.4) if name=='Switch_1_to_2' else (.37,-.38,1.4);new=(.37,-.38,1.4) if name=='Switch_1_to_2' else (.18,-.46,1.4)
   path=[(0,(.235,.255,1.325)),(.18,(.46,.20,1.24)),(.36,(.59,-.18,1.43)),(.45,old),(.52,(.40,-.37,1.52)),(.60,new),(.76,(.59,-.18,1.43)),(1,(.235,.255,1.325))]
   if label=='R':
    for (ta,pa),(tb,pb) in zip(path,path[1:]):
     if ta<=phase<=tb:grip=Vector(pa).lerp(Vector(pb),smooth((phase-ta)/(tb-ta)));break
   else:grip=grip.lerp(Vector((-.34,.23,1.14)),math.sin(math.pi*phase)**.5)
  if name.startswith('Dodge'):grip=grip.lerp(Vector((s*.20,.20,1.23)),tuck)
  target=grip+Vector((0,.075,shift.z+.01)) if running else U@grip
  k,end=ik(a,target,(elbow-shoulder).length,(wrist-elbow).length,U.to_3x3()@Vector((s,-.4,-.35)))
  setm('UpperArm_'+label,align('UpperArm_'+label,a,k));setm('LowerArm_'+label,align('LowerArm_'+label,k,end))
  # Closed gripping hand points down; socket coordinates retain barrel +Y.
  H=(Matrix.Identity(4) if running else U.to_3x3().to_4x4())@(Quaternion((1,0,0),math.pi).to_matrix().to_4x4() if label=='L' and name!='Idle' else Matrix.Identity(4))@rest['Hand_'+label].to_3x3().to_4x4();H.translation=end;setm('Hand_'+label,H)
  socket='RightHandWeaponSocket' if label=='R' else 'LeftHandSupportSocket'
  S=Matrix.Identity(4) if running else U.to_3x3().to_4x4();S.translation=end
  if name.startswith('Switch') and label=='R':
   ang=-math.pi/2*smooth(phase/.36)*(1-smooth((phase-.70)/.30));S=S@Quaternion((1,0,0),ang).to_matrix().to_4x4()
  setm(socket,S)
 for n in ['BackWeaponSocket','BackWeaponSocket_2']:
  S=U@Matrix.Translation(rest[n].translation)@Quaternion((1,0,0),-math.pi/2).to_matrix().to_4x4();setm(n,S)

clips={'Idle':3,'Weapon_Idle_Rifle':3,'Weapon_Idle_Shotgun':3,'Weapon_Idle_Rocket':3,'Run':.64,'Fire_Rifle':.13,'Fire_Shotgun':.8,'Fire_Rocket':1.15,'Switch_1_to_2':1,'Switch_2_to_1':1,'Dodge_Roll':1/3,'Hit_Heavy':1.2}
clips.update({'Run_Rocket':.64,'Run_Backward':.64,'Run_Backward_Rocket':.64})
rig.animation_data_create()
for name,duration in clips.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action;frames=round(duration*60)
 for f in range(frames+1):
  scene.frame_set(f);pose(name,duration*f/frames,duration)
  for b in rig.pose.bones:
   b.keyframe_insert('location',frame=f,group=b.name);b.keyframe_insert('rotation_quaternion',frame=f,group=b.name);b.keyframe_insert('scale',frame=f,group=b.name)
 action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
contract={'version':1,'height_m':1.865,'forward':'-Z','up':'+Y','root_motion':False,'clips':clips,'switch':{'duration':1,'holster':.45,'draw':.60,'fps':60,'holster_frame':27,'draw_frame':36},'profiles':{'rifle':'Rifle','shotgun':'Shotgun','rocket':'Rocket'},'slots':2,'dodge_runtime_duration':.32}
root['animation_contract']=json.dumps(contract);(OUT/'standard_trooper_v3.json').write_text(json.dumps(contract,indent=2))
scene.frame_start=0;scene.frame_end=180;scene.frame_set(0)
# Reference remains a packed image in the source, not exported.
ref=REPO.parent/'.codex-remote-attachments/01a089be-70b8-7a41-80ef-a98926a2facc/1726f471-8442-4353-b424-bd8c02ed2c3e/1-Photo-1.jpg'
if ref.exists():im=bpy.data.images.load(str(ref));im.name='DESIGN_AUTHORITY_STANDARD_TROOPER';im.pack();im.use_fake_user=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
root.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'standard_trooper_v3.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False)
data=(OUT/'standard_trooper_v3.glb').read_bytes();doc=json.loads(data[20:20+int.from_bytes(data[12:16],'little')]);tris=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert {a['name'] for a in doc['animations']}==set(clips)
assert len(doc['skins'][0]['joints'])==24
assert all('normalTexture' in m for m in doc['materials'])
report={'triangles':tris,'bones':len(doc['skins'][0]['joints']),'materials':len(doc['materials']),'primitives':sum(len(m['primitives']) for m in doc['meshes']),'clips':[a['name'] for a in doc['animations']],'glb_bytes':len(data),'source':str(SOURCE)}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(OUT/'standard_trooper_v3.glb'))
report['roundtrip_armatures']=sum(o.type=='ARMATURE' for o in scene.objects)
assert report['roundtrip_armatures']==1
(QA/'blender-validation.json').write_text(json.dumps(report,indent=2));print('TROOPER_VALIDATION',json.dumps(report))
