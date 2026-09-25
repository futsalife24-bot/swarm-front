import bpy, math, random, json, sys, os
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

OUT=Path(__file__).resolve().parent
random.seed(240920)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
M={}; G={}
def material(n,c,metal=0,rough=.4,em=0):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 if em: p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=em
 M[n]=m; return m
material('Ivory • ceramic bone',(.73,.69,.55),.22,.36)
material('Ivory highlights',(.9,.85,.7),.12,.38)
material('Gold scales',(.92,.58,.018),.32,.40)
material('Gold variations',(.69,.37,.008),.34,.43)
material('Gold underhide',(.21,.12,.016),.25,.5)
material('Graphite titanium',(.055,.065,.073),.8,.33)
material('Blade steel',(.065,.076,.085),.78,.41)
material('Edge steel',(.23,.26,.28),.88,.25)
material('Piston chrome',(.44,.47,.49),.9,.22)
material('Joint recess',(.012,.016,.021),.4,.4)
material('Carmine warhead',(.38,.015,.009),.65,.29)
material('Amber reactor', (1,.075,.006),.25,.25,4)
material('Eye ember',(.85,.012,.003),.15,.30,1.8)
material('Teeth',(.88,.82,.64),.15,.29)
region='Body'
def geom(v,f,mat,smooth=False):
 k=(region,mat,smooth)
 if k not in G:G[k]=[[],[]]
 vs,fs=G[k]; a=len(vs);vs.extend([tuple(x) for x in v]);fs.extend([tuple(a+i for i in x) for x in f])
def frame(d):
 d=Vector(d).normalized(); a=d.cross(Vector((0,1,0)))
 if a.length<.1:a=d.cross(Vector((1,0,0)))
 a.normalize();return a,d.cross(a).normalized()
def tube(points,radii,mat,n=12,smooth=True):
 pts=list(map(Vector,points));v=[];f=[]
 for i,p in enumerate(pts):
  d=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)];a,b=frame(d)
  r=radii[i];r1,r2=(r,r) if isinstance(r,(float,int)) else r
  for j in range(n):v.append(p+a*(cos(2*pi*j/n)*r1)+b*(sin(2*pi*j/n)*r2))
 for i in range(len(pts)-1):
  for j in range(n):k=i*n+j;q=i*n+(j+1)%n;f.append((k,q,q+n,k+n))
 f.extend([tuple(reversed(range(n))),tuple((len(pts)-1)*n+j for j in range(n))]);geom(v,f,mat,smooth)
def rod(a,b,r,mat,r2=None,n=12):tube([a,b],[r,r if r2 is None else r2],mat,n)
def orb(p,scale,mat,n=16,lat=10):
 p=Vector(p);v=[p+Vector((0,0,scale[2]))];f=[]
 for i in range(1,lat):
  t=pi*i/lat
  for j in range(n):v.append(p+Vector((scale[0]*sin(t)*cos(2*pi*j/n),scale[1]*sin(t)*sin(2*pi*j/n),scale[2]*cos(t))))
 v.append(p-Vector((0,0,scale[2])));last=len(v)-1
 for j in range(n):f.append((0,1+j,1+(j+1)%n));f.append((last,1+(lat-2)*n+(j+1)%n,1+(lat-2)*n+j))
 for i in range(lat-2):
  for j in range(n):a=1+i*n+j;b=1+i*n+(j+1)%n;f.append((a,a+n,b+n,b))
 geom(v,f,mat,True)
def plate(points,thick,mat):
 p=list(map(Vector,points));n=(p[1]-p[0]).cross(p[2]-p[0]).normalized();v=[q-n*thick/2 for q in p]+[q+n*thick/2 for q in p];l=len(p)
 f=[tuple(reversed(range(l))),tuple(range(l,2*l))]+[(i,(i+1)%l,(i+1)%l+l,i+l) for i in range(l)];geom(v,f,mat)
def aperture(points,center,ratio,thick,mat):
 p=list(map(Vector,points));c=Vector(center);n=(p[1]-p[0]).cross(p[2]-p[0]).normalized();l=len(p)
 inner=[c+(q-c)*ratio for q in p]
 v=[q+n*thick/2 for q in p]+[q+n*thick/2 for q in inner]+[q-n*thick/2 for q in p]+[q-n*thick/2 for q in inner]
 f=[]
 for i in range(l):
  j=(i+1)%l;f.extend([(i,j,l+j,l+i),(2*l+j,2*l+i,3*l+i,3*l+j),(j,i,2*l+i,2*l+j),(l+i,l+j,3*l+j,3*l+i)])
 geom(v,f,mat)
