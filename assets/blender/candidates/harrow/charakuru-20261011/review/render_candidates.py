import bpy, json, math
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent
reports=[]
for file in sorted((root.parent/'models').glob('*/*.fbx')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(file))
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world@v.co for o in objs for v in o.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=(lo+hi)/2; size=hi-lo
    parts=[]
    for o in objs:
        parents=list(range(len(o.data.vertices)))
        def find(i):
            while parents[i]!=i:
                parents[i]=parents[parents[i]]; i=parents[i]
            return i
        for e in o.data.edges:
            a,b=map(find,e.vertices); parents[a]=b
        groups={}
        for v in o.data.vertices: groups.setdefault(find(v.index),[]).append(o.matrix_world@v.co)
        for group in groups.values():
            mn=[min(p[i] for p in group) for i in range(3)]; mx=[max(p[i] for p in group) for i in range(3)]
            parts.append({'vertices':len(group),'min':mn,'max':mx})
    parts.sort(key=lambda p:p['vertices'],reverse=True)
    reports.append({'file':str(file.relative_to(root.parent)), 'meshes':len(objs),'vertices':len(points),'polygons':sum(len(o.data.polygons) for o in objs),'bounds_min':list(lo),'bounds_max':list(hi),'size':list(size),'components':len(parts),'component_data':parts})
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.studiolight_rotate_z=math.radians(25)
    scene.display.shading.color_type='SINGLE'
    scene.display.shading.single_color=(0.58,0.63,0.68)
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.background_type='WORLD'
    scene.world=bpy.data.worlds.new('ReviewWorld')
    scene.world.color=(0.08,0.08,0.08)
    scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    cam_data=bpy.data.cameras.new('ReviewCamera'); cam=bpy.data.objects.new('ReviewCamera',cam_data); scene.collection.objects.link(cam); scene.camera=cam
    cam_data.type='ORTHO'; cam_data.clip_end=10000
    # FBX importer maps input Y-up to Blender Z-up; forward is observed after render.
    for label,direction in [('front',(0,-1,0)),('side',(1,0,0)),('back',(0,1,0))]:
        distance=max(size)*4
        cam.location=center+Vector(direction)*distance
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        cam_data.ortho_scale=max(size.x if label!='side' else size.y,size.z)*1.12
        scene.render.filepath=str(root/f'{file.parent.name}-{file.stem[:8]}-{label}.png')
        bpy.ops.render.render(write_still=True)
    (root/'geometry.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print('REVIEW_COMPLETE',len(reports))
