"""Fresh GLB renders, same camera for v9/v10 torso comparison."""
import bpy, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
OUT=P.parents[4]/'dist-validation'/'harrow-v10'
OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
scene.render.fps=40
report=[]
for version in ('v9','v10'):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 bpy.data.orphans_purge(do_recursive=True)
 source=P.parent/version/'harrow.glb'
 bpy.ops.import_scene.gltf(filepath=str(source))
 rig=next(o for o in scene.objects if o.type=='ARMATURE')
 scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
 scene.render.threads_mode='FIXED';scene.render.threads=2
 scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world.use_nodes=True
 bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.20,.25,.30,1);bg.inputs[1].default_value=.6
 scene.view_settings.view_transform='AgX'
 for name,pos,power,size in [('key',(-9,-12,17),4500,10),('fill',(6,-10,11),3200,8),('rim',(6,9,15),5200,9)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
  o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('comparison');d.type='ORTHO';cam=bpy.data.objects.new('comparison',d);scene.collection.objects.link(cam);scene.camera=cam
 views=[('body-side','Idle',0,(0,-20,3),(0,0,3),6.8),('body-front','Idle',0,(-16,-13,7),(-.5,0,3),7.8)]
 if version=='v10':views += [('flight','Flight',2.2,(-15,-24,13),(1,0,5),27),('flight-opposite','Flight',5.5,(-15,-24,13),(1,0,5),27),('back','Idle',0,(20,10,8),(1,0,4),24),('hero','Idle',0,(-15,-24,13),(1,0,4.5),24)]
 for name,clip,time,pos,target,scale in views:
  rig.animation_data_create();rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
  for tr in rig.animation_data.nla_tracks:tr.mute=True
  frame=time*40;scene.frame_set(int(frame),subframe=frame%1)
  cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=scale
  file=OUT/f'{version}-{name}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
  report.append({'file':file.name,'clip':clip,'time':time,'glb_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
  (OUT/'renders.json').write_text(json.dumps(report,indent=2))
print('RENDER_PASS',len(report))
