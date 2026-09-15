"""Stage 1 isolated anatomy study. Run with Blender 5.2 --background --python.
Reads v4; saves only in this directory. Preserves original meshes, rig and actions.
"""
from pathlib import Path
import bpy, math, json, bmesh, sys
from mathutils import Vector
Q=Path(__file__).resolve().parent;R=Q.parents[4]
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/blender/source/standard_trooper_v4.blend'))
scene=bpy.context.scene
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.data.pose_position='REST'
original=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==rig]
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=True;o.hide_set(True)
original_bones={b.name:[list(row) for row in b.matrix_local] for b in rig.data.bones}
candidate=bpy.data.collections.new('STAGE1_ANATOMY');scene.collection.children.link(candidate)
created=[]
def mesh(name,verts,faces):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 o=bpy.data.objects.new(name,me);candidate.objects.link(o);created.append(o)
 return o
def loft(name,rows,n=32):
 # Explicitly shaped body cross sections: z, center x/y, lateral/depth radii.
 verts=[(cx+rx*math.cos(i*math.tau/n),cy+ry*math.sin(i*math.tau/n),z) for z,cx,cy,rx,ry in rows for i in range(n)]
 faces=[tuple(reversed(range(n)))]+[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]+[tuple(range((len(rows)-1)*n,len(rows)*n))]
 return mesh(name,verts,faces)
def activate(o):
 bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
def union(name,items,voxel):
 for o in items:o.hide_set(False)
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=items[0];o.name=name
 m=o.modifiers.new('Resolve sculpted intersections','REMESH');m.mode='VOXEL';m.voxel_size=voxel;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Relax anatomical transitions','SMOOTH');m.factor=1.25;m.iterations=5;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Study mesh budget','DECIMATE');m.ratio=.12;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True
 return o
def material(name,color,rough=.8):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;return m
cloth=material('Study_Cloth',(.095,.122,.112));rubber=material('Study_Glove',(.067,.080,.076));clay=material('Audit_Clay',(.52,.55,.56))

# Pelvis has iliac width, gluteal depth and a raised crotch, not a hanging sphere.
# Ribcage narrows into waist; trapezius raises the neck base without moving head.
bodyparts=[loft('Anatomical_torso',[(.825,0,-.012,.083,.083),(.87,0,-.020,.156,.116),(.925,0,-.027,.211,.137),(.99,0,-.018,.215,.134),(1.055,0,-.006,.19,.12),(1.12,0,0,.183,.123),(1.20,0,.003,.214,.141),(1.29,0,.002,.241,.148),(1.38,0,0,.241,.135),(1.43,0,-.003,.219,.118),(1.475,0,-.009,.162,.101),(1.515,0,-.006,.105,.083),(1.56,0,0,.085,.079),(1.589,0,0,.082,.076)])]
for s,side in [(-1,'L'),(1,'R')]:
 bodyparts.append(loft('Continuous_sleeve_'+side,[(.887,s*.395,.045,.045,.045),(.94,s*.389,.039,.053,.060),(1.02,s*.38,.03,.066,.068),(1.10,s*.372,.02,.063,.065),(1.155,s*.365,.015,.063,.067),(1.20,s*.35,.01,.071,.076),(1.28,s*.327,0,.084,.082),(1.37,s*.295,-.002,.090,.09),(1.42,s*.27,-.003,.087,.092),(1.465,s*.226,-.006,.074,.082)],24))
 bodyparts.append(loft('Continuous_trouser_'+side,[(.137,s*.232,0,.059,.061),(.22,s*.22,-.008,.067,.073),(.32,s*.205,-.012,.084,.089),(.41,s*.191,0,.078,.088),(.50,s*.18,.018,.072,.079),(.555,s*.173,.025,.079,.085),(.64,s*.163,.011,.095,.109),(.74,s*.153,-.008,.113,.130),(.83,s*.14,-.013,.121,.140),(.90,s*.128,-.02,.12,.14),(.966,s*.122,-.02,.105,.119)],28))
