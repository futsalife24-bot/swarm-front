"""RAY refined: perforated abyssal membranes, hollow rib cage and three sinuous tails."""
import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from phase1_common import *
import phase1_common as common
setup('ray');common.BEVEL_MIN_SIZE=.08
skin=mat('abyssal_indigo',(.060,.095,.20),.62,.38)
pearl=mat('wet_mineral_blue',(.14,.28,.34),.57,.34)
frame=mat('void_structure',(.014,.023,.032),.62,.46)
energy=mat('cold_biolumen',(.025,.56,.68),.1,.28,1.45)
def tube(name,path,radii,m,sides=6,flat=1,smooth=True):
 path=[Vector(p) for p in path];verts=[];faces=[]
 for i,p in enumerate(path):
  tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized();R=tangent.to_track_quat('Z','Y').to_matrix()
  for j in range(sides):verts.append(p+R@Vector((math.cos(math.tau*j/sides)*radii[i],math.sin(math.tau*j/sides)*radii[i]*flat,0)))
 for i in range(len(path)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))]);o=mesh(name,verts,faces,m)
 for p in o.data.polygons:p.use_smooth=smooth
 return o
# The fins curve in three axes, scallop at the trailing edge, and contain real holes.
def surface(side,u,v):
 x=.45+1.72*u
 leading=.62+.41*math.sin(math.pi*u*.88)+.03*u
 trailing=-1.09+.37*u+.99*u*u
 middle=(leading+trailing)/2;span=(leading-trailing)*(1-.96*u**3)
 y=middle+(0.5-v)*span
 y-=.14*math.sin(u*math.pi*5+.3)**2*v**5*(1-u)
 z=1.27+.27*math.sin(math.pi*u)-.18*v*(1-.96*u**2)+.095*math.sin(u*math.tau+v*3)*(1-u)
 z+=.025*side*math.sin(u*4)
 return Vector((side*x,y,z))
def membrane(side):
 nu,nv=20,11;verts=[];faces=[];cells=[]
 for layer in [-1,1]:
  for i in range(nu+1):
   for j in range(nv+1):
    u,v=i/nu,j/nv;p=surface(side,u,v);p.z+=layer*(.026-.019*u);verts.append(p)
 n=(nu+1)*(nv+1)
 for i in range(nu):
  for j in range(nv):
   u,v=(i+.5)/nu,(j+.5)/nv
   hole=any(((u-cu)/ru)**2+((v-cv)/rv)**2<1 for cu,cv,ru,rv in [(.28,.54,.048,.21),(.51,.61,.057,.18),(.73,.62,.040,.13)])
   if not hole:cells.append((i,j))
 edges={}
 for i,j in cells:
  a=i*(nv+1)+j;f=(a,a+1,a+nv+2,a+nv+1);faces.extend([f,tuple(k+n for k in reversed(f))])
  for a,b in zip(f,f[1:]+f[:1]):
   key=tuple(sorted([a,b]));edges[key]=edges.get(key,0)+1
 for (a,b),count in edges.items():
  if count==1:faces.append((a,b,b+n,a+n))
 o=mesh('perforated_marine_membrane',verts,faces,skin)
 # Remove unused grid vertices inside holes for compact export.
 import bmesh
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(o.data);bm.free()
 for p in o.data.polygons:p.use_smooth=True
for side in [-1,1]:
 membrane(side)
 # Skeletal lip traces fin curvature, with disconnected luminous segments.
 for v,rad in [(0,.040),(.96,.029)]:
  pts=[surface(side,i/18,v)+Vector((0,0,-.019)) for i in range(19)]
  tube('curved_fin_spar',pts,[rad*(1-.7*i/18) for i in range(19)],frame,5)
 for u in [.13,.40,.63]:
  pts=[surface(side,u,.15+j*.065)+Vector((0,0,.032)) for j in range(11)]
  tube('lamellar_fin_ridge',pts,[.020]*len(pts),pearl,5,flat=.58)
 for a,b in [(.11,.25),(.48,.60),(.83,.95)]:
  pts=[surface(side,a+(b-a)*i/4,.04)+Vector((0,0,.04)) for i in range(5)]
  tube('subsurface_luminous_vein',pts,[.015]*5,energy,5)
 # Swept overlapping collar plates blend the soft membrane into hard hollow machinery.
 for j in range(3):
  pts=[surface(side,.04+.04*j+i*.021,.18+.21*j)+Vector((0,0,.055)) for i in range(12)]
  tube('gill_armor_lamella',pts,[.068*(1-.8*i/11) for i in range(12)],pearl,6,flat=.38)
