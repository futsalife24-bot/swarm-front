"""FOUNDRY ZERO: grounded industrial fabrication fortress; no creature anatomy."""
import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from phase1_common import *
import phase1_common as common
setup('foundry_zero')
common.BEVEL_MIN_SIZE=.12 # preserve armor bevels; omit imperceptible bevels on thin trusses
steel=mat('industrial_graphite',(.07,.09,.10),.75,.5)
metal=mat('machined_gray',(.23,.28,.29),.8,.4)
ivory=mat('ceramic_white',(.64,.65,.60),.26,.62)
hazard=mat('warning_yellow',(.85,.46,.025),.32,.53)
heat=mat('furnace_amber', (1,.20,.009),.1,.35,3.2)
# Central open furnace column; exposed energy read from every direction.
cylinder('furnace_bed',(0,0,1.30),1.05,.35,steel,24)
cylinder('furnace_core',(0,0,2.80),.49,3.20,heat,32)
for z,r in [(1.43,.71),(1.67,.71),(2.42,.72),(3.24,.73),(4.15,.76),(4.45,.83)]:
 ring('reactor_collar',(0,0,z),r,.09,metal,40,6)
for i in range(10):
 a=i*math.tau/10;x,y=math.cos(a)*.69,math.sin(a)*.69
 cylinder('furnace_heat_shield',(x,y,2.90),.075,2.75,steel,10)
 for z in [1.75,3.15,4.15]:box('collar_clamp',(x,y,z),(.19,.19,.17),ivory)
cylinder('upper_pressure_cap',(0,0,4.49),.75,.20,steel,24)
# Transport annulus built from structural deck sections, side armor and guard rails.
for i in range(24):
 a=i*math.tau/24;x,y=math.cos(a),math.sin(a);rot=(0,0,a+math.pi/2)
 box('conveyor_deck',(x*1.78,y*1.78,2.96),(.49,.82,.18),steel,rot)
 box('ring_white_fascia',(x*2.16,y*2.16,3.06),(.50,.115,.34),ivory,rot)
 box('deck_separator',(x*1.81,y*1.81,3.065),(.04,.61,.026),metal,rot)
 if i%2==0:
  cylinder('handrail_post',(x*2.11,y*2.11,3.43),.025,.46,hazard,8)
  box('conveyor_heat_slot',(x*2.223,y*2.223,3.07),(.19,.016,.055),heat,rot)
  beam('radial_deck_support',(x*.85,y*.85,2.18),(x*2.03,y*2.03,2.85),.085,metal)
ring('outer_safety_rail',(0,0,3.66),2.11,.026,hazard,48,6)
ring('inner_transport_track',(0,0,3.12),1.46,.04,metal,48,6)
# Six broad load-bearing pylons. Feet remain flat on Blender Z=0.
feet=[]
for i in range(6):
 a=(i+.5)*math.tau/6;x,y=math.cos(a),math.sin(a);side=Vector((-y,x,0));rot=(0,0,a)
 top=Vector((x*1.46,y*1.46,2.35));knee=Vector((x*2.24,y*2.24,1.82));foot=Vector((x*2.92,y*2.92,.19))
 box('pylon_foot_'+str(i),foot,(1.02,.79,.38),steel,rot);feet.append([foot.x,foot.y,0])
 beam('upper_load_frame',top,knee,.43,steel,.64)
 beam('lower_load_frame',knee,foot+Vector((0,0,.16)),.39,steel,.60)
 # Overlapping shin armor, exposed hydraulic rams and broad mechanical knee hubs.
 outward=Vector((x,y,0))
 for start,end in [(.02,.43),(.49,.84)]:
  beam('layered_white_shin',knee.lerp(foot,start)+outward*.18+Vector((0,0,.12)),knee.lerp(foot,end)+outward*.18+Vector((0,0,.12)),.57,ivory,.62)
 hinge_rot=side.to_track_quat('Z','Y').to_euler()
 cylinder('knee_load_bearing_hub',knee,.235,.79,steel,12,hinge_rot)
 for sign in [-1,1]:
  cylinder('knee_hub_cap',knee+side*.41*sign,.175,.06,metal,12,hinge_rot)
  cylinder('knee_hub_lock',knee+side*.45*sign,.075,.025,hazard,8,hinge_rot)
  a_ram=knee+side*.37*sign-outward*.08;b_ram=foot+side*.37*sign+Vector((0,0,.42))
  delta=b_ram-a_ram;rotation=delta.to_track_quat('Z','Y').to_euler()
  cylinder('exposed_ram_cylinder',a_ram.lerp(b_ram,.28),.10,delta.length*.50,steel,10,rotation)
  cylinder('polished_ram_rod',a_ram.lerp(b_ram,.72),.049,delta.length*.48,metal,10,rotation)
  box('ram_base_socket',b_ram,(.19,.19,.18),metal,rot)
 for t in [.15,.60]:
  center=knee.lerp(foot,t)+outward*.50+Vector((0,0,.12))
  for sign in [-1,1]:ico('armor_lock_bolt',center+side*.235*sign,(.042,.042,.042),metal,1)
 for j in range(4):
  pos=knee.lerp(foot,.22+j*.047)+outward*.51+Vector((0,0,.11))
  box('shin_service_louvre',pos,(.028,.30,.045),steel,rot)
 beam('upper_box_girder',top+outward*.07+Vector((0,0,.20)),knee+Vector((0,0,.21)),.27,ivory,.40)
 for j in [-1,0,1]:
  pos=foot+outward*.33+side*(j*.235)+Vector((0,0,.17))
  box('independent_toe_armour',pos,(.67,.20,.17),metal,rot)
  box('toe_grip_bar',pos+outward*.22+Vector((0,0,.10)),(.07,.20,.045),steel,rot)
 for sign in [-1,1]:
  shift=side*.28*sign;beam('hydraulic_piston',top+shift,knee+shift,.065,metal)
  beam('lower_hydraulic',knee+shift,foot+shift+Vector((0,0,.20)),.065,metal)
  cylinder('sole_anchor',(foot.x+shift.x,foot.y+shift.y,.40),.065,.08,metal,10)
 # yellow bands are actual geometry, no image maps
 for t in [.18,.31,.44]:
  p=knee.lerp(foot,t)+Vector((x*.26,y*.26,.07));box('pylon_warning_band',p,(.045,.58,.115),hazard,rot)
 box('foot_toe_shield',(foot.x+x*.42,foot.y+y*.42,.24),(.20,.73,.36),metal,rot)
 # Cross-braced square chassis instead of an animal abdomen.
 b=(i+1.5)*math.tau/6;other=Vector((math.cos(b)*1.46,math.sin(b)*1.46,2.35))
 beam('chassis_upper_beam',top,other,.12,metal);beam('chassis_lower_beam',top-Vector((0,0,.64)),other-Vector((0,0,.64)),.12,steel)
 beam('chassis_diagonal',top,other-Vector((0,0,.64)),.075,metal)
 beam('chassis_crossbrace',top-Vector((0,0,.64)),other,.075,metal)
