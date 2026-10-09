import bpy,math,json
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE' and not o.hide_render)
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
for o in s.objects:
 if o.type=='MESH':o.hide_render=o.name not in ['Body','Head']
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='TEXTURE';s.display.shading.show_shadows=True
s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH'
s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
if not s.world:s.world=bpy.data.worlds.new('Motion World')
s.world.color=(.07,.09,.12)
bpy.ops.object.camera_add();c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=2.2;s.camera=c;c.location=(3,-4,1.8);c.rotation_euler=(Vector((0,0,.88))-c.location).to_track_quat('-Z','Y').to_euler()
out=p/'video-frames';out.mkdir(exist_ok=True)
index=0;segments=[]
for name in ['Walk','Jog','Sprint']:
 a=bpy.data.actions['Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];duration=(a.frame_range[1]-a.frame_range[0])/30
 begin=index
 for i in range(round(duration*24)*2):
  f=a.frame_range[0]+((i/24)%duration)*30;s.frame_set(math.floor(f),subframe=f%1)
  s.render.filepath=str(out/('%04d.png'%index));bpy.ops.render.render(write_still=True);index+=1
 segments.append({'name':name,'firstFrame':begin,'lastFrame':index-1,'fps':24})
(p/'video-segments.json').write_text(json.dumps(segments,indent=2))