def spike(points,r,mat='Ivory'):
 tube(points,[r*(1-i/(len(points)-1))+.004 for i in range(len(points))],mat,10)
def blade_horn(points,r,mat='Ivory • ceramic bone'):
 tube(points,[(r*(1-i/(len(points)-1))+.003,r*.34*(1-i/(len(points)-1))+.002) for i in range(len(points))],mat,6,False)
def bone(a,b,r):
 a=Vector(a);b=Vector(b);d=b-a
 tube([a,a+d*.16,a+d*.46,a+d*.8,b],[r*.8,r,r*.65,r*.9,r*.72],'Ivory • ceramic bone')
def joint(p,r,axis=(0,1,0)):
 p=Vector(p);d=Vector(axis).normalized()
 rod(p-d*r*.62,p+d*r*.62,r,'Joint recess',n=20)
 for s in (-1,1):
  rod(p+d*s*r*.63,p+d*s*r*.77,r*.86,'Edge steel',n=20)
  rod(p+d*s*r*.77,p+d*s*r*.8,r*.53,'Graphite titanium',n=20)
  orb(p+d*s*r*.82,(r*.22,)*3,'Amber reactor',12,8)
def piston(a,b,r=.12):
 a=Vector(a);b=Vector(b);d=b-a
 rod(a,b,r*.48,'Piston chrome');rod(a,a+d*.57,r,'Graphite titanium');rod(a+d*.04,a+d*.11,r*1.17,'Edge steel');rod(a+d*.5,a+d*.58,r*1.13,'Edge steel')
def scale(p,n,t,w,h,mat='Gold scales',surface=None):
 p=Vector(p);n=Vector(n).normalized();t=Vector(t).normalized();t=(t-n*t.dot(n)).normalized();u=t.cross(n).normalized()
 w*=1.24
 v=[p-t*h*.52,p-u*w*.50-t*h*.10,p-u*w*.40+t*h*.29,p+t*h*.66,p+u*w*.40+t*h*.29,p+u*w*.50-t*h*.10,p+n*w*.075,p-n*.018]
 if surface:
  for i in range(8):
   if len(surface)==3:
    center,axis,radius=surface;delta=v[i]-center;axial=axis*delta.dot(axis);normal=(delta-axial).normalized();base=center+axial+normal*radius
   else:
    center,sz=surface;center=Vector(center);delta=v[i]-center;rad=math.sqrt(sum((delta[k]/sz[k])**2 for k in range(3)));base=center+delta/rad
    normal=Vector([(base[k]-center[k])/(sz[k]*sz[k]) for k in range(3)]).normalized()
   lift=.012 if i<6 else (.020 if i==6 else -.006)
   # Thin, gently domed shells follow the body rather than a pyramid on a sphere.
   v[i]=base+normal*lift
 f=[]
 for i in range(6):f.extend([(i,(i+1)%6,6),((i+1)%6,i,7)])
 geom(v,f,mat,False)
def scaled_ellipsoid(p,sz,step=.17):
 orb(p,sz,'Gold underhide',32,20);p=Vector(p)
 rows=max(8,int(pi*max(sz)/step));cols=max(16,int(2*pi*max(sz[0],sz[1])/step));dt=pi/rows;dp=2*pi/cols
 for i in range(1,rows):
  t=pi*i/rows
  for j in range(cols):
   ph=dp*(j+.5*(i%2))
   def tilepoint(dx,dy,lift):
    tt=max(.002,min(pi-.002,t+dy*dt));pp=ph+dx*dp;u=Vector((sin(tt)*cos(pp),sin(tt)*sin(pp),cos(tt)))
    q=p+Vector((u.x*sz[0],u.y*sz[1],u.z*sz[2]));n=Vector((u.x/sz[0],u.y/sz[1],u.z/sz[2])).normalized();return q+n*lift
   v=[tilepoint(0,-.62,.007),tilepoint(-.65,-.26,.011),tilepoint(-.63,.33,.022),tilepoint(0,.80,.029),tilepoint(.63,.33,.022),tilepoint(.65,-.26,.011),tilepoint(0,.10,.027),tilepoint(0,0,-.012)]
   f=[]
   for k in range(6):f.extend([(k,(k+1)%6,6),((k+1)%6,k,7)])
   geom(v,f,'Gold variations' if random.random()<.06 else 'Gold scales',False)

