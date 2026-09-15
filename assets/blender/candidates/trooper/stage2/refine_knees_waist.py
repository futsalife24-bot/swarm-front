"""Local joint topology below mid-thigh; stable pelvis band, same rest skeleton."""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_knee_trial.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST';bpy.context.view_layer.update()
old=bpy.data.objects['Study_Body'];tree=BVHTree.FromObject(old,bpy.context.evaluated_depsgraph_get());old.name='Diagnostic_Body_PreJointLoops';old.hide_render=True;old.hide_set(True)
o=old.copy();o.data=old.data.copy();o.name='Study_Body';old.users_collection[0].objects.link(o);o.hide_render=False;o.hide_set(False)
bm=bmesh.new();bm.from_mesh(o.data);layer=bm.verts.layers.deform.active
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,0,.69),plane_no=(0,0,1),clear_inner=True)
boundary=[v for v in bm.verts if abs(v.co.z-.69)<1e-5 and any(e.is_boundary for e in v.link_edges)]
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
rows=[(.14,.232,0),(.22,.220,-.008),(.32,.205,-.012),(.41,.191,0),(.50,.180,.018),(.555,.173,.025),(.64,.163,.011),(.69,.158,.004)]
def center(z,sign):
 for (za,xa,ya),(zb,xb,yb) in zip(rows,rows[1:]):
  if za<=z<=zb:
   t=(z-za)/(zb-za);return Vector((sign*(xa+(xb-xa)*t),ya+(yb-ya)*t,z))
 return Vector((sign*.232,0,z))
def leg_weights(v,side):
 x,y,z=v.co;v[layer].clear()
 if z<.28:
  t=smooth((z-.15)/.075);pairs=[('Foot_',1-t),('LowerLeg_',t)]
 else:
  upper=smooth((z-(.53-.60*(y-.025))+.045)/.09);pairs=[('UpperLeg_',upper),('LowerLeg_',1-upper)]
 for n,w in pairs:
  if w>1e-7:v[layer][o.vertex_groups[n+side].index]=w
for side,sign in [('L',-1),('R',1)]:
 c=center(.69,sign);top=[v for v in boundary if v.co.x*sign>0];top.sort(key=lambda v:math.atan2(v.co.y-c.y,v.co.x-c.x));N=len(top);assert N>12
 angles=[math.atan2(v.co.y-c.y,v.co.x-c.x) for v in top];start=angles[0];prev=top
 levels=[.675,.65,.63,.615,.60,.585,.57,.555,.54,.525,.51,.495,.48,.465,.45,.435,.415,.39,.35,.31,.27,.23,.19,.155,.14]
 for z in levels:
  ring=[];c=center(z,sign);t=smooth((.69-z)/.075)
  for i,oldangle in enumerate(angles):
   angle=oldangle*(1-t)+(start+i*math.tau/N)*t;radial=Vector((math.cos(angle),math.sin(angle),0));hit=tree.ray_cast(c+radial*.16,-radial,.16)[0]
   if hit is None:hit=c+Vector((.06*radial.x,.06*radial.y,0))
   v=bm.verts.new(hit);leg_weights(v,side);ring.append(v)
  for i in range(N):bm.faces.new((prev[i],prev[(i+1)%N],ring[(i+1)%N],ring[i]))
  prev=ring
 bm.faces.new(tuple(reversed(prev)))
# Add actual anchor loops: otherwise a long triangle can span the entire belt
# region with both ends outside its fixed skinning interval.
for z in [.965,.980,.994,1.010,1.025,1.045,1.065,1.085,1.105,1.135,1.170,1.205,1.240,1.265,1.290]:
 region=[v for v in bm.verts if abs(v.co.x)<.28]+[e for e in bm.edges if all(abs(v.co.x)<.28 for v in e.verts)]+[f for f in bm.faces if all(abs(v.co.x)<.28 for v in f.verts)]
 bmesh.ops.bisect_plane(bm,geom=region,dist=1e-6,plane_co=(0,0,z),plane_no=(0,0,1))
# Pelvis cloth at the belt is attached to the pelvis; distribute flexion higher.
levels=[(.96,'Pelvis'),(1.045,'Pelvis'),(1.135,'Spine'),(1.24,'SpineMid'),(1.29,'Chest')]
for v in bm.verts:
 x,y,z=v.co
 if not (.965<z<1.29 and abs(x)<.26):continue
 for (za,na),(zb,nb) in zip(levels,levels[1:]):
  if za<=z<=zb:
   t=smooth((z-za)/(zb-za));v[layer].clear()
   for n,w in [(na,1-t),(nb,t)]:
    if w>1e-7:
     gi=o.vertex_groups[n].index;v[layer][gi]=v[layer].get(gi,0)+w
   break
for v in bm.verts:
 ws=sorted([(i,w) for i,w in v[layer].items() if w>1e-7],key=lambda p:-p[1])[:4];total=sum(w for _,w in ws);assert total>0;v[layer].clear()
 for i,w in ws:v[layer][i]=w/total
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bad=sum(not e.is_manifold for e in bm.edges);assert bad==0,bad
bm.to_mesh(o.data);bm.free()
for f in o.data.polygons:f.use_smooth=True
# Replace the belt by a narrow strip fitted to the actual unchanged rest torso.
oldbelt=bpy.data.objects['Trial_Waist_Band'];oldbelt.name='Diagnostic_PreFit_WaistBand';oldbelt.hide_render=True;oldbelt.hide_set(True)
vs=[];N=48
for z in [.994,1.025]:
 for i in range(N):
  a=i*math.tau/N;c=Vector((0,-.013,z));radial=Vector((math.cos(a),math.sin(a),0));hit=tree.ray_cast(c+radial*.27,-radial,.27)[0];assert hit is not None;vs.append(hit+radial*.007)
fs=[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
me=bpy.data.meshes.new('FittedBand');me.from_pydata(vs,[],fs);me.update();belt=bpy.data.objects.new('Trial_Waist_Band',me);bpy.data.collections['STAGE2_ARMOR'].objects.link(belt);belt.parent=rig;belt.data.materials.append(bpy.data.materials['Rubber']);g=belt.vertex_groups.new(name='Pelvis');g.add(list(range(len(vs))),1,'REPLACE');bpy.context.view_layer.objects.active=belt;belt.select_set(True)
m=belt.modifiers.new('Band thickness','SOLIDIFY');m.thickness=.006;m.offset=0;bpy.ops.object.modifier_apply(modifier=m.name);m=belt.modifiers.new('Pelvis binding','ARMATURE');m.object=rig
(Q/'joint-refinement.json').write_text(json.dumps({'localRetopology':'Legs below z=.69, ring loops at .015m around knees, upper anatomy retained','nonmanifoldEdges':bad,'bodyVertices':len(o.data.vertices),'restSkeletonChanged':False,'belt':'Ray-fitted to saved torso, rigid pelvis binding','waistWeights':'Pelvis through belt; smooth Spine/SpineMid/Chest distribution above','kneePads':'Rigid UpperLeg binding retains protection over patella'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_refined.blend'))
