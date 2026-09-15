"""Reproducible six-map Blender/PBR production. Shared game geometry is the input.
Game (x,height,z) -> Blender (x,-z,height); glTF restores game coordinates.
"""
from pathlib import Path
import bpy, math, json, random, numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SPEC=json.loads((ROOT/'assets/blender/maps-layout-v1.json').read_text())
OUT=ROOT/'public/assets/maps'; OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'assets/blender/source/maps'; SOURCE.mkdir(parents=True,exist_ok=True)
QA=ROOT/'dist-validation/maps-blender'; QA.mkdir(parents=True,exist_ok=True)
TEX=ROOT/'assets/blender/textures/maps'; TEX.mkdir(parents=True,exist_ok=True)
random.seed(2109)
bpy.context.preferences.filepaths.save_version=0

def texture(name,base,kind):
    n=256; yy,xx=np.mgrid[0:n,0:n]; rng=np.random.default_rng(sum(map(ord,name)))
    noise=np.zeros((n,n),dtype=np.float32)
    for freq,weight in [(4,.13),(12,.09),(32,.045),(96,.018)]:
        grid=rng.uniform(-1,1,(freq,freq));gx=xx/n*freq;gy=yy/n*freq
        ix=gx.astype(int);iy=gy.astype(int);fx=gx-ix;fy=gy-iy
        fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
        noise+=weight*((1-fx)*(1-fy)*grid[iy%freq,ix%freq]+fx*(1-fy)*grid[iy%freq,(ix+1)%freq]+(1-fx)*fy*grid[(iy+1)%freq,ix%freq]+fx*fy*grid[(iy+1)%freq,(ix+1)%freq])
    noise+=rng.normal(0,.013,(n,n))
    if kind=='rock': noise-=np.maximum(0,np.cos(yy*.11+np.sin(xx*.015)*2)-.96)*.4
    if name=='granular_snow':noise*=.12
    if kind=='concrete':noise*=.45
    paths=[]
    for channel in ['base','normal','rough']:
        rgba=np.ones((n,n,4),dtype=np.float32)
        if channel=='base': rgba[:,:,:3]=np.clip(np.array(base)[None,None,:]*(1+noise[:,:,None]*1.7),0,1)
        elif channel=='rough': rgba[:,:,:3]=np.clip(.8+noise[:,:,None]*.4,.45,1)
        else:
            dx=(np.roll(noise,-1,axis=1)-np.roll(noise,1,axis=1))*1.7
            dy=(np.roll(noise,-1,axis=0)-np.roll(noise,1,axis=0))*1.7
            normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
            rgba[:,:,:3]=normal*.5+.5
        image=bpy.data.images.new(name+'_'+channel,width=n,height=n,alpha=True)
        if channel!='base': image.colorspace_settings.name='Non-Color'
        image.pixels.foreach_set(rgba.ravel()); image.filepath_raw=str(TEX/(name+'_'+channel+'.png')); image.file_format='PNG'; image.save(); image.pack(); paths.append(image)
    return paths

MATS={}
def material(name,base,kind='rock',metal=0,emit=0,rough=.8):
    if name in MATS:return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*base,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*base,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emit:p.inputs['Emission Color'].default_value=(*base,1);p.inputs['Emission Strength'].default_value=emit
    if kind:
        images=texture(name,base,kind)
        for i,image in enumerate(images):
            node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
            if i==0:m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
            elif i==1:
                normal=m.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.3
                m.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
            else:m.node_tree.links.new(node.outputs['Color'],p.inputs['Roughness'])
    MATS[name]=m;return m