# Low, powerful quadruped torso. X is longitudinal, -X faces the prey.
scaled_ellipsoid((-.4,0,2.6),(1.95,.88,1.03),.18)
for s in (-1,1):
 region='Shoulder.'+str(s);scaled_ellipsoid((-1.42,s*.66,2.94),(.75,.48,.84),.15)
region='Ventral armour'
for i in range(13):
 x=-2+i*.285;z=1.69+.13*((x+.4)/1.7)**2
 for s in (-1,1):
  plate([(x-.21,0,z-.07),(x+.10,0,z-.16),(x+.32,s*.70,z+.29),(x+.05,s*.79,z+.40),(x-.14,s*.65,z+.23)],.09,'Ivory • ceramic bone')
# Broad chevron breastplate follows the chest surface all the way into the belly.
region='Pectoral chevrons'
def breast(y,z):
 inside=max(.06,1-(y/.94)**2-((z-2.60)/1.12)**2)
 return Vector((-.4-1.98*math.sqrt(inside)-.045,y,z))
for i in range(10):
 z=3.25-i*.158;width=.46+.21*sin(i/9*pi)
 for s in (-1,1):
  plate([breast(0,z-.13),breast(s*width*.5,z-.055),breast(s*width,z+.10),breast(s*width,z-.06),breast(s*width*.5,z-.23),breast(0,z-.31)],.065,'Ivory • ceramic bone')

# S-shaped long neck: dense individually modelled overlapping scales.
region='Neck'
NP=[(-1.7,0,2.98),(-2.08,0,3.35),(-2.36,0,3.92),(-2.71,0,4.5),(-3.22,0,4.82),(-3.78,0,4.83),(-4.10,0,4.72)]
NR=[.64,.62,.55,.47,.40,.34,.31]
curve=[]
for k in range(len(NP)-1):
 p0=Vector(NP[max(0,k-1)]);p1=Vector(NP[k]);p2=Vector(NP[k+1]);p3=Vector(NP[min(len(NP)-1,k+2)])
 for ii in range(24):
  t=ii/24;p=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
  r=NR[k]*(1-t)+NR[k+1]*t
  if not curve or (p-curve[-1][0]).length>=.10:curve.append((p,r))
curve.append((Vector(NP[-1]),NR[-1]));tube([p for p,r in curve],[r for p,r in curve],'Gold underhide',28)
samples=[]
for i,(p,r) in enumerate(curve):
 d=(curve[min(i+1,len(curve)-1)][0]-curve[max(i-1,0)][0]).normalized();u,v=frame(d);samples.append((p,r,d,u,v))
for k,(p,r,d,u,v) in enumerate(samples):
 underside=Vector((-.78,0,-.62));underside=(underside-d*underside.dot(d)).normalized()
 count=max(12,int(2*pi*r/.135))
 for j in range(count):
  ang=2*pi*(j+.5*(k%2))/count;n=u*cos(ang)+v*sin(ang)
  if n.dot(underside)<.62:scale(p+n*r,n,-d,.147,.18,'Gold variations' if random.random()<.1 else 'Gold scales',(p,d,r))
 if k%2==0:
  # Continuous chevron half-shells hug the curved throat and overlap axially.
  for j in range(8):
   a=-1.06+j*2.12/8;b=-1.06+(j+1)*2.12/8
   n1=underside*cos(a)+Vector((0,sin(a),0));n2=underside*cos(b)+Vector((0,sin(b),0))
   shift1=-d*(.13*(1-abs(a)/1.06));shift2=-d*(.13*(1-abs(b)/1.06))
   plate([p+n1*r*1.035-d*.165+shift1,p+n2*r*1.035-d*.165+shift2,p+n2*r*1.055+d*.165+shift2,p+n1*r*1.055+d*.165+shift1],.04,'Ivory • ceramic bone')
 if k%4==0:
  q=p+Vector((.14,0,r*.86));spike([q,q+Vector((.21,0,.3)),q+Vector((.61,0,.46))],r*.22,'Graphite titanium')
for s in (-1,1):
 tube([(x+.20,s*r*.73,z+r*.54) for (x,y,z),r in zip(NP,NR)],[.065]*len(NP),'Graphite titanium',10)
 for k in (1,3,5):joint((NP[k][0]+.2,s*NR[k]*.76,NP[k][2]+NR[k]*.57),.13)

