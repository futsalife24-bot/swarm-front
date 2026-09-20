# CALYX v3

Rounded terracotta bud, five outer petals, one core, three continuous curved roots.
The front petal is flush with the closed bud and swings down only after opening.
Root meshes have no knee/ankle silhouette. Three translation handles per root use
Bernstein weights across the complete curve; they do not rotate as limb joints.
Legacy handle names are retained for compatibility with the existing 16-bone rig.

Blender 5.2: copy this directory to a scratch directory and run
`blender --background --factory-startup --python build_calyx.py`.
Outputs: calyx.blend, calyx.glb, build-report.json, contact-targets.json.
Copy the validated GLB to public/assets/enemies/calyx_motion_v1.glb.

Motion contract is unchanged: height 2.3m, GLB -Z forward, 0.65m/s,
Idle 4s, Locomotion 2s, Slam 2.2s (impact 1s), PollenShot 2.8s (release 1.6s).
The older GLB filename is retained to preserve the loader contract.
See docs/CALYX-REDESIGN.md for validation and audit evidence.