stone=material('weathered_granite',(.30,.32,.30),'rock')
cave=material('layered_limestone',(.31,.255,.19),'rock')
concrete=material('aged_concrete',(.39,.42,.41),'concrete')
brick=material('warm_facade',(.40,.31,.245),'concrete')
steel=material('galvanized_steel',(.20,.25,.27),'steel',.65,rough=.45)
rust=material('oxidized_metal',(.38,.20,.10),'steel',.3)
glass=material('smoked_glass',(.045,.12,.16),None,.55,rough=.2)
grass=material('meadow_ground',(.225,.30,.115),'grass')
leaf=material('foliage',(.14,.23,.065),'grass')
soil=material('earth',(.29,.23,.16),'soil')
snow=material('granular_snow',(.81,.88,.91),'soil')
asphalt=material('road_asphalt',(.115,.135,.14),'soil')
paint=material('worn_road_paint',(.67,.63,.44),'concrete')
light=material('warm_lamps',(1,.66,.27),None,0,1.8)
crystal=material('mineral_vein',(.18,.50,.51),'rock',.2,.25)
bark=material('tree_bark',(.24,.18,.12),'rock')

def add(m,verts,faces):
    batch=BATCH.setdefault(m.name,[[],[]]);offset=len(batch[0]);batch[0].extend(verts);batch[1].extend(tuple(i+offset for i in f) for f in faces)
def box(m,x,y,z,w,h,d):
    v=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    add(m,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
def tube(m,a,b,r,n=10,r2=None):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0)))
    if u.length<.01:u=axis.cross(Vector((1,0,0)))
    u.normalize();v=axis.cross(u);r2=r if r2 is None else r2
    vertices=[tuple(p+(u*math.cos(i/n*math.tau)+v*math.sin(i/n*math.tau))*rad) for p,rad in [(a,r),(b,r2)] for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    add(m,vertices,faces)
def rock(x,z,w,d,h,snowy=False):
    ring=[(-1,-1),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0)]
    vertices=[]
    for j in range(6):
        f=j/5
        for i,(sx,sz) in enumerate(ring):
            scale=1 if j==0 else (1-f*.65)*(1+.1*math.sin(i*4+j*2+x))
            vertices.append((x+sx*w/2*scale,h*f,z+sz*d/2*scale))
    for j in range(5):
        for i in range(8):
            f=[j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i]
            add(snow if snowy and j>=3 else stone,[vertices[k] for k in f],[(0,1,2),(0,2,3)])
    add(snow if snowy else stone,vertices[40:48],[tuple(range(8))])
def tree(x,z,height,pine=False):
    tube(bark,(x,0,z),(x,height*.85,z),.3,8,r2=.13)
    for i in range(5):
        y=height*(.35+i*.12);r=(height*.30)*(1-i*.14)
        if pine:tube(leaf,(x,y,z),(x,y+height*.30,z),r,9,r2=.1)
        else:
            for a in range(5):
                angle=a/5*math.tau+i;tx=x+math.cos(angle)*r;tz=z+math.sin(angle)*r
                tube(bark,(x,y,z),(tx,y+1,tz),.1,5,r2=.03)
                mound(leaf,tx,y+1,tz,2.0,1.5,1.8,12,7)

def mound(m,x,y,z,rx,ry,rz,n=24,k=9):
    verts=[]
    for j in range(k+1):
        phi=-math.pi/2+j/k*math.pi
        for i in range(n):
            theta=i/n*math.tau;rough=1+.06*math.sin(i*3+j*7+x)
            verts.append((x+math.cos(phi)*math.cos(theta)*rx*rough,y+math.sin(phi)*ry,z+math.cos(phi)*math.sin(theta)*rz*rough))
    add(m,verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(k) for i in range(n)])

def mountain(x,z,w,h):
    n=24;k=9;v=[]
    for j in range(k+1):
        f=j/k
        for i in range(n):
            a=i/n*math.tau;r=w*(1-f)**.9*(1+.15*math.sin(i*2.4+j*.7+x))
            v.append((x+math.cos(a)*r,h*f,z+math.sin(a)*r))
    for j in range(k):
        for i in range(n):
            points=[v[j*n+i],v[j*n+(i+1)%n],v[(j+1)*n+(i+1)%n],v[(j+1)*n+i]]
            add(snow if j>3 else stone,points,[(0,1,2),(0,2,3)])