# Skull: fenestrated cheek lattice, layered brow and narrow tapered maxilla.
region='Skull'
tube([(-4.0,0,4.75),(-4.35,0,4.82),(-4.74,0,4.71),(-5.19,0,4.49),(-5.43,0,4.4)],[(.27,.30),(.33,.34),(.22,.25),(.12,.17),(.07,.12)],'Graphite titanium',16)
for s in (-1,1):
 def H(x,y,z):return Vector((x,s*y,z))
 # Open skeletal struts; holes remain actual holes around jaw and cheek.
 for a,b,r in [((-5.43,.12,4.4),(-5.13,.22,4.67),.075),((-5.13,.22,4.67),(-4.68,.31,4.99),.095),((-4.68,.31,4.99),(-4.10,.28,5.12),.11),((-5.4,.12,4.4),(-4.97,.24,4.39),.075),((-4.97,.24,4.39),(-4.41,.36,4.49),.07),((-4.41,.36,4.49),(-3.94,.31,4.73),.085),((-4.89,.26,4.43),(-4.69,.33,4.77),.064),((-4.57,.34,4.46),(-4.33,.41,4.75),.07),((-4.33,.41,4.75),(-4.08,.28,5.12),.075)]:bone(H(*a),H(*b),r)
 plate([H(-5.35,.12,4.5),H(-4.99,.22,4.83),H(-4.41,.22,5.04),H(-4.65,.35,4.8),H(-5.13,.23,4.56)],.07,'Ivory highlights')
 # Eye nests below slanting brow, optic points out from side.
 orb(H(-4.57,.31,4.76),(.21,.09,.13),'Joint recess')
 orb(H(-4.58,.389,4.765),(.077,.037,.042),'Eye ember')
 bone(H(-4.84,.34,4.84),H(-4.31,.38,4.99),.065)
 aperture([H(-4.89,.35,4.77),H(-4.75,.36,4.95),H(-4.37,.34,5.04),H(-4.20,.35,4.82),H(-4.42,.38,4.65),H(-4.67,.37,4.65)],H(-4.57,.37,4.80),.58,.065,'Ivory highlights')
 aperture([H(-5.39,.15,4.43),H(-5.18,.22,4.67),H(-4.90,.27,4.67),H(-4.76,.30,4.43),H(-5.07,.22,4.36)],H(-5.1,.225,4.49),.48,.045,'Ivory • ceramic bone')
 joint(H(-4.04,.32,4.77),.18)
 # swept horns and overlapping cheek blades
 for j in range(4):
  a=H(-4.72+j*.27,.14+j*.067,4.97+.05*j)
  blade_horn([a,a+Vector((.23,s*.055,.22)),a+Vector((.61+j*.1,s*.15,.5+j*.065))],.15+j*.021)
 for j in range(3):
  a=H(-4.36+j*.2,.28,4.59+.08*j);spike([a,a+Vector((.32,s*.07,.09)),a+Vector((.62,s*.16,.25))],.08,'Ivory highlights')
 # Mandible drops away leaving a deep tooth-filled mouth.
 jaw=[H(-4.02,.28,4.62),H(-4.32,.31,4.18),H(-4.86,.23,3.95),H(-5.18,.115,4.04)]
 tube(jaw,[.10,.09,.065,.035],'Ivory • ceramic bone',10)
 aperture([H(-4.06,.31,4.59),H(-4.23,.34,4.26),H(-4.79,.25,3.95),H(-5.18,.12,4.04),H(-4.79,.25,4.10),H(-4.36,.34,4.36)],H(-4.52,.285,4.22),.59,.06,'Ivory • ceramic bone')
 bone(H(-4.09,.31,4.55),H(-4.48,.3,4.12),.053)
 for j in range(12):
  t=j/11;x=-5.26+t*1.12;y=.15+t*.15;z=4.40+t*.13
  length=.28 if j in (2,8) else .12+.055*sin(t*pi)+.025*(j%3)/2
  spike([H(x,y,z),H(x+.025,y,z-.075),H(x+.06,y*.94,z-length)],.046 if j in (2,8) else .03,'Teeth')
 for j in range(11):
  t=j/10;x=-5.13+t*.89;y=.13+t*.16;z=4.02+max(0,t-.35)*.26
  spike([H(x,y,z),H(x-.025,y,z+.06),H(x-.045,y*.95,z+(.22 if j in (1,7) else .105+.025*(j%3)))],.037 if j in (1,7) else .025,'Teeth')
 # nostril cavities and plates, not painted spots
 orb(H(-5.22,.162,4.54),(.066,.028,.048),'Joint recess',12,8)
