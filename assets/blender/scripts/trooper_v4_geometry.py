"""Reference-led v4 shell and skin-ready anatomy. Executed by the v4 builder.
Blender metres, +Y forward. All new geometry receives explicit normalized weights.
"""
M['Ceramic']=mat('Ceramic',(.64,.68,.69),.43,.08)
detail_bones=[]

def remove_parts(predicate):
 for o in list(parts):
  if predicate(o):
   parts.remove(o);bpy.data.objects.remove(o,do_unlink=True)

# Replace the open gold mask with the reference's sealed ceramic helmet.
remove_parts(lambda o:o.get('component')=='Helmet')
remove_parts(lambda o:o.name.startswith('Armored_collar'))
current_group='ChestArmor';current_bone='Chest'
loft('Collar_protective_rim',[(1.46,.131,.115,0),(1.49,.128,.109,0),(1.51,.11,.094,0)],'Armor',24)
current_group='Body';current_bone='Neck'
for z in [1.516,1.53,1.544,1.558]:
 loft('Neck_articulation_rib',[(z-.003,.091,.089,0),(z,.097,.094,0),(z+.004,.091,.089,0)],'Rubber',20)
current_group='Helmet';current_bone='Head'
o=loft('Helmet_pressure_shell',[(1.565,.085,.085,0),(1.60,.116,.115,0),(1.67,.153,.144,-.003),(1.755,.157,.142,-.008),(1.819,.115,.11,-.015),(1.865,.047,.045,-.022)],'Ceramic',24)
for p in o.data.polygons:p.use_smooth=True
panel('Visor_recess_gasket',(0,.144,1.705),.226,.113,.035,'Rubber',.9)
panel('Visor_smoked_glass',(0,.166,1.707),.197,.082,.015,'Visor',.91)
panel('Helmet_sealed_faceplate',(0,.141,1.617),.155,.079,.033,'Ceramic',.72)
box('Helmet_brow_seal',(0,.162,1.765),(.199,.029,.017),'Metal',.004)
box('Helmet_crown_socket',(0,-.014,1.853),(.058,.128,.016),'Metal',.005)
box('Helmet_crown_ceramic',(0,-.02,1.862),(.038,.084,.009),'Ceramic',.003)
for s in [-1,1]:
 rod('Helmet_ear_seal',(s*.137,-.014,1.706),(s*.173,-.014,1.706),.061,'Rubber',16)
 rod('Helmet_comms_ring',(s*.17,-.014,1.706),(s*.185,-.014,1.706),.051,'Metal',16)
 rod('Helmet_comms_cover',(s*.185,-.014,1.706),(s*.19,-.014,1.706),.037,'Rubber',12)
 box('Helmet_temple_rail',(s*.119,.022,1.802),(.04,.077,.017),'Metal',.005,rot=(0,s*.5,0))
 rod('Helmet_jaw_seam',(s*.092,.11,1.611),(s*.133,.065,1.663),.005,'Rubber',8)
 for z in [1.79,1.808]:
  box('Helmet_side_vent',(s*.125,-.057,z),(.018,.043,.005),'Rubber',.001)
 screw('Helmet_visor_bolt',s*.113,.157,1.704,.003)
 box('Helmet_rear_latch',(s*.065,-.127,1.679),(.026,.026,.043),'Metal',.005)
box('Helmet_rear_service',(0,-.146,1.72),(.105,.024,.065),'Metal',.009)
for x in [-.028,0,.028]:box('Helmet_rear_vent',(x,-.16,1.717),(.011,.007,.031),'Rubber',.001)
box('Helmet_chin_filter',(0,.139,1.578),(.059,.023,.021),'Rubber',.005)

# Reference: broad dark carrier, inset white sternum panel, restrained orange tabs.
remove_parts(lambda o:o.name.startswith(('Chest_main_plate','Chest_inset_ceramic','Chest_panel_joint','Chest_serial','Chest_warning','Carrier_molle_row','Molle_stitch','Unit_chevron','Chest_plate_fastener','Carrier_captive_screw')))
current_group='ChestArmor';current_bone='Chest'
panel('Chest_ballistic_frame',(0,.17,1.323),.368,.244,.07,'Armor',.8)
panel('Chest_ceramic_sternum',(0,.211,1.349),.279,.067,.021,'Ceramic',.85)
panel('Chest_lower_cartridge',(0,.211,1.265),.242,.053,.024,'Metal',.82)
for s in [-1,1]:
 box('Chest_harness_channel',(s*.162,.211,1.344),(.025,.014,.142),'Rubber',.004)
 for z in [1.29,1.395]:screw('Chest_service_screw',s*.139,.221,z,.004)
