# CALYX v6

Runtime locomotion now travels at 1.95m/s and samples the authored clip at 3x
speed (one turn per 2s). Authored clip time and the 0.65m/s contact contract
below remain unchanged. Roots bow outward during locomotion; planted tips
retain their contact track. Idle and attack timing remain unchanged.

Rounded grey-green bud with restrained rust-brown marbling, five outer petals,
one core, three smooth curved roots. The front petal stays flush while closed
and swings down after opening. No articulated knee or ankle silhouette.
Three polynomial-weighted handles deform each continuous root; their relative
rotation remains zero, including the inclined-top locomotion.

Copy this directory to a scratch directory, then run Blender 5.2:
`blender --background --factory-startup --python build_calyx.py`
Outputs: calyx.blend, calyx.glb, build-report.json, contact-targets.json.
Run inspect_glb.cjs, validate_render.py, and check_intersections.py there.
The validators reopen the native file and reimport the exported GLB.

Height 2.3m; Blender +Y forward / Z up; GLB -Z forward / Y up.
Idle 4s; Locomotion 6s; Slam 2.2s (impact 1s); PollenShot 2.8s (release 1.6s).
Locomotion inclines the bud 45 degrees forward while spinning once in 6s.
Nominal external travel is Blender +X / GLB +X lateral at 0.65m/s.
In game the forward axis faces the selected soldier while translation follows
the orbit tangent. Attack transitions blend over 0.35s, then use existing timing.

Runtime GLB filename remains calyx_motion_v1.glb for loader compatibility.
See docs/CALYX-REDESIGN.md for current validation, evidence, and audit state.
