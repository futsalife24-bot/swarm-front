"""Five collision-free outdoor horizons, metres, game Y-up -> Blender Z-up.
Separate assets preserve existing arena models and allow future weather hiding.
"""
from pathlib import Path
import bpy, math, random, json
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/maps'
SOURCE = ROOT / 'assets/blender/source/maps'
QA = ROOT / 'dist-validation/distant-scenery'
QA.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

def add(mat, vertices, faces):
    v, f = batches.setdefault(mat, ([], []))
    n = len(v)
    v.extend(vertices)
    f.extend(tuple(n+i for i in face) for face in faces)

def box(mat, x, y, z, w, h, d):
    v = [(x+a*w/2,y+b*h/2,z+c*d/2) for a,b,c in
         [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    add(mat,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def cone(mat,x,z,y,r,h,n=10,top=0):
    v=[(x+math.sin(i/n*math.tau)*radius,yy,z+math.cos(i/n*math.tau)*radius)
       for radius,yy in [(r,y),(top,y+h)] for i in range(n)]
    add(mat,v,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+[tuple(range(n,2*n))])

def ridge(radius, height, mat, snowy=False):
    n=128
    heights=[height*(.7+.22*math.sin(i*.31+index)+.15*math.sin(i*.89)+random.random()*.2) for i in range(n)]
    v=[]
    for band in range(5):
        for i in range(n):
            a=i/n*math.tau
            r=radius+[-65,-30,0,40,95][band]
            y=heights[i]*[0,.5,1,.4,0][band]-3
            v.append((math.sin(a)*r,y,math.cos(a)*r))
    for b in range(4):
        for i in range(n):
            ids=[b*n+i,b*n+(i+1)%n,(b+1)*n+(i+1)%n,(b+1)*n+i]
            add('snow' if snowy and b in [1,2] else mat,[v[j] for j in ids],[(0,1,2),(0,2,3)])

palette={'ground':(.22,.28,.19),'near':(.20,.27,.22),'far':(.29,.36,.37),
         'wall':(.33,.38,.39),'roof':(.19,.25,.28),'window':(.13,.22,.27),
         'steel':(.27,.32,.34),'snow':(.72,.80,.85),'rock':(.35,.43,.48)}
reports=[]
for index in range(5):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    random.seed(9810+index); batches={}
    colors=dict(palette)
    colors['ground']=[(.115,.135,.14),(.17,.16,.14),(.115,.135,.14),(.225,.30,.115),(.81,.88,.91)][index]
    if index==1: colors['wall']=(.40,.33,.28)
    # Continuous underlay beyond the existing square floor, lowered to avoid z-fighting.
    add('ground',[(-1050,-.15,-1050),(-1050,-.15,1050),(1050,-.15,1050),(1050,-.15,-1050)],[(0,1,2,3)])
    ridge(610,115 if index<3 else 150 if index==3 else 245,'far',index==4)
    ridge(410,55 if index<3 else 72 if index==3 else 135,'near' if index!=4 else 'rock',index==4)
    if index<3:
        for ring,count in [(235,48),(320,64)]:
            for i in range(count):
                a=(i+.15*random.random())/count*math.tau
                x,z=math.sin(a)*ring,math.cos(a)*ring
                h=random.uniform(18,65) if index==0 else random.uniform(9,22)
                w,d=random.uniform(15,25),random.uniform(14,25)
                box('wall',x,h/2,z,w,h,d);box('roof',x,h+.5,z,w+1,1,d+1)
                box('steel',x+2,h+2,z,5,3,4)
                if index==0:
                    for y in range(5,int(h)-1,5):
                        # Window ribbons on all facades; no per-window draw calls.
                        for sign in [-1,1]:
                            box('window',x,y,z+sign*(d/2+.03),w*.8,1.5,.08)
                            box('window',x+sign*(w/2+.03),y,z,.08,1.5,d*.8)
                elif index==1:
                    box('roof',x,h*.35,z-d/2-.1,w*.6,h*.55,.2)
                    if i%4==0:
                        box('steel',x,28,z,1.2,56,1.2)
                        box('steel',x+10,53,z,25,1.2,1.2)
                        box('steel',x+19,46,z,.35,14,.35)
                else:
                    cone('steel',x,z,h,3,random.uniform(28,50),12,2)
                    cone('wall',x+9,z+5,0,7,18,16,7)
                    cone('roof',x+9,z+5,18,7,4,16,1)
    else:
        # Layered treelines beyond the collision boundary and existing foreground hills.
        for i in range(360):
            a=random.uniform(0,math.tau);r=random.uniform(205,310)
            x,z=math.sin(a)*r,math.cos(a)*r;h=random.uniform(7,18)
            cone('near',x,z,0,random.uniform(2.5,5),h,7)
            if index==4:cone('snow',x,z,h*.5,2,h*.45,7)
    for name,(verts,faces) in batches.items():
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);mesh.update()
        obj=bpy.data.objects.new('DISTANT_'+name,mesh);bpy.context.collection.objects.link(obj)
        obj['visualOnly']=True
        m=bpy.data.materials.new(name);m.diffuse_color=(*colors[name],1);m.use_nodes=True
        bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*colors[name],1);bsdf.inputs['Roughness'].default_value=.95
        mesh.materials.append(m)
        mesh.calc_loop_triangles()
        assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'distant_{index}_v1.blend'))
    path=OUT/f'distant_{index}_v1.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    triangles=sum(len(o.data.loop_triangles) for o in bpy.context.scene.objects if o.type=='MESH')
    assert path.stat().st_size<4*1024*1024
    # Independently re-import the shipping artifact and check geometry and collision clearance.
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(objects)==len(batches)
    for o in objects:
        if 'ground' in o.name:continue
        assert all(math.hypot(v.co.x,v.co.y)>180 for v in o.data.vertices)
    reports.append({'map':index,'bytes':path.stat().st_size,'triangles':triangles,'batches':len(objects),'reimport':'passed','visualOnly':True})
    print(reports[-1],flush=True)
(QA/'blender.json').write_text(json.dumps(reports,indent=2))
