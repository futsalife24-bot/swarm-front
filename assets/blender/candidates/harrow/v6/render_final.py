"""Memory-bounded final evidence: fresh GLB import once, four views, two CPU threads."""
import bpy, json, hashlib, gc, sys
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
OUT=P.parents[4]/'dist-validation'/'harrow'/'v6'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.import_scene.gltf(filepath=str(P/'harrow.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True
s.render.threads_mode='FIXED';s.render.threads=2;s.render.resolution_x=800;s.render.resolution_y=600;s.render.resolution_percentage=100;s.render.fps=30
s.world.use_nodes=True;bg=s.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.32,.36,.41,1);bg.inputs[1].default_value=.45;s.view_settings.view_transform='AgX'
mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.13,.16,.18,1);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.13,.16,.18,1);bs.inputs['Roughness'].default_value=.8
bpy.ops.mesh.primitive_plane_add(size=80,location=(0,0,-.018));bpy.context.object.data.materials.append(mat)
for name,p,power,size,color in [('key',(-9,-12,17),4500,10,(1,.91,.76)),('rim',(6,9,15),5200,9,(.72,.84,1)),('front',(-11,3,8),2400,7,(1,.97,.9)),('fill',(6,-10,11),3200,8,(1,1,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector((1,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('evidence');d.type='ORTHO';d.ortho_scale=24;c=bpy.data.objects.new('evidence',d);s.collection.objects.link(c);s.camera=c
report={'glb_sha256':hashlib.sha256((P/'harrow.glb').read_bytes()).hexdigest(),'method':'Fresh runtime GLB imports, CPU Cycles 2 threads. Existing images are reused only for the identical GLB SHA when --only completes a missing view. Root elevation stays zero to expose ground clearance.','images':[]}
only=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
if only and (OUT/'final-render.json').exists():
 previous=json.loads((OUT/'final-render.json').read_text())
 assert previous['glb_sha256']==report['glb_sha256']
 report['images']=[r for r in previous['images'] if r['file']!=only+'.png']
for name,clip,t,pos,scale in [('final-spin','Spin',1.8,(-15,-24,13),24),('final-flight','Flight',1.2,(-15,-24,13),24),('final-dive','Dive',.8,(1,-30,5),21),('final-fall','StaggerFall',.75,(-15,-24,13),24)]:
 if only and name!=only:continue
 rig.animation_data_create();rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
 for track in rig.animation_data.nla_tracks:track.mute=True
 s.frame_set(round(t*30));c.location=pos;c.rotation_euler=(Vector((1,0,4.5))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
 file=OUT/(name+'.png');s.render.filepath=str(file);bpy.ops.render.render(write_still=True)
 report['images'].append({'file':file.name,'clip':clip,'time':t,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()});(OUT/'final-render.json').write_text(json.dumps(report,indent=2))
 gc.collect()
print('HARROW_FINAL_RENDER_PASS',report['glb_sha256'])
