import bpy,json,hashlib,itertools
from pathlib import Path
from mathutils.bvhtree import BVHTree
P=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(P/'calyx.glb'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
skins=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
petals=['P1','P2','P3','P4','P5'];legs=['FL','FR','Rear']
pairs=list(itertools.combinations(petals,2))+[(p,l) for p in petals for l in legs]
topology=[]
for o in skins:
    o.data.calc_loop_triangles()
    groups={v.index:o.vertex_groups[max(v.groups,key=lambda g:g.weight).group].name.split('_')[0] for v in o.data.vertices}
    triangles={n:[] for n in petals+legs}
    for t in o.data.loop_triangles:
        names={groups[i] for i in t.vertices}
        if len(names)==1 and next(iter(names)) in triangles:triangles[next(iter(names))].append(tuple(t.vertices))
    topology.append((o,triangles))
findings=[]
for clip,duration in [('Idle',4),('Locomotion',6),('Slam',2.2),('PollenShot',2.8)]:
    for track in rig.animation_data.nla_tracks:track.mute=track.name!=clip
    for frame in range(0,round(duration*30)+1):
        scene.frame_set(1+frame);bpy.context.view_layer.update();trees={}
        aggregate={n:([],[]) for n in petals+legs}
        for o,triangles in topology:
            eo=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=eo.to_mesh()
            for n,tris in triangles.items():
                if not tris:continue
                used=sorted({i for tr in tris for i in tr});verts,faces=aggregate[n];base=len(verts);indices={i:base+j for j,i in enumerate(used)}
                verts.extend(eo.matrix_world@me.vertices[i].co for i in used);faces.extend(tuple(indices[i] for i in tr) for tr in tris)
            eo.to_mesh_clear()
        for n,(v,f) in aggregate.items():
            if f:trees[n]=BVHTree.FromPolygons(v,f,all_triangles=True,epsilon=0)
        hits={a+'/'+b:len(trees[a].overlap(trees[b])) for a,b in pairs if a in trees and b in trees}
        hits={k:v for k,v in hits.items() if v}
        if hits:findings.append(dict(clip=clip,t=frame/30,pairs=hits))
report=dict(sha256=hashlib.sha256((P/'calyx.glb').read_bytes()).hexdigest(),method='GLB reimport; Blender BVHTree triangle intersection at every authored 30fps frame. Includes each entire blended root, petal veins and hinges. Body attachments excluded. Not continuous collision.',findings=findings)
(P/'intersections.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert not findings, 'Unexpected petal/root intersections; see intersections.json'
