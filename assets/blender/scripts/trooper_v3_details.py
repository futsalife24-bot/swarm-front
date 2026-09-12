"""Manufactured armor, sewn equipment and articulated seals for the v3 builder."""
def screw(n,x,y,z,r=.004):
 rod(n+'_recess',(x,y-.001,z),(x,y+.001,z),r*1.65,'Rubber',12)
 rod(n+'_head',(x,y,z),(x,y+.003,z),r,'Metal',12)
 box(n+'_slot',(x,y+.0035,z),(r*1.25,.0015,r*.25),'Rubber',.0002)

def label(n,text,p,size=.022,back=False):
 curve=bpy.data.curves.new(n,'FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.extrude=.00025;curve.resolution_u=2
 o=bpy.data.objects.new(n,curve);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(math.pi/2,0,0 if back else math.pi)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');finish(bpy.context.object,n,'Armor' if back else 'Metal')

current_group='Helmet';current_bone='Head'
# Separate ceramic shell, dark gasket, slotted hardware and optical attachments.
for s in [-1,1]:
 for i in range(6):
  box('Helmet_vent_louver',(s*.132,-.074+i*.013,1.78),(.016,.005,.024),'Rubber',.002,rot=(0,s*.42,0))
 for i in range(4):
  rod('Helmet_rail_tooth',(s*.151,-.083+i*.022,1.724),(s*.16,-.083+i*.022,1.724),.007,'Metal',8)
 rod('Visor_gasket',(s*.137,.094,1.744),(s*.104,.112,1.642),.006,'Rubber',12)
 screw('Jaw_fastener',s*.065,.151,1.61,.003)
box('Optics_bridge',(0,.16,1.773),(.047,.025,.026),'Metal',.004)
box('Optics_dovetail',(0,.176,1.775),(.028,.009,.015),'Rubber',.002)
rod('Optics_status_lens',(.078,.139,1.779),(.078,.147,1.779),.004,'Orange',12)
label('Helmet_serial','07',(-.075,.116,1.80),.018)
for x in [-.042,.042]:
 box('Battery_latch',(x,-.165,1.719),(.013,.012,.025),'Rubber',.002)
for i in range(4):box('Chin_vent',(i*.012-.018,.148,1.586),(.007,.005,.011),'Rubber',.001)

current_group='ChestArmor';current_bone='Chest'
panel('Chest_inset_ceramic',(0,.208,1.317),.254,.143,.005,'Armor')
for x in [-.131,.131]:
 rod('Chest_panel_joint',(x,.213,1.266),(x,.213,1.372),.0025,'Rubber',6)
for z in [1.265,1.377]:rod('Chest_panel_joint',(-.106,.214,z),(.106,.214,z),.0025,'Rubber',6)
label('Chest_serial','SF - 07',(0,.216,1.307),.023)
label('Chest_warning','CERAMIC / IV',(0,.215,1.277),.010)
for x in [-.151,.151]:
 for z in [1.254,1.395]:screw('Carrier_captive_screw',x,.21,z,.004)
for s in [-1,1]:
 for z in [1.265,1.297,1.329]:
  box('Carrier_molle_row',(s*.118,.210,z),(.044,.01,.017),'Cloth',.002)
  for k in [-1,1]:rod('Molle_stitch',(s*.118+k*.014,.216,z-.005),(s*.118+k*.014,.216,z+.005),.0009,'Armor',4)
 rod('Harness_webbing_seam',(s*.209,.164,1.39),(s*.209,.164,1.481),.0016,'Cloth',6)

current_group='Body';current_bone='Spine'
for x in [-.096,0,.096]:
 for s in [-1,1]:
  rod('Magazine_pouch_piping',(x+s*.034,.233,1.105),(x+s*.034,.233,1.168),.002,'Rubber',6)
  for k in range(6):rod('Magazine_pouch_stitch',(x+s*.03,.234,1.112+k*.009),(x+s*.03,.234,1.116+k*.009),.0008,'Armor',4)
 box('Pouch_pull_tab',(x,.251,1.166),(.016,.012,.029),'Cloth',.002)

current_group='Backpack';current_bone='Chest'
panel('Backpack_service_hatch',(0,-.342,1.304),.20,.196,.012,'Metal')
label('Backpack_unit','SF / 07',(0,-.351,1.323),.031,True)
label('Backpack_small','POWER - LOCK',(0,-.351,1.286),.011,True)
for x in [-.088,.088]:
 for z in [1.23,1.379]:rod('Pack_hatch_bolt',(x,-.354,z),(x,-.349,z),.004,'Armor',12)
for i in range(7):box('Backpack_heat_louver',(-.068+i*.022,-.354,1.253),(.012,.012,.029),'Rubber',.003)
for s in [-1,1]:
 rod('Backpack_frame_tube',(s*.178,-.269,1.11),(s*.178,-.269,1.45),.007,'Metal',12)
 for z in [1.17,1.405]:box('Pack_strap_keeper',(s*.131,-.328,z),(.032,.015,.026),'Rubber',.003)
for k in range(12):rod('Backpack_zipper',(.181,-.285,1.13+k*.024),(.185,-.289,1.13+k*.024),.0028,'Metal',6)
rod('Comms_cable',(0,-.20,1.445),(.085,-.07,1.52),.005,'Rubber',12)

for s,side in [(-1,'L'),(1,'R')]:
 current_group='ArmArmor';current_bone='LowerArm_'+side
 for z in [1.01,1.034,1.058]:
  box('Forearm_cooling_slot',(s*.392,.12,z),(.071,.007,.008),'Rubber',.002)
 for x in [s*.353,s*.431]:screw('Wrist_plate_screw',x,.118,.975,.003)
 current_group='Body';current_bone='UpperArm_'+side
 for i in range(5):
  # Raised, oblique sleeve folds follow the arm instead of floating boxes.
  z=1.235+i*.023
  rod('Sleeve_fold',(s*(.353-i*.004),-.065,z),(s*(.396-i*.004),-.034,z+.012),.007,'Cloth',10)
 current_bone='LowerArm_'+side
 for i in range(5):rod('Elbow_bellows',(s*.344,-.045,1.12+i*.009),(s*.386,-.042,1.12+i*.009),.004,'Rubber',10)
 current_bone='Hand_'+side
 for k in range(4):
  box('Glove_segmented_knuckle',(s*(.374+k*.017),.005,.854),(.012,.013,.023),'Metal',.004)
  box('Finger_flex_groove',(s*(.374+k*.017),.048,.819),(.011,.009,.003),'Rubber',.001)
 current_group='LegArmor';current_bone='UpperLeg_'+side
 for z in [.688,.786]:
  box('Thigh_panel_recess',(s*.172,.141,z),(.081,.005,.008),'Rubber',.002)
 for x in [s*.107,s*.221]:screw('Thigh_captive_bolt',x,.141,.828,.0035)
 current_bone='LowerLeg_'+side
 for i in range(4):
  box('Shin_cooling_channel',(s*.15,.119,.255+i*.03),(.064,.006,.006),'Rubber',.0015)
 for x in [s*.101,s*.2]:screw('Knee_pin',x,.154,.545,.003)
 for i in range(4):rod('Knee_bellows',(s*.123,-.06,.50+i*.013),(s*.179,-.06,.50+i*.013),.004,'Rubber',10)
 current_group='Body';current_bone='UpperLeg_'+side
 for i in range(5):rod('Trouser_fold',(s*.10,-.086,.58+i*.035),(s*.19,-.081,.595+i*.035),.009,'Cloth',10)
 current_group='Boots';current_bone='Foot_'+side
 for y in [.073,.105,.137]:
  for k in [-1,1]:rod('Boot_lace_eyelet',(s*.15+k*.056,y,.15),(s*.15+k*.056,y,.158),.004,'Metal',10)
  rod('Cross_lace',(s*.15-.045,y-.009,.17),(s*.15+.045,y+.009,.17),.0022,'Cloth',6)
 for k in range(5):box('Boot_toecap_seam',(s*.15-.052+k*.026,.224,.075),(.013,.004,.005),'Rubber',.001)
 for k in [-1,1]:rod('Boot_welt',(s*.15+k*.085,-.05,.045),(s*.15+k*.085,.18,.045),.0025,'Metal',8)

# Smooth manufactured bevels without smoothing across panel/cap boundaries.
for o in parts:
 if o.type!='MESH':continue
 for polygon in o.data.polygons:polygon.use_smooth=True
 o.data.set_sharp_from_angle(angle=math.radians(55))
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Weighted manufactured normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
 bpy.ops.object.modifier_apply(modifier=mod.name)