# Asymmetric service towers, nested heat stacks and accessible industrial panels.
for i,(x,y,h) in enumerate([(-1.04,-.45,5.53),(.99,-.76,5.04),(-.64,1.12,4.72),(1.1,.80,4.30)]):
 box('tower_column',(x,y,(h+2.05)/2),(.34,.39,h-2.05),steel)
 box('tower_service_panel',(x,y+.23,(h+2.45)/2),(.29,.09,(h-2.45)*.67),ivory)
 for sx in [-.13,.13]:cylinder('stack_edge_pipe',(x+sx,y-.20,(h+2.2)/2),.037,h-2.2,metal,8)
 cylinder('stack_hot_vent',(x,y,h-.12),.105,.28,heat,12)
 ring('stack_vent_rim',(x,y,h+.01),.145,.035,metal,16,5)
 for z in [2.6,3.4,4.1]:
  if z<h:box('tower_band',(x,y,z),(.43,.48,.07),metal)
 for j in range(5):box('service_panel_vent',(x,y+.282,3.25+j*.11),(.18,.016,.035),steel)
# Two unequal jib cranes with suspended fabrication load. No cables outside footprint unnecessarily.
for side,z,length in [(-1,3.79,2.70),(1,3.43,2.35)]:
 start=Vector((side*1.10,-.24,z));end=Vector((side*(1.1+length),-.24,z+.12))
 beam('crane_top_rail',start+Vector((0,0,.20)),end+Vector((0,0,.20)),.075,hazard)
 beam('crane_bottom_rail',start,end,.10,steel)
 for j in range(7):
  a=start.lerp(end,j/7);b=start.lerp(end,(j+1)/7)
  beam('crane_truss',a,b+Vector((0,0,.20)),.035,metal)
  beam('crane_vertical',a,a+Vector((0,0,.20)),.035,metal)
 cylinder('crane_rotation_socket',start,.22,.26,metal,16)
 beam('hoist_cable_A',end+Vector((0,-.12,0)),end+Vector((0,-.12,-.85)),.025,metal)
 beam('hoist_cable_B',end+Vector((0,.12,0)),end+Vector((0,.12,-.85)),.025,metal)
 box('fabrication_crate',end+Vector((0,0,-1.04)),(.40,.45,.44),ivory)
 for dz in [-1.20,-.9]:box('crate_strap',end+Vector((0,0,dz)),(.43,.48,.035),steel)
# Lower deployment bay and ramps, visually distinct from support legs.
box('fabricator_bay',(0,.92,1.48),(1.20,.70,.70),steel)
box('fabricator_lintel',(0,1.29,1.76),(1.18,.12,.12),hazard)
box('fabricator_hot_interior',(0,1.285,1.45),(.86,.018,.34),heat)
for x in [-.48,.48]:box('bay_door_jamb',(x,1.34,1.44),(.16,.17,.60),ivory)
box('deployment_apron',(0,1.57,1.04),(.93,.90,.12),metal,(.3,0,0))
for i in range(7):box('ramp_rollers',(0,1.23+i*.11,1.11+(i*.11)*.30),(.83,.035,.055),steel)
# Enlarge visual dimensions by 25 percent, baking vertices instead of runtime scale.
VISUAL_SCALE=1.25
for obj in common.ROOT.children:
 for vertex in obj.data.vertices:vertex.co*=VISUAL_SCALE
common.ROOT['visual_revision']='25% larger; detailed industrial support legs'
common.ROOT['support_contacts']=str([[v*VISUAL_SCALE for v in f] for f in feet])
bpy.context.view_layer.update()
for o in common.ROOT.children:
 if o.name.startswith('pylon_foot_'):assert abs(min(v.co.z for v in o.data.vertices))<1e-6
export(8000,20000,0)
