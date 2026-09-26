"""ANOMALY hard-shell material set (from HOUND / LEAPER, 2026-09-26).

Reusable by any ANOMALY generator running inside Blender:

    import sys; sys.path.insert(0, str(LIBRARY_DIR))
    import anomaly_materials as am
    mats = am.create('CALYX')            # new materials named CALYX_shell, ...
    am.apply(existing_material, 'shell')  # or restyle a material in place
    am.planar_uv(mesh_object)            # UVs matching the texel scale used by LEAPER

Roles
    shell        dark hard exoskeleton        (HOUND_shell)
    spine        pale grown bone / scute      (HOUND_spine)
    edge_metal   blue-grey hardened edge      (HOUND_edge_metal)
    ring_emission cyan organ light            (HOUND_ring_emission)

The PNGs in textures/ are byte-identical to the images embedded in the shipped
leaper_motion_v2.glb (originally generated deterministically by
candidates/reference-redesign-v1, seeds 1209/1210). Nothing here depends on
Blender-only procedural nodes, so glTF export reproduces the look in-game.
"""
from pathlib import Path
import json
import bpy

HERE = Path(__file__).resolve().parent
TEXTURES = HERE / 'textures'
SPEC = json.loads((HERE / 'materials.json').read_text(encoding='utf-8'))
ROLES = tuple(SPEC['roles'])


def _image(name):
    path = TEXTURES / f'{name}.png'
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = 'sRGB' if name.endswith('_albedo') else 'Non-Color'
    image.pack()
    return image


def apply(mat, role, textured=True):
    """Rebuild `mat` as the given role. textured=False gives the flat HOUND v1 look."""
    spec = SPEC['roles'][role]
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    mat.use_backface_culling = False
    flat = spec['flat']
    bsdf.inputs['Base Color'].default_value = (*flat['base_color'], 1)
    bsdf.inputs['Metallic'].default_value = flat['metallic']
    bsdf.inputs['Roughness'].default_value = flat['roughness']
    mat.diffuse_color = (*flat['base_color'], 1)
    if 'emission_color' in spec:
        bsdf.inputs['Emission Color'].default_value = (*spec['emission_color'], 1)
        bsdf.inputs['Emission Strength'].default_value = spec['emission_strength']
    tex = spec.get('textured')
    if textured and tex:
        bsdf.inputs['Metallic'].default_value = tex['metallic']
        albedo = nodes.new('ShaderNodeTexImage'); albedo.image = _image(tex['albedo'])
        links.new(albedo.outputs['Color'], bsdf.inputs['Base Color'])
        rough = nodes.new('ShaderNodeTexImage'); rough.image = _image(tex['roughness'])
        links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])
        normal_tex = nodes.new('ShaderNodeTexImage'); normal_tex.image = _image(tex['normal'])
        normal = nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = tex['normal_strength']
        links.new(normal_tex.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def create(prefix, textured=True):
    """New materials `<prefix>_<role>` for every role. Returns {role: material}."""
    out = {}
    for role in ROLES:
        mat = bpy.data.materials.new(f'{prefix}_{role}')
        out[role] = apply(mat, role, textured)
    return out


def planar_uv(obj, scale=None):
    """Per-face planar projection at constant world texel density (LEAPER v2 convention)."""
    scale = SPEC['uv_scale'] if scale is None else scale
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name='SurfaceUV')
    for face in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in face.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (co[axes[0]] * scale, co[axes[1]] * scale)