bone((-5.18,-.11,4.04),(-5.18,.11,4.04),.04)
for j in range(5):
 x=-4.94+j*.22;blade_horn([(x,0,4.88+(x+4.94)*.25),(x+.16,0,5.15+(x+4.94)*.32),(x+.45,0,5.39+(x+4.94)*.35)],.13,'Ivory highlights')

# Four distinct feet, long articulated digits, recurved black claws.
for s in (-1,1):
 for hind in (False,True):
  region=('Hindlimb' if hind else 'Forelimb')+('.L' if s<0 else '.R')
  if hind:
   hip=(1.05,s*.73,2.63);knee=(1.55,s*1.03,1.76);ankle=(2.51,s*1.04,.98);wrist=(2.05,s*1.20,.52)
   scaled_ellipsoid((1.14,s*.80,2.32),(.7,.52,.88),.15)
  else:hip=(-1.55,s*.78,2.84);knee=(-1.76,s*1.03,1.82);ankle=(-2.47,s*1.22,1.15);wrist=(-2.88,s*1.33,.61)
  pts=[hip,knee,ankle,wrist]
  for a,b in zip(pts,pts[1:]):
   rod(a,b,.13,'Joint recess');a=Vector(a);b=Vector(b)
   for side in (-1,1):
    off=Vector((.06,side*.135,0));bone(a+off,b+off,.135)
   piston(a+Vector((.13,s*.11,.07)),b+Vector((.13,s*.11,.1)),.073)
  for p,r in zip(pts,[.29,.23,.19,.18]):joint(p,r)
  # Branching fenestrated bone shell surrounds each mechanical limb segment.
  a=Vector(knee);b=Vector(ankle);d=b-a;u=Vector((0,s*.20,0))
  for aa,bb,rr in [(Vector(hip),a,.27),(a,b,.23),(b,Vector(wrist),.19)]:
   dd=bb-aa
   for edge in (-1,1):
    offs=Vector((edge*rr,0,0))
    tube([aa+u,aa+dd*.18+u+offs,aa+dd*.7+u+offs*.55,bb+u],[rr*.42,rr*.30,rr*.25,rr*.40],'Ivory • ceramic bone',10)
   for t in (.25,.66):
    q=aa+dd*t+u
    bone(q+Vector((-rr*.72,0,.08)),q+Vector((rr*.75,0,-.07)),rr*.18)
  for t in (.22,.72):orb(a+d*t+u*1.1,(.041,.025,.041),'Joint recess',10,6)
  wx,wy,wz=wrist
  for j in range(4):
   yy=wy+(j-1.5)*.27;reach=.64-.12*abs(j-1.5);a=(wx,wy+(j-1.5)*.12,wz);b=(wx-.24,yy,wz-.04);c=(wx-reach,yy+s*.04,.42)
   bone(a,b,.108);bone(b,c,.084);joint(b,.09)
   tube([c,(c[0]-.19,c[1],.49),(c[0]-.38,c[1],.34),(c[0]-.49,c[1],.13),(c[0]-.50,c[1],.025)],[.145,.13,.09,.042,.004],'Graphite titanium',12)
  # medial dewclaw
  spike([(wx+.04,wy-s*.2,.35),(wx-.07,wy-s*.37,.27),(wx-.24,wy-s*.37,.17)],.075,'Graphite titanium')

# Mechanical spine and segmented scythe tail.
region='Dorsal spine'
for i in range(14):
 x=-1.62+i*.245;z=3.52-.22*((x+.3)/1.9)**2
 joint((x,0,z),.18,axis=(1,0,0))
 for s in (-1,1):
  plate([(x-.16,s*.1,z),(x+.12,s*.40,z-.04),(x+.29,s*.51,z+.12),(x+.1,s*.12,z+.2)],.065,'Ivory • ceramic bone')
 spike([(x,0,z+.10),(x+.13,0,z+.43),(x+.44,0,z+.56)],.14,'Graphite titanium')
