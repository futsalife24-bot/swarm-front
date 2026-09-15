"""PRISM refined: displaced mineral facets and stratified asymmetric levitating architecture."""
import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from phase1_common import *
import phase1_common as common
from mathutils import Euler
setup('prism');common.BEVEL_MIN_SIZE=.05
stone=mat('mineral_ceramic',(.55,.53,.46),.14,.77)
brass=mat('aged_brass',(.28,.20,.10),.7,.43)
frame=mat('dark_strata',(.019,.032,.027),.48,.63)
energy=mat('emerald_fissures',(.012,.67,.32),.1,.32,1.35)
# Distorted core is a mineral lattice, not a regular spherical drone body.
core=ico('distorted_energy_lattice',(.02,-.06,1.45),(.61,.47,.70),energy,1)
for v in core.data.vertices:
 v.co.x+=.12*(v.co.z-1.45)+.035*math.sin(v.co.y*9)
 v.co.y+=.055*math.sin(v.co.z*6)
core.data.update()
for i,p in enumerate(list(core.data.polygons)):
 vs=[core.data.vertices[j].co.copy() for j in p.vertices];c=sum(vs,Vector())/3;n=p.normal.normalized();shift=.045+(.04 if i in [2,7,13] else 0)
 def layer(name,shrink,offset,depth,m):
  top=[c+(v-c)*shrink+n*offset for v in vs];return mesh(name,top+[v-n*depth for v in top],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],m)
 layer('core_standoff_'+str(i),.90,shift,.055,brass)
 layer('displaced_mineral_facet_'+str(i),.81,shift+.052,.060,stone)
 # A displaced smaller corner reads as a broken stratification, not surface decals.
 if i%3==0:
  old=vs;vs=[c+(v-c)*.70+n*.01 for v in vs];layer('facet_raised_stratum',.88,shift+.09,.025,stone);vs=old
 for j in range(2):
  a=c+(vs[j]-c)*.60+n*(shift+.06);b=c+(vs[(j+1)%3]-c)*.49+n*(shift+.06)
  beam('facet_inset_seam',a,b,.012,brass)
# Polygonal floating shields: broad tapered slabs with layered edges, fractured face fields.
def shield(index,pos,w,h,rot):
 R=Euler(rot).to_matrix();c=Vector(pos)
 pts=[(-.43*w,-.22*h),(-.11*w,-.51*h),(.35*w,-.23*h),(.48*w,.24*h),(.09*w,.51*h),(-.34*w,.28*h)]
 def poly(name,outline,y,depth,m):
  vs=[c+R@Vector((x,y,z)) for x,z in outline];n=len(vs);faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
  return mesh(name,vs+[v-R@Vector((0,depth,0)) for v in vs],faces,m)
 poly('levitating_foundation_'+str(index),pts,-.015,.19,frame)
 poly('brass_exoskeleton_'+str(index),[(x*.98,z*.98) for x,z in pts],.025,.05,brass)
 # Convex fan cells, inset individually so the joints remain actual gaps.
 for j in range(6):
  a=Vector(pts[j]);b=Vector(pts[(j+1)%6]);mid=Vector((w*.025,h*.035));center=(a+b+mid)/3
  tri=[center+(v-center)*.87 for v in [a,b,mid]]
  poly('fractured_stone_sector',tri,.080+.011*(j%3),.065,stone)
 # Split rear support cassette, partially visible through the suspended arrangement.
 for z in [-h*.19,h*.14]:
  box('magnetic_lamella',c+R@Vector((-.04*w,-.205,z)),(w*.46,.12,h*.19),brass,rot)
 for j in range(3):
  z=h*(-.12+j*.12);box('cooling_lamella',c+R@Vector((w*.26,-.12,z)),(w*.13,.19,.035),frame,rot)
 # Recessed energetic fracture and a contained directed emitter instead of a muzzle.
 for a,b in [((w*.28,.039,-h*.22),(w*.34,.039,h*.19)),((-w*.28,.039,h*.20),(-w*.05,.039,h*.40))]:
  beam('emerald_vein',c+R@Vector(a),c+R@Vector(b),.026,energy)
 for j in range(3):
  a=Vector(pts[j]);b=Vector(pts[(j+1)%6]);p=(a*.4+b*.6)*.94
  ico('edge_mineral_inclusion',c+R@Vector((p.x,.092,p.y)),(.027,.020,.021),brass,1)
# Leaning mass on the right, a lower forward blade on the left, two elevated offsets.
for i,args in enumerate([
 ((-.89,.22,1.16),.59,1.73,(.14,-.40,-.17)),
 ((.94,-.14,1.61),.57,2.10,(-.19,.30,.15)),
 ((-.39,-.34,2.36),.73,.69,(.60,-.38,.47)),
 ((.29,-.09,2.72),.91,.61,(.48,.72,-.34)),
 ((-.37,.18,.57),.28,.64,(.12,-.32,.34)),
 ((.54,-.25,.68),.31,.84,(-.38,.48,-.21)),
 ((.03,.22,.29),.44,.48,(.30,.20,.30)),
 ((-.63,-.46,1.84),.43,.60,(.62,-.41,-.37))]):shield(i,*args)
# Nested lower stabilizer and two off-axis emitter sockets; no face or eyes.
for i,(z,r) in enumerate([(1.00,.27),(.87,.22),(.76,.13)]):
 cylinder('lower_stabilizer_tier',(.04,-.02,z),r,.09,brass,8)
for x,z in [(-.22,1.19),(.21,1.71)]:
 box('integrated_range_socket',(x,.48,z),(.18,.19,.105),frame,rot=(.10,0,.12))
 box('range_socket_rim',(x,.58,z),(.15,.055,.085),brass)
 box('precision_emitter',(x,.612,z),(.10,.012,.027),energy)
# Maintain original hover clearance and approximate three metre class envelope.
lowest=min(v.co.z for o in common.ROOT.children for v in o.data.vertices)
for o in common.ROOT.children:
 for v in o.data.vertices:v.co.z+=.16-lowest
common.ROOT['revision']='alien polish; off-axis mineral core / eight independent stratified shields'
export(3000,7000,.16)