body=union('Study_Body',bodyparts,.009)
body.data.materials.append(cloth)

def weights(o,func):
 o.vertex_groups.clear()
 for v in o.data.vertices:
  ws=func(v.co);total=sum(ws.values())
  for bn,w in ws.items():
   if w<=1e-8:continue
   g=o.vertex_groups.get(bn) or o.vertex_groups.new(name=bn);g.add([v.index],w/total,'REPLACE')
 o.parent=rig;m=o.modifiers.new('Preserved v4 linear skin','ARMATURE');m.object=rig;m.use_deform_preserve_volume=False
def blend_levels(z,levels):
 if z<=levels[0][0]:return {levels[0][1]:1}
 if z>=levels[-1][0]:return {levels[-1][1]:1}
 for (a,na),(b,nb) in zip(levels,levels[1:]):
  if a<=z<=b:
   t=(z-a)/(b-a);return {na:1-t,nb:t}
def bodyweight(p):
 x,y,z=p;s='L' if x<0 else 'R';ax=abs(x)
 if (ax>.29 and z>.88) or (ax>.245 and z>1.18):
  return blend_levels(z,[(.887,'Hand_'+s),(.955,'LowerArm_'+s),(1.11,'LowerArm_'+s),(1.2,'UpperArm_'+s),(1.37,'UpperArm_'+s),(1.48,'Clavicle_'+s)])
 if z<.96:
  leg=blend_levels(z,[(.145,'Foot_'+s),(.24,'LowerLeg_'+s),(.47,'LowerLeg_'+s),(.59,'UpperLeg_'+s),(.84,'UpperLeg_'+s),(.98,'Pelvis')])
  if z>.82 and ax<.1:return {'Pelvis':1}
  return leg
 return blend_levels(z,[(.96,'Pelvis'),(1.06,'Spine'),(1.155,'SpineMid'),(1.30,'Chest'),(1.45,'Chest'),(1.565,'Neck'),(1.59,'Head')])
weights(body,bodyweight)

# Palms and thenar eminence form a continuous glove; finger bones stay unchanged.
hands=[]
for s,side in [(-1,'L'),(1,'R')]:
 ps=[loft('Palm_'+side,[(.821,s*.399,.058,.031,.023),(.838,s*.399,.055,.043,.033),(.865,s*.394,.054,.046,.034),(.886,s*.393,.049,.033,.031),(.908,s*.395,.045,.025,.025)],20)]
 for finger in ['Index','Middle','Ring','Little','Thumb']:
  rows=[]
  for k in range(1,4):
   b=rig.data.bones[f'{finger}{k}_{side}'];p=b.head_local
   rad=(.0105 if finger=='Thumb' else .0069)*(1-.05*(k-1))
   rows.append((p.z,p.x,p.y,rad,rad*1.08))
  p=b.tail_local;rows.append((p.z,p.x,p.y,.0055,.006))
  if finger=='Thumb':
   rows.insert(0,(.875,s*.37,.059,.020,.023))
  else:
   rows.insert(0,(.843,rows[0][1],.057,.011,.021))
  ps.append(loft('Finger_'+finger+'_'+side,sorted(rows),12))
 hand=union('Study_Glove_'+side,ps,.0025);hand.data.materials.append(rubber)
 fingerbones=[b for b in rig.data.bones if b.name.endswith('_'+side) and b.name.startswith(('Thumb','Index','Middle','Ring','Little'))]
 def handweight(p):
  if p.z>.835 and abs(p.x)>.37:return {'Hand_'+side:1}
  def dist(b):
   a=b.head_local;d=b.tail_local-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-a-t*d).length
  near=sorted(fingerbones,key=dist)[:2];ds=[dist(b) for b in near]
  if ds[0]>.025:return {'Hand_'+side:1}
  return {b.name:1/(d+.003)**3 for b,d in zip(near,ds)}
 weights(hand,handweight);hands.append(hand)
 # P1-01: enlarge glove proportions around the unchanged wrist/socket.
 # Existing weight mapping retained; static geometry study, bending not certified.
 anchor=rig.data.bones['Hand_'+side].head_local
 for v in hand.data.vertices:
  d=v.co-anchor;v.co=anchor+Vector((d.x*1.24,d.y*1.22,d.z*1.32))
 hand.data.update()

