import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
weapons={}
for kind in ['rifle','shotgun','rocket']:
 old=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(p/'source'/f'{kind}.glb'));added=set(s.objects)-old
 weapons[kind]=[(o,o.matrix_world.copy()) for o in added if not o.parent or o.parent not in added]
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='TEXTURE';s.display.shading.show_shadows=True;s.display.shading.show_cavity=True
s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
if not s.world:s.world=bpy.data.worlds.new('Review')
s.world.color=(.06,.08,.11)
bpy.ops.object.camera_add();c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=1.65;s.camera=c;c.location=(3,-4,1.8);c.rotation_euler=(Vector((0,-.12,1.04))-c.location).to_track_quat('-Z','Y').to_euler()
out=p/'combat-frames';out.mkdir(exist_ok=True);report=[]
names=['Rifle_Reload'] if '--rifle-only' in sys.argv else ['Rifle_Idle','Rifle_Fire','Rifle_Reload','Rifle_Walk','Shotgun_Fire','Shotgun_Reload','Rocket_Fire','Rocket_Reload']
if '--rifle-only' in sys.argv and (p/'combat-render-check.json').exists():report=[row for row in json.loads((p/'combat-render-check.json').read_text()) if row['clip'] not in names]
blendHash=hashlib.sha256((p/'soldier-polished-candidate.blend').read_bytes()).hexdigest()
for name in names:
 a=bpy.data.actions['Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];kind=name.split('_')[0].lower()
 for k,objs in weapons.items():
  for o,_ in objs:
   o.hide_render=k!=kind
   for child in o.children_recursive:child.hide_render=k!=kind
 for i in range(6):
  f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*i/5;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  # Blender's importer already applies the basis conversion used by the viewer.
  for o,base in weapons[kind]:o.matrix_world=r.matrix_world@r.pose.bones['RightHandWeaponSocket'].matrix@base
  s.render.filepath=str(out/f'{name}-{i}.png');bpy.ops.render.render(write_still=True)
 report.append({'clip':name,'sampleFractions':[i/5 for i in range(6)],'blendSha256':blendHash})
(p/'combat-render-check.json').write_text(json.dumps(report,indent=2))
