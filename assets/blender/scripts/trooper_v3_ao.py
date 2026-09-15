"""Bake local cavity occlusion into vertex colors; one shared six-material skin.
Only local 9cm occluders darken the surface, so limbs do not bake long shadows.
"""
from mathutils.bvhtree import BVHTree
vertices=[];polygons=[]
for o in meshes:
 offset=len(vertices);vertices.extend([o.matrix_world@v.co for v in o.data.vertices])
 polygons.extend([tuple(offset+i for i in p.vertices) for p in o.data.polygons])
bvh=BVHTree.FromPolygons(vertices,polygons)
count=16;directions=[]
for i in range(count):
 z=math.sqrt((i+.5)/count);a=i*2.3999632297;r=math.sqrt(1-z*z);directions.append(Vector((r*math.cos(a),r*math.sin(a),z)))
for o in meshes:
 attr=o.data.color_attributes.new(name='CavityAO',type='FLOAT_COLOR',domain='POINT');o.data.color_attributes.active_color=attr
 for vertex,color in zip(o.data.vertices,attr.data):
  normal=vertex.normal.normalized();rot=Vector((0,0,1)).rotation_difference(normal);origin=o.matrix_world@(vertex.co+normal*.0015)
  hits=0
  for d in directions:
   hit=bvh.ray_cast(origin,rot@d,.09)
   if hit[0] is not None:hits+=1
  value=1-.42*hits/count;color.color=(value,value,value,1)
 print('CAVITY_BAKED',o.name,len(o.data.vertices),flush=True)