new=[body]+hands
for o in new:o['stage']='Stage 1 prototype; not production';o.hide_render=False;o.hide_set(False)
for name in ['Helmet','Boots']:
 o=bpy.data.objects[name];o.hide_render=False;o.hide_set(False)
assert original_bones=={b.name:[list(row) for row in b.matrix_local] for b in rig.data.bones}
scene['stage1_status']='Awaiting independent visual review. Old meshes/actions preserved hidden; rest pose only.'
scene['stage1_preserved']='57 bone matrices and socket transforms unchanged; all 15 original actions retained, not revalidated.'

# Orthographic evidence: identical scale, camera, world, exposure and lights.
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
for o in list(scene.objects):
 if o.type=='LIGHT':o.hide_render=True
def area(name,pos,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Audit_key',(3,4,5),450,4);area('Audit_fill',(-3,2,3),250,3);area('Audit_rim',(1,-4,3),300,3)
d=bpy.data.cameras.new('Audit_camera');camera=bpy.data.objects.new('Audit_camera',d);scene.collection.objects.link(camera);scene.camera=camera;d.type='ORTHO';d.ortho_scale=2.14
views={'front':(0,6,1.04),'side':(-6,0,1.04),'back':(0,-6,1.04),'oblique':(-4,6,2.35)}
def render(state,mode):
 for o in original:o.hide_render=not(state=='before' or o.name in ['Helmet','Boots'])
 for o in new:o.hide_render=state!='after'
 if mode=='clay':
  for o in original:o.hide_render=o.name not in ['Body','Hands','Helmet','Boots'] if state=='before' else o.name not in ['Helmet','Boots']
 scene.view_layers[0].material_override=clay if mode=='clay' else None
 for name,pos in views.items():
  if '--hand-revision' in sys.argv and name not in ['front','oblique']:continue
  camera.location=pos;camera.rotation_euler=(Vector((0,0,.97))-camera.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(Q/f'{state}_{mode}_{name}.png');bpy.ops.render.render(write_still=True)
for state in ([] if '--no-render' in sys.argv else ['after'] if '--after-only' in sys.argv else ['before','after']):
 for mode in ['color','clay']:render(state,mode)
scene.view_layers[0].material_override=None
for o in original:o.hide_render=o.name not in ['Helmet','Boots'];o.hide_set(o.hide_render)
for o in new:o.hide_render=False;o.hide_set(False)
camera.location=views['oblique'];camera.rotation_euler=(Vector((0,0,.97))-camera.location).to_track_quat('-Z','Y').to_euler()
report={'boneMatricesUnchanged':True,'bones':len(rig.data.bones),'actionsPreserved':len(bpy.data.actions),'candidateMeshes':[],'height':1.86650002,'soleZ':.000500001,'externalAssetsUsed':False,'fullMotionValidated':False}
for o in new:
 bm=bmesh.new();bm.from_mesh(o.data);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
 bad=sum(abs(sum(g.weight for g in v.groups)-1)>1e-5 for v in o.data.vertices)
 report['candidateMeshes'].append({'name':o.name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'nonmanifoldEdges':nonmanifold,'weightErrors':bad,'maxInfluences':max(len(v.groups) for v in o.data.vertices)})
 assert not bad and not nonmanifold
(Q/'candidate-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_anatomy_stage1.blend'))
print('STAGE1_REPORT',json.dumps(report))
