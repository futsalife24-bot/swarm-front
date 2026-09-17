"""Original compact field armory and flat plazas using the shipped map art.
Run with Blender --background --factory-startup --python this_file.
Coordinates below are game x, height, z. No downloaded reference artwork is used.
"""
from pathlib import Path
import bpy, bmesh, math, random, json
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/maps'
SOURCE = ROOT / 'assets/blender/source/defense'
QA = ROOT / 'dist-validation/defense-blender'
SOURCE.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.68
    p.inputs['Emission Color'].default_value=(*color,1)
    p.inputs['Emission Strength'].default_value=emission
    return m

def box(name, x,y,z,w,h,d,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    o=bpy.context.object;o.name=name;o.scale=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('manufactured edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        o.modifiers.new('corner normals','WEIGHTED_NORMAL')
    return o

def export(name):
    bpy.context.scene.unit_settings.system='METRIC'
    # Pack the existing game's texture images into the editable source too.
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',
        export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    print('EXPORTED',name,(OUT/(name+'.glb')).stat().st_size,flush=True)

clear()
armor=material('Armory olive enamel',(.24,.31,.28),.55)
edge=material('Armory dark steel',(.075,.105,.11),.7)
steel=material('Armory exposed steel',(.43,.48,.46),.8)
yellow=material('Armory identification ochre',(.83,.58,.20))
black=material('Armory rubber',(.025,.033,.03))
lamp=material('Armory status green',(.22,.8,.54),.1,2)
burn=material('Armory burnt steel',(.09,.075,.064),.5)
# Walk-in, single-bay field vault: 2.1 x 1.9m body, 2.65m high.
box('INTACT_shell',0,1.3,0,2.1,2.6,1.9,armor,.06)
box('INTACT_plinth',0,.09,0,2.25,.18,2.05,edge)
box('INTACT_roof',0,2.64,0,2.3,.17,2.08,edge,.05)
for x in [-1.035,1.035]:
    for z in [-.94,.94]:box('INTACT_corner',x,1.35,z,.115,2.55,.12,steel)
for x in [-.72,-.24,.24,.72]:
    box('INTACT_rear_rib',x,1.4,-.97,.055,2.25,.07,edge,.008)
# Recessed reinforced entrance and offset issue hatch.
box('INTACT_door_frame',-.35,1.19,.981,1.12,2.15,.105,edge)
box('INTACT_door',-.35,1.19,1.045,.96,1.98,.055,steel)
box('INTACT_door_inset',-.35,1.28,1.08,.73,1.40,.028,armor)
for y in [.47,1.06,1.82]:
    box('INTACT_hinge',-.84,y,1.10,.13,.13,.12,edge)
box('INTACT_lockbar',-.34,.97,1.135,.73,.07,.065,edge)
box('INTACT_handle',-.02,1.23,1.15,.045,.23,.07,black)
box('INTACT_issue_recess',.67,1.60,.975,.49,.66,.07,black)
for i in range(4):box('INTACT_issue_grille',.49+i*.12,1.60,1.026,.022,.60,.04,steel,.004)
box('INTACT_issue_counter',.66,1.23,1.08,.59,.075,.30,steel)
box('INTACT_sign',0,2.35,1.002,1.80,.29,.055,edge)
bpy.ops.object.text_add(location=(-.76,-1.038,2.25),rotation=(math.pi/2,0,0))
o=bpy.context.object;o.name='INTACT_ARMORY_lettering';o.data.body='ARMORY  /  07';o.data.size=.18;o.data.extrude=.001;o.data.materials.append(yellow)
bpy.ops.object.convert(target='MESH')
for i in range(5):box('STATUS_'+str(i),(i-2)*.18,2.10,1.055,.12,.055,.03,lamp,.008)
# Side ventilation and roof exhaust, practical service equipment rather than ornaments.
box('INTACT_vent_frame',1.08,1.73,-.12,.07,.65,.88,edge)
for i in range(7):box('INTACT_vent_louvre',1.126,1.47+i*.08,-.12,.035,.03,.76,steel,.005)
box('INTACT_service_box',1.10,.61,-.34,.17,.58,.44,edge)
box('INTACT_exhaust',.57,2.82,-.35,.61,.25,.64,steel)
box('INTACT_exhaust_cap',.57,2.98,-.35,.72,.075,.75,edge)
for i in range(7):
    box('INTACT_threshold_hazard',-.87+i*.29,.23,1.068,.14,.10,.022,yellow,.003)
for x in [-.93,.93]:
    for y in [.35,2.35]:box('INTACT_anchor',x,y,1.02,.065,.065,.04,black,.01)
# Authored damage overlays are shown progressively, not a uniform color swap.
for level,(x,y,z,w,h,d) in enumerate([
    (.1,1.85,1.087,.27,.10,.017),(-.65,1.50,1.087,.35,.23,.018),
    (1.135,.94,.23,.019,.42,.42),(.28,.58,1.087,.51,.40,.017)],1):
    o=box('DAMAGE_'+str(level),x,y,z,w,h,d,burn,.007);o.rotation_euler.y=.10*level
box('RUIN_base',0,.16,0,2.1,.32,1.9,burn)
for i in range(7):
    a=i*2.39996
    o=box('RUIN_panel',math.sin(a)*.68,.33+i%2*.17,math.cos(a)*.55,.75,.10,.58,burn)
    o.rotation_euler=(.15*i,.12*i,a)
export('armory_v2')

reports=[]
layouts=json.loads((ROOT/'assets/blender/maps-layout-v1.json').read_text())['maps']
for index in range(6):
    clear()
    bpy.ops.import_scene.gltf(filepath=str(OUT/f'map_{index}_v1.glb'))
    removed_buildings=[b for b in layouts[index]['blocks'] if
        b['x']-b['w']/2<51 and b['x']+b['w']/2>-51 and
        b['z']-b['d']/2<51 and b['z']+b['d']/2>-51] if index<3 else []
    # Remove whole connected objects that enter the plaza. Keep authored buildings,
    # rocks and trees outside it: no sliced facades, raised terrain, or stray props.
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        if index==5:
            bpy.data.objects.remove(o,do_unlink=True);continue
        bm=bmesh.new();bm.from_mesh(o.data)
        # glTF splits vertices at UV/normal seams; reconnect before component removal.
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
        seen=set();remove=[]
        for v in bm.verts:
            if v in seen:continue
            todo=[v];component=[];seen.add(v)
            while todo:
                q=todo.pop();component.append(q)
                for e in q.link_edges:
                    other=e.other_vert(q)
                    if other not in seen:seen.add(other);todo.append(other)
            coords=[o.matrix_world @ q.co for q in component]
            cx=sum(p.x for p in coords)/len(coords);cz=-sum(p.y for p in coords)/len(coords)
            part_of_removed_building=any(abs(cx-b['x'])<b['w']/2+2 and abs(cz-b['z'])<b['d']/2+2 for b in removed_buildings)
            if part_of_removed_building or (min(p.x for p in coords)<51 and max(p.x for p in coords)>-51 and min(p.y for p in coords)<51 and max(p.y for p in coords)>-51):
                remove.extend(component)
        bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(o.data);bm.free()
        if not len(o.data.vertices):bpy.data.objects.remove(o,do_unlink=True)
    if index<5:
        before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT/f'distant_{index}_v1.glb'))
        for o in set(bpy.context.scene.objects)-before:
            if o.type=='MESH':
                o.scale*=.6
                o['visualOnly']=True
    texname=['road_asphalt','earth','road_asphalt','meadow_ground','granular_snow','layered_limestone'][index]
    floor=material('PLAZA_'+texname,(1,1,1))
    p=floor.node_tree.nodes.get('Principled BSDF')
    image=bpy.data.images.load(str(ROOT/f'assets/blender/textures/maps/{texname}_base.png'),check_existing=True)
    node=floor.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    floor.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
    o=box('PLAZA_FLAT',0,-.10,0,420,.20,440,floor,0)
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            o.data.uv_layers.active.data[li].uv=(co.x/4,co.y/4)
    perimeter=material('Plaza curb',(.27,.30,.29) if index!=4 else (.65,.72,.76))
    for x,z,w,d in [(0,-48,94,2),(0,48,94,2),(-48,0,2,98),(48,0,2,98)]:
        box('PLAZA_boundary',x,2,z,w,4,d,perimeter,.08)
    # Cave variant: strata surround an excavated level depot clearing.
    if index==5:
        vertices=[];faces=[];segments=128
        for layer in range(7):
            for i in range(segments):
                a=i/segments*math.tau
                r=76+layer*3+2*math.sin(i*.63+layer*.4)+math.sin(i*1.7)
                y=layer*4+(math.sin(i*.19)*3+math.sin(i*.83))*layer/6
                vertices.append((math.sin(a)*r,-math.cos(a)*r,y))
        for layer in range(6):
            for i in range(segments):
                j=(i+1)%segments;a=layer*segments+i;b=layer*segments+j
                faces.extend([(a,b,b+segments),(a,b+segments,a+segments)])
        mesh=bpy.data.meshes.new('Cave layered escarpment');mesh.from_pydata(vertices,[],faces);mesh.update()
        o=bpy.data.objects.new('CAVE_strata',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(floor)
        uv=mesh.uv_layers.new()
        for poly in mesh.polygons:
            poly.use_smooth=True
            for li in poly.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(math.atan2(co.x,-co.y)*18,co.z/3)
    paint=material('Plaza faded loading marks',(.52,.44,.25))
    for side in [-1,1]:
        box('PLAZA_loading_lane',side*3,.006,4,.10,.008,8,paint,0)
    export(f'defense_{index}_v2')
    reports.append({'map':index,'flatGroundY':0,'clearSquare':94,'sourceMap':f'map_{index}_v1.glb'})
(QA/'generation.json').write_text(json.dumps(reports,indent=2))
