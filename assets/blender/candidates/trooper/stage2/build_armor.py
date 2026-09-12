"""Isolated stage 2 armor; reads stage 1 pass and keeps its full anatomy/rig."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q.parent/'stage1/trooper_anatomy_stage1.blend'))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
col=bpy.data.collections.new('STAGE2_ARMOR');s.collection.children.link(col);armor=[]
# Replace geometric region boundaries with Blender heat weights on the connected
# body. Only the candidate is selected; original mesh weights are untouched.
body=bpy.data.objects['Study_Body'];body.hide_set(False);rig.hide_set(False)
body.vertex_groups.clear()
for m in list(body.modifiers):
 if m.type=='ARMATURE':body.modifiers.remove(m)
deform={b.name:b.use_deform for b in rig.data.bones}
for b in rig.data.bones:
 b.use_deform=deform[b.name] and not b.name.startswith(('Thumb','Index','Middle','Ring','Little','Toe'))
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for b in rig.data.bones:b.use_deform=deform[b.name]
for v in body.data.vertices:
 ws=sorted([(g.group,g.weight) for g in v.groups if g.weight>1e-5],key=lambda p:-p[1])[:4]
 assert ws,('unweighted body vertex',v.index)
 total=sum(w for _,w in ws)
 for g in body.vertex_groups:g.remove([v.index])
 for index,w in ws:body.vertex_groups[index].add([v.index],w/total,'REPLACE')
def make(name,vs,fs,bone,ma='Armor',thickness=.012):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(bpy.data.materials[ma]);o.parent=rig
 g=o.vertex_groups.new(name=bone);g.add(list(range(len(vs))),1,'REPLACE')
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if thickness:
  m=o.modifiers.new('Thin rigid shell','SOLIDIFY');m.thickness=thickness;m.offset=0;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('Soft plate edge','BEVEL');m.width=.004;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True
 m=o.modifiers.new('Stable shell normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Rigid armor binding','ARMATURE');m.object=rig
 o['component']=name;o['stage2_role']='Rigid protective shell; no surface decoration';armor.append(o);return o
def curved_panel(name,rows,bone,ma='Armor',back=False,thick=.016):
 vs=[];N=12
 for z,w,y in rows:
  for i in range(N+1):
   u=-1+2*i/N;vs.append((w*u,(-1 if back else 1)*(y-.065*(w*u/.22)**2),z))
 fs=[(j*(N+1)+i,j*(N+1)+i+1,(j+1)*(N+1)+i+1,(j+1)*(N+1)+i) for j in range(len(rows)-1) for i in range(N)]
 return make(name,vs,fs,bone,ma,thick)
curved_panel('Trial_Chest',[(1.19,.14,.16),(1.23,.195,.17),(1.33,.217,.175),(1.405,.17,.165),(1.437,.12,.145)],'Chest')
curved_panel('Trial_Chest_Ceramic',[(1.335,.115,.188),(1.37,.13,.184),(1.39,.105,.182)],'Chest','Ceramic',thick=.006)
# The side carrier remains slim and avoids the abdomen and crotch.
curved_panel('Trial_Back',[(1.17,.13,.159),(1.24,.176,.172),(1.36,.174,.163),(1.425,.12,.145)],'Chest',back=True)
curved_panel('Trial_Back_Ceramic',[(1.235,.108,.201),(1.35,.127,.195),(1.385,.095,.177)],'Chest','Ceramic',back=True,thick=.012)
def limb_shell(name,bone,tvals,rvals,ma='Armor',direction='front',side=1,angle=1.7):
 b=rig.data.bones[bone];a=b.head_local;delta=b.tail_local-a;axis=delta.normalized()
 front=Vector((0,1,0));front=(front-axis*front.dot(axis)).normalized();lateral=front.cross(axis).normalized()
 if direction=='side':front=-lateral*side;lateral=axis.cross(front).normalized()
 N=16;vs=[]
 for t,r in zip(tvals,rvals):
  center=a+t*delta
  for i in range(N+1):
   theta=-angle+2*angle*i/N;vs.append(center+r*(front*math.cos(theta)+lateral*math.sin(theta)))
 fs=[(j*(N+1)+i,j*(N+1)+i+1,(j+1)*(N+1)+i+1,(j+1)*(N+1)+i) for j in range(len(tvals)-1) for i in range(N)]
 return make(name,vs,fs,bone,ma,.012)
for side,sign in [('L',-1),('R',1)]:
 limb_shell('Trial_Shoulder_'+side,'UpperArm_'+side,[-.06,.10,.27,.40],[.075,.103,.110,.103],direction='side',side=sign,angle=1.65)
 limb_shell('Trial_Forearm_'+side,'LowerArm_'+side,[.21,.30,.58,.80],[.075,.078,.07,.057],angle=1.75)
 limb_shell('Trial_Shin_'+side,'LowerLeg_'+side,[.20,.32,.56,.78],[.085,.093,.086,.075],angle=1.35)
 # Patella cup is short, rounded and distinct from the long greave.
 center=rig.data.bones['LowerLeg_'+side].head_local+Vector((0,.076,0))
 vs=[center+Vector((.079*math.cos(a)*math.sin(b),.033*math.cos(b),.071*math.sin(a)*math.sin(b))) for b in [0,.35,.65,.95,1.3,1.57] for a in [i*math.tau/24 for i in range(24)]]
 fs=[(j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i) for j in range(5) for i in range(24)]
 make('Trial_Knee_'+side,vs,fs,'LowerLeg_'+side,thickness=.01)
# A narrow fabric belt establishes the waist without hanging groin armor.
vs=[];N=40
for z in [.996,1.028]:
 for i in range(N):
  a=i*math.tau/N;vs.append((.217*math.cos(a),-.009+.134*math.sin(a),z))
make('Trial_Waist_Band',vs,[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],'Pelvis','Rubber',.008)
s['stage2_status']='Armor layout and static pose diagnostic; unapproved; original 57-bone bind retained.'
(Q/'armor-manifest.json').write_text(json.dumps({'objects':[o.name for o in armor],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in armor),'bones':len(rig.data.bones),'actions':len(bpy.data.actions)},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_layout.blend'))