# Skewed elliptical aperture: front is open, no head, eye or solid torso.
def aperture(t,depth=0):
 return Vector((.49*math.sin(t)*(.78+.28*abs(math.sin(t))),.32+.14*math.cos(t)+.05*math.sin(t)+depth,1.23+.52*math.cos(t)+.04*math.sin(2*t)))
loop=[aperture(math.tau*i/28) for i in range(29)]
tube('continuous_hollow_collar',loop,[.077]*29,frame,6)
back=[aperture(math.tau*i/20,-.21)+Vector((0,0,-.035)) for i in range(21)]
tube('rear_collar',back,[.044]*21,pearl,6)
for i in range(12):
 t=math.tau*i/12;a=aperture(t);b=aperture(t,-.21)+Vector((0,0,-.035))
 beam('aperture_rib',a,b,.042,frame)
 if i not in [0,6]:
  # segmented inner lip with irregular scale-like armored blocks
  pts=[aperture(t+d)+Vector((0,.045,0)) for d in [-.12,0,.12]]
  tube('aperture_lamella',pts,[.065,.074,.060],pearl,5,flat=.55,smooth=False)
for a,b in [(.87,1.61),(3.87,4.65)]:
 pts=[aperture(a+(b-a)*i/8)+Vector((0,.065,0)) for i in range(9)]
 tube('deep_void_lumen',pts,[.025]*9,energy,6)
# Swept mantle cheeks integrate the aperture into the fins, rather than a freestanding ring.
for side in [-1,1]:
 outline=[(side*.018,.50,1.83),(side*.24,.58,1.62),(side*.62,.68,1.43),(side*1.00,.71,1.38),(side*.81,.36,1.28),(side*.49,.41,1.27),(side*.29,.48,1.57)]
 top=[Vector(p) for p in outline];bottom=[p-Vector((0,.02,.035)) for p in top];n=len(top)
 faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh('integrated_mantle_cheek',top+bottom,faces,skin)
 tube('mantle_edge_ridge',[top[0],top[1],top[2],top[3]],[.025,.027,.023,.009],pearl,5)
# Three separate flexible tails splay, droop and curl at differing phases.
for tail in range(3):
 side=tail-1;path=[]
 for i in range(25):
  t=i/24;x=side*(.23+.53*t)+.14*math.sin(t*math.pi*1.8+tail*.6)*t
  y=-.60-(1.70+tail*.15)*t+.12*math.sin(t*math.pi)
  z=1.00-.69*math.sin(t*math.pi*.73)+.29*t**4
  path.append(Vector((x,y,z)))
 tube('propulsion_tail_'+str(tail+1),path,[.086*(1-.88*i/24) for i in range(25)],frame,7)
 for j in range(0,21,3):
  sub=[p+Vector((0,0,.019)) for p in path[j:j+3]]
  tube('segmented_tail_armor',sub,[.089*(1-.77*(j+k)/24) for k in range(3)],pearl,5,flat=.58,smooth=False)
 for j in [5,12,19]:
  sub=[p+Vector((0,0,.045*(1-j/30))) for p in path[j:j+3]]
  tube('tail_luminous_node',sub,[.026*(1-j/30)]*3,energy,5)
 tube('luminous_tail_tip',path[-4:],[.027,.023,.015,.007],energy,6)
 # Socket sits behind the void; a dark throat never fills the central opening.
 ico('tail_coupling',path[0],(.11,.15,.082),frame,1)
lowest=min(v.co.z for o in common.ROOT.children for v in o.data.vertices)
for o in common.ROOT.children:
 for v in o.data.vertices:v.co.z+=.32-lowest
common.ROOT['revision']='alien polish; pierced marine membranes / hollow collar / three curved tails'
export(4000,8000,.32)