nodes=SPEC['nodes'];edges=SPEC['edges'];radius=SPEC['radius']
def clearance(x,z):
    best=-1e6
    for ai,bi in edges:
        a,b=nodes[ai],nodes[bi];dx=b['x']-a['x'];dz=b['z']-a['z'];t=max(0,min(1,((x-a['x'])*dx+(z-a['z'])*dz)/(dx*dx+dz*dz)))
        best=max(best,radius-math.hypot(x-a['x']-dx*t,z-a['z']-dz*t))
    for i in [1,5,9]:best=max(best,9-math.hypot(x-nodes[i]['x'],z-nodes[i]['z']))
    return best
def ceiling(x,z):
    c=clearance(x,z)
    return 0 if c<0 else 2+math.sqrt(max(0,radius*radius-max(0,radius-c)**2))*1.25

def build_cave():
    # Sample the same implicit interior as movement/rays. Sub-metre surface detail.
    s=.8;low=-86;count=215
    occupied={}; heights={}
    for i in range(count+1):
        for j in range(count+1):heights[i,j]=max(1.6,ceiling(low+i*s,low+j*s))
    for i in range(count):
        for j in range(count):occupied[i,j]=clearance(low+(i+.5)*s,low+(j+.5)*s)>=0
    for (i,j),inside in occupied.items():
        if not inside:continue
        x=low+i*s;z=low+j*s
        indices=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
        top=[(low+a*s,heights[a,b]+.05*math.sin(a*2+b*3),low+b*s) for a,b in indices]
        add(cave,top,[(0,1,2),(0,2,3)])
        add(soil,[(x,.005,z),(x,.005,z+s),(x+s,.005,z+s),(x+s,.005,z)],[(0,1,2,3)])
        for a,b,di,dj in [(0,1,0,-1),(1,2,1,0),(2,3,0,1),(3,0,-1,0)]:
            if not occupied.get((i+di,j+dj),False):add(cave,[(top[a][0],0,top[a][2]),top[a],top[b],(top[b][0],0,top[b][2])],[(0,1,2,3)])
    for i,p in enumerate(nodes):
        for j in range(4):
            x=p['x']+3.8+j*.2;z=p['z']+1.8
            tube(crystal,(x,0,z),(x+.25,.7+j*.3,z+.2),.18,6,r2=.025)

def buildings(mapdata,index):
    base=brick if index==1 else concrete
    for bi,b in enumerate(mapdata['blocks']):
        x,z,w,d,h=[b[k] for k in ['x','z','w','d','h']]
        box(base,x,h/2,z,w,h,d)
        box(steel,x,h+.18,z,w+.12,.36,d+.12)
        box(concrete,x,.12,z,w+.9,.24,d+.9)
        # Window panels and mullions remain dimensioned architectural details.
        for side in [-1,1]:
            if index==1:
                box(steel,x+side*(w/2+.04),2.0,z,.08,3.8,d*.55)
                for zz in np.arange(z-d*.25,z+d*.25,.42):box(rust,x+side*(w/2+.1),2,zz,.12,3.8,.04)
            else:
                for yy in np.arange(2,h-1,3):
                    for zz in np.arange(z-d/2+1.7,z+d/2-1,2.8):
                        box(steel,x+side*(w/2+.045),yy,zz,.09,1.9,1.65)
                        box(glass,x+side*(w/2+.10),yy+.08,zz,.05,1.55,1.35)
                        box(base,x+side*(w/2+.18),yy-.98,zz,.42,.12,1.9)
            for xx in np.arange(x-w/2+2,x+w/2-1,3.2):
                box(glass,xx,2.1,z+side*(d/2+.03),1.6,1.7,.06)
        # Roof equipment, ductwork and service piping.
        for j in range(3):
            xx=x+(j-1)*2.5
            box(steel,xx,h+.6,z,1.8,1.0,2.4)
            for k in range(7):box(glass,xx-.72+k*.24,h+1.12,z,.10,.03,2)
        tube(steel,(x-w*.3,0,z-d/2-.1),(x-w*.3,h,z-d/2-.1),.12,8)
        if index==2:
            tube(steel,(x,h,z),(x,h+7,z),1.1,16)
            tube(rust,(x+3,h,z),(x+3,h+4,z),.5,12)
            for j in range(3):box(paint,x,h+2+j*1.3,z,2.25,.3,2.25)
        if index==1:
            box(rust,x,h+1,z,w*.9,2,d*.9)
    for z in range(-100,101,6):box(paint,0,.018,z,.18,.02,2.7)
    for x in [-21,21]:box(paint,x,.018,0,.15,.02,206)
    for z in [-60,0,60]:
        for i in range(-7,8):box(paint,i*1.0,.023,z,.5,.02,4)
    for x in [-23,23]:
        for z in [-88,-44,0,44,88]:
            # Visual street furniture sits in a low non-blocking strip.
            tube(steel,(x,0,z),(x,7,z),.12,8)
            tube(steel,(x,7,z),(x-math.copysign(1.6,x),7,z),.1,8)
            box(light,x-math.copysign(1.5,x),6.95,z,.65,.10,.28)