box('Chest_id_tab',(.1,.229,1.348),(.022,.008,.016),'Orange',.002)

# The backpack silhouette is the key third-person identifier in the reference.
remove_parts(lambda o:o.name.startswith(('Backpack_panel','Backpack_service_hatch','Backpack_unit','Backpack_small','Backpack_heat_louver','Pack_hatch_bolt')))
current_group='Backpack';current_bone='Chest'
panel('Backpack_ceramic_frame',(0,-.328,1.308),.276,.264,.039,'Ceramic',.90)
panel('Backpack_recess',(0,-.355,1.308),.215,.203,.025,'Rubber',.80)
rod('Backpack_fan_ring',(0,-.366,1.313),(0,-.38,1.313),.077,'Metal',16)
rod('Backpack_fan_cavity',(0,-.38,1.313),(0,-.384,1.313),.062,'Rubber',16)
for i in range(8):
 a=i*math.tau/8
 rod('Backpack_radial_vane',(.024*math.sin(a),-.386,1.313+.024*math.cos(a)),(.054*math.sin(a+.22),-.386,1.313+.054*math.cos(a+.22)),.005,'Metal',6)
rod('Backpack_hub',(0,-.385,1.313),(0,-.393,1.313),.022,'Armor',12)
for s in [-1,1]:
 for z in [1.213,1.403]:rod('Backpack_frame_bolt',(s*.105,-.351,z),(s*.105,-.358,z),.006,'Metal',8)

# Continuous ring-based fabric limbs follow the actual joint axis, with enough
# longitudinal loops for bending. Armor remains independent and rigid.
remove_parts(lambda o:o.name.startswith(('Body_bicep_','Body_forearm_','Body_thigh_','Body_calf_','Body_abdomen','Body_thorax','Glove_finger_','Glove_thumb_','Glove_segmented_knuckle','Finger_flex_groove')))

def limb(n,a,b,radii,bn,start_bone,end_bone):
 global current_group,current_bone
 current_group='Body';current_bone=bn
 a,b=Vector(a),Vector(b);axis=(b-a).normalized();x=Vector((1,0,0));x=(x-axis*x.dot(axis)).normalized();y=axis.cross(x)
 vs=[];weights=[];steps=[0,.07,.18,.35,.55,.75,.9,1];segments=16
 for t in steps:
  radius=radii[0]*(1-t)+radii[1]*t
  radius*=.87+.13*math.sin(math.pi*t)
  for i in range(segments):
   ang=i*math.tau/segments;vs.append(a.lerp(b,t)+radius*(x*math.cos(ang)+y*math.sin(ang)))
   near=.5*max(0,1-t/.22);far=.5*max(0,1-(1-t)/.22)
   weights.append({bn:1-near-far,start_bone:near,end_bone:far})
 faces=[tuple(reversed(range(segments)))]
 for j in range(len(steps)-1):
  for i in range(segments):k=j*segments+i;l=j*segments+(i+1)%segments;faces.append((k,l,l+segments,k+segments))
 faces.append(tuple((len(steps)-1)*segments+i for i in range(segments)))
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
 finish(o,n,'Cloth');o.vertex_groups.clear()
 for name in [bn,start_bone,end_bone]:o.vertex_groups.new(name=name)
 for i,w in enumerate(weights):
  for name,v in w.items():
   if v>0:o.vertex_groups[name].add([i],v,'REPLACE')
 for p in me.polygons:p.use_smooth=True

current_group='Body';current_bone='Spine'
o=loft('Body_continuous_torso',[(.93,.183,.117,0),(1.02,.18,.12,0),(1.09,.185,.124,0),(1.155,.21,.135,0),(1.25,.247,.146,0),(1.35,.255,.139,0),(1.43,.221,.115,0),(1.47,.13,.10,0)],'Cloth',24)
o.vertex_groups.clear()
levels=[(.94,'Pelvis'),(1.06,'Spine'),(1.155,'SpineMid'),(1.3,'Chest')]
for _,n in levels:o.vertex_groups.new(name=n)
for v in o.data.vertices:
 z=v.co.z
 if z<=levels[0][0]:o.vertex_groups['Pelvis'].add([v.index],1,'REPLACE')
 elif z>=levels[-1][0]:o.vertex_groups['Chest'].add([v.index],1,'REPLACE')
 else:
  for (za,na),(zb,nb) in zip(levels,levels[1:]):
   if za<=z<zb:
    t=(z-za)/(zb-za);o.vertex_groups[na].add([v.index],1-t,'REPLACE');o.vertex_groups[nb].add([v.index],t,'REPLACE');break
for p in o.data.polygons:p.use_smooth=True