region='Tail'
TP=[(1.44,0,2.53),(2.20,0,2.17),(3.14,.05,1.91),(4.15,.14,2.02),(5.22,.23,2.53),(6.25,.30,2.97),(7.08,.29,2.83),(7.74,.23,2.20)]
TR=[.39,.33,.26,.22,.20,.18,.15,.095]
tube(TP,TR,'Joint recess',16)
for k in range(len(TP)-1):
 a=Vector(TP[k]);b=Vector(TP[k+1]);N=4
 for j in range(N):
  t=j/N;p=a.lerp(b,t);r=TR[k]*(1-t)+TR[k+1]*t;d=(b-a).normalized();u,v=frame(d)
  rod(p-d*.10,p+d*.08,r*1.10,'Edge steel',n=12)
  for s in (-1,1):
   # jagged vertebral plates fork out from a dark visible core
   plate([p+Vector((-.17,s*r*.52,r*.75)),p+Vector((.03,s*r*1.55,r*.30)),p+Vector((.36,s*r*1.95,r*.85)),p+Vector((.24,s*r*.65,r*1.25))],.07,'Ivory • ceramic bone')
   bone(p+Vector((-.13,s*r,.02)),p+Vector((.19,s*r,-r*.67)),r*.29)
   tube([p+Vector((-.07,0,r*1.05)),p+Vector((-.09,s*r*.84,r*.7)),p+Vector((-.02,s*r*1.15,-r*.12)),p+Vector((.1,s*r*.66,-r*.8))],[r*.31,r*.29,r*.27,r*.19],'Ivory • ceramic bone',8)
  spike([p+Vector((0,0,r)),p+Vector((.16,0,r+.24)),p+Vector((.43,0,r+.38))],r*.46,'Graphite titanium')
plate([(7.25,-.06,3.01),(7.65,-.04,2.91),(7.98,-.02,2.59),(8.19,0,2.17),(8.34,0,1.71),(8.41,0,1.16),(8.05,.02,1.84),(7.82,.03,2.09),(7.45,.04,2.21)],.18,'Blade steel')
plate([(7.29,-.10,3.0),(7.66,-.09,2.87),(7.99,-.08,2.52),(8.18,-.07,2.12),(8.34,-.06,1.56),(8.41,0,1.16),(8.02,-.06,2.0),(7.63,-.07,2.5)],.05,'Ivory • ceramic bone')
for s in (-1,1):orb((7.62,s*.11,2.53),(.1,.04,.13),'Amber reactor')

