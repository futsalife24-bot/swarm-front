"""保存blendとGLB再読込みの頂点・色・リグ・動作を照合。"""
import bpy,json,struct
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'oriha.blend'))
mesh=bpy.data.objects['Oriha_Surface']
def bounds(o):
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    return [[min(v[i] for v in vs) for i in range(3)],[max(v[i] for v in vs) for i in range(3)]]
original=bounds(mesh)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
bpy.ops.import_scene.gltf(filepath=str(out/'oriha.glb'))
mesh=bpy.data.objects['Oriha_Surface']
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
imported=bounds(mesh)
delta=max(abs(a-b) for aa,bb in zip(original,imported) for a,b in zip(aa,bb))
data=(out/'oriha.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
assert delta<.00001,(original,imported)
assert len(rig.data.bones)==10
assert len(gltf['materials'])==1 and not gltf.get('textures')
assert gltf['materials'][0].get('alphaMode','OPAQUE')=='OPAQUE'
assert 'COLOR_0' in gltf['meshes'][0]['primitives'][0]['attributes']
assert {a['name'] for a in gltf['animations']}=={'Idle','Follow','Display'}
checks={}
rig.animation_data_create()
for action in bpy.data.actions:
    rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    positions=[]
    for frame in [1,22,46]:
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        deps=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(deps)
        positions.append([list(evaluated.matrix_world@v.co) for v in evaluated.data.vertices])
    movement=max(abs(a-b) for f in positions[1:] for p,q in zip(positions[0],f) for a,b in zip(p,q))
    checks[action.name]=movement
    assert movement>0.0001,(action.name,movement)
result={'bounds_max_error_m':delta,'original_bounds':original,'imported_bounds':imported,'bone_names':[b.name for b in rig.data.bones],'animation_vertex_max_displacement_m':checks,'opaque':True,'vertex_colors':True,'textures':0,'materials':1,'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'glb_bytes':len(data)}
ground={}
for name in ['Idle','Follow','Display']:
    action=bpy.data.actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    samples=[]
    for frame in range(1,int(action.frame_range[1])+1,3):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        samples.append((min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices),frame))
    ground[name]={'min_z_m':min(samples)[0],'frame':min(samples)[1]}
result['ground_samples_every_3_frames']=ground
(out/'review').mkdir(exist_ok=True)
(out/'review'/'roundtrip.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
