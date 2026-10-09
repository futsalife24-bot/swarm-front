import bpy,json,sys
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'source/ual-source.blend'))
s=bpy.context.scene;r=bpy.data.objects['Rig']
for t in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(t)
meshes=[bpy.data.objects['Mannequin']]
for o in s.objects:
 if o.type=='MESH':o.hide_render=True
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=True
s.render.resolution_x=1400;s.render.resolution_y=460;s.render.resolution_percentage=100
if not s.world:s.world=bpy.data.worlds.new('Reference World')
s.world.color=(.12,.14,.17)
bpy.ops.object.camera_add();c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=8.6;s.camera=c;c.location=(3.4,-9,2.3);c.rotation_euler=(Vector((3.4,0,1))-c.location).to_track_quat('-Z','Y').to_euler()
clips=['Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Idle_Loop','Jump_Start','Jump_Land','Roll','Hit_Chest','Death01','Fixing_Kneeling']
requested=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--clip=')),None)
if requested:clips=[requested]
for name in clips:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 snapshots=[]
 for i,t in enumerate([.0,.25,.5,.75]):
  f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*t;s.frame_set(int(f),subframe=f%1);dg=bpy.context.evaluated_depsgraph_get()
  for o in meshes:
   mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg));obj=bpy.data.objects.new(name+str(i),mesh);s.collection.objects.link(obj);obj.matrix_world=o.matrix_world;obj.location.x+=i*2.25;snapshots.append(obj)
 s.render.filepath=str(p/(name+'-reference.png'));bpy.ops.render.render(write_still=True)
 for o in snapshots:bpy.data.objects.remove(o,do_unlink=True)