# Separate wings. Articulated spars and nested swept cutting panels.
for s in (-1,1):
 region='Wing mechanism'+('.L' if s<0 else '.R')
 def W(x,y,z):return Vector((x,s*y,z))
 shoulder=W(-1.0,.71,3.25);elbow=W(.04,1.49,4.36);wrist=W(-.45,3.12,6.83)
 for a,b,r in [(shoulder,elbow,.29),(elbow,wrist,.205)]:
  rod(a,b,r,'Graphite titanium',n=20)
  for q in (-1,1):
   off=Vector((q*.18,s*.09,0));piston(a+off,b+off,r*.34)
  for t in (.15,.35,.56,.77):
   p=a.lerp(b,t);d=(b-a).normalized();rod(p-d*.052,p+d*.052,r*1.15,'Edge steel',n=16)
  joint(a,r*1.5)
 joint(wrist,.29)
 for q in range(3):
  a=elbow.lerp(wrist,.16+q*.25)
  plate([a+Vector((-.28,0,-.3)),a+Vector((-.37,0,.21)),a+Vector((.03,s*.18,.45)),a+Vector((.15,s*.19,-.2))],.15,'Ivory • ceramic bone')
  orb(a+Vector((-.31,-s*.05,0)),(.07,.06,.12),'Amber reactor')
 # Primary feather panel fan from elevated wrist, long top-most spear.
 region='Wing blades'+('.L' if s<0 else '.R')
 for j in range(9):
  t=j/8
  root=W(-.37+.27*t,3.08-.26*t,6.76-.48*t)
  angle=-1.34*t;length=5.84-2.35*t
  tip=root+W(cos(angle)*length*.82,cos(angle)*length*.57+.18*sin(t*pi),sin(angle)*length+.55)
  d=tip-root;across=Vector((sin(angle)*.82,s*sin(angle)*.57,-cos(angle))).normalized();wid=.23+.28*sin(t*pi*.86)
  normal=d.cross(across).normalized()
  if normal.y*s<0:normal=-normal
  # asymmetric angular flight panel with a sharp leading ridge
  pts=[root-across*wid*.5,root+d*.40-across*wid*.86,tip,root+d*.66+across*wid*.70,root+d*.22+across*wid,root+across*wid*.7]
  plate(pts,.085,'Blade steel' if j%3 else 'Graphite titanium')
  plate([root+d*.11-across*wid*.40,root+d*.53-across*wid*.55,tip,root+d*.50-across*wid*.30],.025,'Edge steel')
  # Raised folded ridge and overlapping panels catch light as real geometry.
  for a1,b1 in ((.14,.43),(.45,.70),(.72,.90)):
   width=wid*(1-a1*.75)
   left=root+d*a1-across*width*.52+normal*.055;right=root+d*a1+across*width*.52+normal*.055
   end=root+d*b1+normal*.065;ridge=root+d*(a1+.06)+normal*.125
   plate([left,ridge,end],.018,'Blade steel');plate([ridge,right,end],.018,'Graphite titanium')
  rod(root+normal*.13,root+d*.63+normal*.13,.043,'Graphite titanium',.020,8)
  piston(root+normal*.18,root+d*.32+normal*.18,.075)
  # plate seam and recessed rivet rows
  for t2 in (.24,.47,.67):
   q=root+d*t2+normal*.07
   rod(q-across*wid*.35,q+across*wid*.50,.013,'Joint recess',n=6)
   for edge in (-.32,.39):orb(q+across*wid*edge+normal*.02,(.024,)*3,'Piston chrome',8,6)
  joint(root,.11)
 # Layer of shorter inward secondaries, clearly overlapping rather than membranes
 for j in range(6):
  t=j/5;r=elbow.lerp(wrist,.16+.70*t);tip=r+W(1.24, .90, -1.42+.65*t)
  plate([r+Vector((-.13,0,.1)),r+W(.50,.15,.06),tip,r+W(.19,.24,-.61)],.07,'Graphite titanium')
 # Five wingtip missiles, four corners plus a central barrel.
 region='Launcher'+('.L' if s<0 else '.R')
 for off in (-.19,.19):
  p=wrist+W(-.16,off,.13)
  rod(p+Vector((.75,0,0)),p+Vector((-.80,0,0)),.14,'Graphite titanium',n=16)
 for j in range(5):
  lateral=(j%2-.5)*.42 if j<4 else 0
  vertical=(j//2-.5)*.42 if j<4 else 0
  p=wrist+W(-.12,lateral,vertical+.1)
  rod(p+Vector((.6,0,0)),p+Vector((-1.02,0,0)),.122,'Edge steel',n=16)
  rod(p+Vector((-.9,0,0)),p+Vector((-1.17,0,0)),.124,'Carmine warhead',.066,n=16)
  rod(p+Vector((-1.17,0,0)),p+Vector((-1.43,0,0)),.066,'Carmine warhead',.003,n=16)
  rod(p+Vector((-.77,0,0)),p+Vector((-.84,0,0)),.129,'Amber reactor',n=16)
 for dx in (-.49,.15):
  for side in (-1,1):
   y=3.12+side*.35
   plate([W(-.45+dx,y,6.42),W(-.18+dx,y,6.45),W(-.18+dx,y,7.19),W(-.45+dx,y,7.21)],.10,'Ivory highlights')
   for z in (6.57,7.06):orb(W(-.32+dx,y+side*.063,z),(.05,.035,.05),'Joint recess',10,6)
  bone(W(-.30+dx,2.78,7.20),W(-.30+dx,3.48,7.20),.065)
 # Sculpted launcher cheeks and a downward hook visible in the reference.
 for side in (-1,1):
  yy=3.12+side*.38
  aperture([W(-.99,yy,6.56),W(-1.10,yy,6.95),W(-.89,yy,7.21),W(.28,yy,7.22),W(.43,yy,7.02),W(.30,yy,6.66)],W(-.35,yy,6.94),.66,.075,'Ivory • ceramic bone')
  for xx in (-.79,.13):
   orb(W(xx,yy+side*.045,7.1),(.034,.018,.034),'Graphite titanium',10,6)
  tube([W(-.75,yy,6.66),W(-.92,yy,6.42),W(-.94,yy,6.14),W(-1.18,yy,6.23)],[.10,.085,.05,.004],'Ivory highlights',10)

# Material groups inside semantic collections are editable, not one flattened object.
root=bpy.data.objects.new('ORDION | 金骸機竜オルディオン',None);bpy.context.collection.objects.link(root)
root['reference']='reference.jpg';root['scope']='Static reference reconstruction; inferred hidden surfaces; no gameplay or rig acceptance claimed'
root['revision']='v5';root['dimensions']='14 m length / 7.5 m height / Z=0 claw contact'
for (part,mat,sm),(v,f) in G.items():
 col=bpy.data.collections.get(part)
 if col is None:col=bpy.data.collections.new(part);bpy.context.scene.collection.children.link(col)
 mesh=bpy.data.meshes.new(part+' / '+mat);mesh.from_pydata(v,[],f);mesh.materials.append(M[mat]);mesh.update()
 ob=bpy.data.objects.new(part+' / '+mat,mesh);col.objects.link(ob);ob.parent=root
 for poly in mesh.polygons:poly.use_smooth=sm
 # Fix winding consistently for closed fabricated parts.
 import bmesh
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
model=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Normalize reference length exactly while preserving proportion.
verts=[o.matrix_world@v.co for o in model for v in o.data.vertices]
low=min(v.x for v in verts);high=max(v.x for v in verts);factor=14/(high-low)
for o in model:
 for v in o.data.vertices:v.co*=factor
bpy.context.view_layer.update()
zmin=min(v.co.z for o in model for v in o.data.vertices);zmax=max(v.co.z for o in model for v in o.data.vertices)
for o in model:
 for v in o.data.vertices:v.co.z=(v.co.z-zmin)*7.5/(zmax-zmin)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.world.color=(.25,.25,.25);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.36,.41,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX'
studio=bpy.data.collections.new('Studio • not exported');scene.collection.children.link(studio)
def studio_obj(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 studio.objects.link(o)
floor=material('Studio ground',(.15,.18,.20),.0,.8)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018));ground=bpy.context.object;ground.name='Studio ground';ground.data.materials.append(floor);studio_obj(ground)
def area(n,p,power,size,color):
 d=bpy.data.lights.new(n,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(n,d);studio.objects.link(o);o.location=p;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large warm key',(-7,-9,13),2800,8,(1,.91,.76));area('Cool rim',(4,6,12),3600,7,(.72,.84,1));area('Soft front',(-10,3,7),1800,6,(1,.97,.9));area('Wing fill',(5,-7,8),1800,6,(1,1,1))
def camera(n,pos,target,scale):
 d=bpy.data.cameras.new(n);d.type='ORTHO';d.ortho_scale=scale;o=bpy.data.objects.new(n,d);studio.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
cams={
 'hero':camera('01 • Hero',(-12,-19,10),(1,0,3.3),19.0),
 'side':camera('02 • Left', (1,-25,3.8),(1,0,3.8),16.6),
 'front':camera('03 • Front',(-24,0,4),(0,0,3.8),15.2),
 'back':camera('04 • Back',(26,0,5),(0,0,3.8),15.2),
 'top':camera('05 • Top',(1,0,28),(1,0,0),19.2),
 'head':camera('06 • Skull',(-9,-9,6.1),(-4.3,0,4.66),3.8),
 'wing':camera('07 • Wing',(3,-14,9),(1.1,-3.4,5.7),8.8)
}
scene.camera=cams['hero']
bpy.ops.object.select_all(action='DESELECT')
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=model[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'ordion.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
for o in model:o.select_set(False)
# Pack the original drawing for convenient editing without external paths.
im=bpy.data.images.load(str(OUT/'reference.jpg'));im.pack()
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_distance=20;a.spaces.active.region_3d.view_location=(0,0,3);a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ordion.blend'))
stats={'blender':bpy.app.version_string,'seed':240920,'meshes':len(model),'vertices':sum(len(o.data.vertices) for o in model),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in model),'materials':len(M)-1,'length_m':14,'scope':'Static model, no rig / animation / gameplay integration','views':list(cams)}
coords=[o.matrix_world@v.co for o in model for v in o.data.vertices];stats['bounds']={ax:[min(v[i] for v in coords),max(v[i] for v in coords)] for i,ax in enumerate('xyz')}
(OUT/'build-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf8')
views=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hero','side','front','back','top','head','wing']
for view in views:
 scene.camera=cams[view];scene.render.filepath=str(OUT/(view+'.png'));bpy.ops.render.render(write_still=True)
print('ORDION_BUILD_COMPLETE',json.dumps(stats))
