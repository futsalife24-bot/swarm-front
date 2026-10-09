import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='TEXTURE';s.display.shading.show_shadows=True;s.display.shading.show_cavity=True
s.render.resolution_x=640;s.render.resolution_y=480;s.render.resolution_percentage=100
bpy.ops.mesh.primitive_plane_add(size=10,location=(0,0,0));floor=bpy.context.object;floor.name='ReviewFloor'
mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.12,.17,.19,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add();c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=3;s.camera=c;c.location=(3,-3,2);c.rotation_euler=(Vector((0,0,.65))-c.location).to_track_quat('-Z','Y').to_euler()
out=p/'ground-frames';out.mkdir(exist_ok=True)
for name in ['Down','Dodge_Roll','Jump_Start','Jump_Land']:
 a=bpy.data.actions['Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 for i in range(6):
  f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*i/5;s.frame_set(math.floor(f),subframe=f%1)
  s.render.filepath=str(out/f'{name}-{i}.png');bpy.ops.render.render(write_still=True)
(p/'ground-render-check.json').write_text(json.dumps({'blendSha256':hashlib.sha256((p/'soldier-polished-candidate.blend').read_bytes()).hexdigest(),'clips':['Down','Dodge_Roll','Jump_Start','Jump_Land'],'fractions':[i/5 for i in range(6)]},indent=2))
