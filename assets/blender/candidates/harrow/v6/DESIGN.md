# HARROW v6: campaign integration motion source

The user requested HARROW at 15-A, 20 and 25, then specified ten upward missiles from the wing launchers, a grounded wing sweep with one horizontal revolution, alternating ground/air behavior, an airborne introduction, gliding dives, and staggered falls after accumulated air damage. The game authority owns the turn, elevation, flight limit, damage and projectile trajectories. This candidate adds the necessary shapes and in-place poses.

The accepted v5 silhouette, connected torso/neck, 39-bone skeleton, materials and PRISM shoulders remain the basis. Source: `../../../../../../prototypes/harrow/v5/`, original GLB SHA256 `e268b1445c09c808debaf09500248244beeaba559047427d0f30dab183a92fb2`. The v5 files are preserved. No new reference image is needed for these directed changes.

- Runtime: standard skinned GLB; Blender Z-up, authored forward -X. Game adapter rotates Y by -PI/2 and scales by 0.65. Translation/heading are not baked into Root.
- 184 Blender mesh objects export as 186 Three.js SkinnedMeshes because the continuous body has three material primitives. The game merges equal-material primitives into 20 draws. 152,428 triangles, 39 bones, 11 clips.
- Each launcher has four corner missiles plus a fifth central missile. Corner spacing is 0.42 authored generator units, leaving positive clearance between the 0.244-diameter barrels and center barrel. All other silhouette components stay unchanged.
- Spin lowers each wing rigidly around its shoulder by 0.66245533 radians, solving the real vertex minimum to Z=0.02. Both wings stay at that plane from 0.8 through 2.8 seconds; game heading performs one revolution during that interval. The four feet remain planted locally.
- Air poses tuck the legs and spread the wings. Flight has a restrained flap. Glide leans forward; Dive deepens to 0.82 rad with progressively tucked legs. StaggerFall partially folds the wings and gently recoils. Takeoff and Land interpolate between grounded and flying poses.
- New durations: Spin 3.6, Takeoff 2.0, Flight 2.4, Glide 1.2, Dive 0.8, StaggerFall 1.5, Land 1.0 seconds. Idle 4.0, Locomotion 2.4, Attack 3.0 and Threat 4.0 remain. Attack is retained as source material but is not the new melee attack. Takeoff, Dive, StaggerFall and Land must clamp at their endpoints. The game blends transitions between clips.
- The authored locomotion nominal speed remains 0.16 m/s, corresponding to 0.104 m/s after game scale; animation phase uses actual travel distance.

Rebuild from `game/` using a separate Blender 5.2.1 LTS process:

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v6/build_harrow.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v6/verify_render.py
```

`build_harrow.py` writes only this candidate directory. `geometry_source.py`, `unified_body.py`, `hound-part.json`, `prism-core.json` and `reference.jpg` are the required local inputs. No random seed or external assets are fetched. Copy `harrow.glb` to `public/assets/enemies/harrow_motion_v6.glb` only after verification. The inherited geometry source contains an unused legacy export tail; the builder deliberately reads only the section before `# Material groups inside semantic collections`.

Checks: `scripts/check-harrow-v6.mjs` samples the runtime geometry; `scripts/check-harrow-asset.mjs` verifies every bone at 60 Hz and every vertex at 10 Hz, local ground clearance, shared binding, closed-loop clips and native skin versus actual production palette. `scripts/check-harrow-launchers.mjs` extracts each real missile tip at Threat 2.0 s. `verify_render.py` reopens both saved source and GLB, verifies weighting/root/limb joints and renders eight views. Evidence belongs in `dist-validation/harrow/`; machine output and backup `.blend1` files are not runtime deliverables.

Independent Chat review, final game play and release verification are performed by the main task. Standalone model tests do not certify authoritative combat, multiplayer or a sustained GPU budget.
