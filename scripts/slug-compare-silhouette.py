import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path.cwd()
out=root/'dist-validation'/'slug-silhouette-compare'
out.mkdir(parents=True,exist_ok=True)
for kind,model in [('SG-4',root/'public/assets/weapons/realism-v2/shotgun_0.glb'),('SG-7',root/'design/weapon-models-20261111/out/slug/slug_0.glb')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model))
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=96;scene.render.resolution_y=36;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    mat=bpy.data.materials.new('Silhouette');mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(1,1,1,1);em.inputs['Strength'].default_value=1
    output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],output.inputs['Surface']);bpy.context.view_layer.material_override=mat
    camera=bpy.data.cameras.new('Camera');camera.type='ORTHO';camera.ortho_scale=1.15
    obj=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(obj);obj.location=(2,.14,-.02)
    obj.rotation_euler=(Vector((0,.14,-.02))-obj.location).to_track_quat('-Z','Y').to_euler();scene.camera=obj
    scene.render.filepath=str(out/(kind+'.png'));bpy.ops.render.render(write_still=True)