def nature(mapdata,index):
    snowy=index==4
    for b in mapdata['blocks']:rock(b['x'],b['z'],b['w'],b['d'],b['h'],snowy)
    # Distant terrain rises outside the playable collision boundary.
    for i in range(20):
        a=i/20*math.tau;x=math.sin(a)*156;z=math.cos(a)*165
        if snowy: mountain(x,z,40+random.random()*20,48+random.random()*48)
        else:mound(grass,x,-3,z,47,14+random.random()*15,48)
    if not snowy:
        for i in range(35):
            a=i/35*math.tau;tree(math.sin(a)*(109+random.random()*16),math.cos(a)*(121+random.random()*12),8+random.random()*6)
        for i in range(3500):
            x=random.uniform(-93,93);z=random.uniform(-103,103)
            if abs(x-7*math.sin(z*.025))<2.5:continue
            for j in range(3):
                a=random.random()*math.tau;w=.07;h=.2+random.random()*.35
                add(leaf,[(x-w*math.cos(a),0,z-w*math.sin(a)),(x+w*math.cos(a),0,z+w*math.sin(a)),(x+.13,h,z+.08)],[(0,1,2)])
        # A worn, gently curving trail provides scale without changing ground height.
        for z in range(-104,104,2):
            x=7*math.sin(z*.025);nx=7*math.sin((z+2)*.025)
            add(soil,[(x-1.8,.014,z),(x+1.8,.014,z),(nx+1.8,.014,z+2),(nx-1.8,.014,z+2)],[(0,1,2,3)])
    else:
        for i in range(40):
            side=-1 if i%2 else 1;tree(side*(96+random.random()*18),random.uniform(-107,107),6+random.random()*5,True)

def finalize(index):
    for name,(vertices,faces) in BATCH.items():
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(MATS[name])
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            n=poly.normal;axis=max(range(3),key=lambda a:abs(n[a]));axes=[a for a in range(3) if a!=axis]
            for li in poly.loop_indices:
                p=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]/3,p[axes[1]]/3)
        if name in ['aged_concrete','warm_facade']:
            bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Soft chipped edges','BEVEL');mod.width=.065;mod.segments=2
            bpy.ops.object.modifier_apply(modifier=mod.name)
        if index==5:
            for poly in mesh.polygons:poly.use_smooth=True
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];triangles=0
    for o in objects:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'map_{index}_v1.blend'))
    glb=OUT/f'map_{index}_v1.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True,export_materials='EXPORT')
    assert glb.stat().st_size<24*1024*1024
    report={'map':index,'blender':bpy.app.version_string,'triangles':triangles,'drawBatches':len(objects),'bytes':glb.stat().st_size,'source':str(SOURCE/f'map_{index}_v1.blend')}
    (QA/f'map-{index}.json').write_text(json.dumps(report,indent=2));print('MAP_EXPORTED',json.dumps(report),flush=True)

for index,mapdata in enumerate(SPEC['maps']):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);BATCH={};random.seed(2109+index)
    if index==5:build_cave()
    else:
        m=asphalt if index<3 else grass if index==3 else snow
        add(m,[(-210,0,-220),(-210,0,220),(210,0,220),(210,0,-220)],[(0,1,2,3)])
        if index<3:buildings(mapdata,index)
        else:nature(mapdata,index)
    finalize(index)
print('ALL_MAPS_COMPLETE',flush=True)
