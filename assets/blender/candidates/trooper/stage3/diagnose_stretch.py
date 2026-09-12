import bpy,json
from pathlib import Path
Q=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage3_animated.blend'));r=bpy.data.objects['STANDARD_TROOPER_RIG'];r.data.pose_position='POSE'
for t in r.animation_data.nla_tracks:t.mute=True
r.animation_data.action=bpy.data.actions['Trial_Switch_1_to_2'];bpy.context.scene.frame_set(27);bpy.context.view_layer.update();o=bpy.data.objects['Study_Body'];ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data;edges=[]
for e in o.data.edges:
 a,b=e.vertices;rest=(o.data.vertices[a].co-o.data.vertices[b].co).length;now=(ev.vertices[a].co-ev.vertices[b].co).length
 if rest>.006 and now>.07:edges.append((now/rest,a,b,rest,now))
out=[]
for ratio,a,b,l,n in sorted(edges,reverse=True)[:12]:
 out.append({'ratio':ratio,'rest':l,'posed':n,'vertices':[{'rest':list(o.data.vertices[i].co),'posed':list(ev.vertices[i].co),'weights':{o.vertex_groups[g.group].name:g.weight for g in o.data.vertices[i].groups}} for i in [a,b]]})
(Q/'body-stretch.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