for s,side in [(-1,'L'),(1,'R')]:
 hip,knee,ankle,shoulder,elbow,wrist=joints[side]
 limb('Suit_upperarm_'+side,shoulder,elbow,(.077,.066),'UpperArm_'+side,'Clavicle_'+side,'LowerArm_'+side)
 limb('Suit_forearm_'+side,elbow,wrist,(.063,.044),'LowerArm_'+side,'UpperArm_'+side,'Hand_'+side)
 limb('Suit_thigh_'+side,hip,knee,(.106,.079),'UpperLeg_'+side,'Pelvis','LowerLeg_'+side)
 limb('Suit_calf_'+side,knee,ankle,(.077,.055),'LowerLeg_'+side,'UpperLeg_'+side,'Foot_'+side)
 # Three bones per finger, symmetric rest axes and separate padded phalanges.
 current_group='Hands'
 for index,finger in enumerate(['Index','Middle','Ring','Little','Thumb']):
  if finger=='Thumb':
   start=Vector((s*.357,.065,.862));direction=Vector((-s*.3,.18,-1)).normalized();lengths=[.024,.021,.018]
  else:
   start=Vector((s*(.374+index*.017),.057,.831));direction=Vector((0,0,-1));scale=[.95,1,.94,.78][index];lengths=[.027*scale,.022*scale,.018*scale]
  for segment,length in enumerate(lengths,1):
   end=start+direction*length;name=f'{finger}{segment}_{side}';parent='Hand_'+side if segment==1 else f'{finger}{segment-1}_{side}'
   detail_bones.append((name,start.copy(),end.copy(),parent));current_bone=name
   rod(name+'_glove',start,end,.008 if finger!='Thumb' else .010,'Rubber',8)
   bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.0085,location=start)
   joint=bpy.context.object
   for p in joint.data.polygons:p.use_smooth=True
   finish(joint,name+'_knuckle','Rubber')
   start=end
 # Toe seam has actual weights on the front of the sole, not an unused marker.
 detail_bones.append(('Toe_'+side,Vector((s*.15,.14,.075)),Vector((s*.15,.23,.075)),'Foot_'+side))
 for o in parts:
  if o.get('component')=='Boots' and o.vertex_groups.get('Foot_'+side):
   toe=o.vertex_groups.new(name='Toe_'+side);foot=o.vertex_groups['Foot_'+side]
   for v in o.data.vertices:
    y=(o.matrix_world@v.co).y;w=max(0,min(1,(y-.125)/.065))
   if w:foot.add([v.index],1-w,'REPLACE');toe.add([v.index],w,'REPLACE')

# User correction: neutral stance opens from hip to knee to ankle, rather than
# two parallel columns. Move anatomy, rigid plates, fabric and deform pivots
# together; no object scaling or animation-only illusion of a wider pelvis.
# Joint centre distances: hips 25cm, knees 35cm, ankles 47cm.
def leg_offset(z):
 keys=[(.115,.085),(.53,.025),(.94,-.010)]
 if z<=keys[0][0]:return keys[0][1]
 if z>=keys[-1][0]:return keys[-1][1]
 for (za,a),(zb,b) in zip(keys,keys[1:]):
  if za<=z<=zb:return a+(b-a)*(z-za)/(zb-za)

for s,side in [(-1,'L'),(1,'R')]:
 hip,knee,ankle,shoulder,elbow,wrist=joints[side]
 def widen(v):
  out=v.copy();out.x+=s*leg_offset(out.z);return out
 new_ankle=widen(ankle)
 toe_out=Quaternion((0,0,1),-s*math.radians(6)).to_matrix()
 for o in parts:
  if not any(o.vertex_groups.get(n+'_'+side) for n in ['UpperLeg','LowerLeg','Foot','Toe']):continue
  inverse=o.matrix_world.inverted()
  for v in o.data.vertices:
   p=widen(o.matrix_world@v.co)
   if o.get('component')=='Boots':p=new_ankle+toe_out@(p-new_ankle)
   v.co=inverse@p
  o.data.update()
 joints[side]=(widen(hip),widen(knee),new_ankle,shoulder,elbow,wrist)
 for i,(name,a,b,parent) in enumerate(detail_bones):
  if name=='Toe_'+side:
   detail_bones[i]=(name,new_ankle+toe_out@(widen(a)-new_ankle),new_ankle+toe_out@(widen(b)-new_ankle),parent)

# Use weighted normals for new manufactured panels, without extra subdivisions.
for o in parts:
 if o.name.startswith(('Helmet_','Chest_ballistic','Chest_ceramic','Backpack_ceramic')):
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  mod=o.modifiers.new('Panel corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=30
  bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
