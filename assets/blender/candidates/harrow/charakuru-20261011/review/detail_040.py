import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(r.parent/'models/body/040554d6-0376-4970-b56a-55441df6a567.fbx'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH'); m=o.data
p=list(range(len(m.vertices)))
def find(i):
    while p[i]!=i: p[i]=p[p[i]];i=p[i]
    return i
for e in m.edges:
    a,b=map(find,e.vertices);p[a]=b
groups={}
for v in m.vertices: groups.setdefault(find(v.index),[]).append(v.index)
out=[]
missiles=[]
for cid,(root,indices) in enumerate(groups.items()):
    pts=[o.matrix_world@m.vertices[i].co for i in indices]
    lo=[min(v[i] for v in pts) for i in range(3)];hi=[max(v[i] for v in pts) for i in range(3)]
    if len(indices)==45 and hi[2]-lo[2]>.23:
        out.append({'component_index_vertex_iteration':cid,'union_root':root,'vertices':len(indices),'bounds_min':lo,'bounds_max':hi,'vertex_indices':indices,'classification':'両すねから下へ垂れる細長い生成アーティファクト。隣接する脚とは連結していない。'})
    if lo[2]>.53 and hi[2]-lo[2]>.09 and min(abs(lo[0]),abs(hi[0]))>.16:
        missiles.append({'component_index_vertex_iteration':cid,'vertices':len(indices),'bounds_min':lo,'bounds_max':hi,'vertex_indices':indices})
(r/'body-040-spike-components.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
(r/'body-040-missile-components.json').write_text(json.dumps(missiles,indent=2),encoding='utf-8')
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='SINGLE';scene.display.shading.single_color=(.58,.63,.68);scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
scene.world=bpy.data.worlds.new('World');scene.world.color=(.08,.08,.08);scene.display.shading.background_type='WORLD'
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
c=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',c);scene.collection.objects.link(cam);scene.camera=cam;c.type='ORTHO';c.ortho_scale=1.1
target=Vector((0,-.2,.4));cam.location=(0,-.7,2);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(r/'body-040554d6-top.png');bpy.ops.render.render(write_still=True)
keep={i for x in missiles for i in x['vertex_indices']}
new=bpy.data.meshes.new('MissilesInspectionOnly'); vi=sorted(keep);mapping={v:i for i,v in enumerate(vi)}
new.from_pydata([o.matrix_world@m.vertices[i].co for i in vi],[],[[mapping[v] for v in f.vertices] for f in m.polygons if all(v in keep for v in f.vertices)])
o.hide_render=True; obj=bpy.data.objects.new('MissilesInspectionOnly',new);scene.collection.objects.link(obj)
target=Vector((0,-.29,.59));cam.location=(0,-1.5,2);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();c.ortho_scale=.65
scene.render.filepath=str(r/'body-040554d6-missiles.png');bpy.ops.render.render(write_still=True)
print('SPIKES',[(x['component_index_vertex_iteration'],x['vertices']) for x in out])
