# HARROW v8 — upright airborne sentinel

Based on saved v7 commit `90cc7a64c202bb95693f362c3ed75040fb866aad`, on `codex/harrow-presence-motion`. v7 and v6 remain unchanged. The user's additional image requests an intimidating boss which hovers with a raised chest, lowered hind legs and foreclaws held forward, elegantly beating its wings while judging its target. `hover-reference.jpg` preserves that supplied pose reference. The original `reference.jpg` remains the geometry reference. No unapproved silhouette or material redesign was added.

Runtime scale remains 1.95, flight origin altitude 34.5 m, cruise speed 0.64 m/s. Root heading/position remain authority-owned and no root translation is baked. The established 39-bone geometry, 186 glTF primitives and 152,428 triangles remain intact.

## Motion changes

- Flight torso pitches upward 0.95 rad (54.4 degrees). Neck and head counterbend to keep the face looking toward soldiers below; a restrained head scan communicates attention. Forelimbs fold in front of the chest and hind limbs hang down. Claws turn downward rather than remaining flat as on the floor. The tail curls progressively from its base.
- The 4.2-second Flight wing beat is asymmetric: the powerful downstroke occupies 35% of the cycle and the recovery upstroke occupies 65%. Both use eased endpoints, with 0.38-radian oscillation amplitude. Takeoff rises into this posture.
- New **AirThreat** is the airborne version of the seven-second missile preparation. It keeps the raised chest, wing beat and captured foreclaws. Missile tips are measured at 3.5 seconds. Grounded Threat remains the v7 clip and its measured launch positions are preserved; the game selects the correct clip/origins according to airborne state.
- Glide is now a single transition from upright hover to the existing streamlined dive-ready posture over 2.1 seconds. Its endpoint must clamp. Dive starts in that exact posture and strikes in the approved 0.9 seconds. Land retains the v7 horizontal landing recovery to avoid a sudden reversal from the head-down Dive endpoint into a raised chest.
- Idle, Locomotion, ground Threat, Spin, Attack, StaggerFall and their timings retain the completed v7 motion. Spin continues to rely on the authority for exactly one horizontal revolution.

The hovering downstroke intentionally extends below the enemy's local origin: approximately 4.33 m in Flight / 4.66 m in AirThreat at game scale, while the origin is 34.5 m above terrain. Local Y>=0 is therefore not the ground test for these airborne clips; validation adds the real airborne altitude. Grounded and ground-reaching clips still require local contact/clearance. The Blender evidence floor is only the origin plane for airborne views.

## Reproduction

All generators write only this candidate directory and `dist-validation/harrow-v8/`. Required source inputs: `geometry_source.py`, `unified_body.py`, `hound-part.json`, `prism-core.json`, and `reference.jpg`. The former geometry generator's legacy export tail is not executed. No network or new asset-generation service is used.

From repository root:

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v8/build_harrow.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v8/verify_render.py -- --validate-only
node assets/blender/candidates/harrow/v8/verify_asset.mjs
node assets/blender/candidates/harrow/v8/verify_kinematics.mjs
node assets/blender/candidates/harrow/v8/verify_launchers.mjs
node assets/blender/candidates/harrow/v8/verify_launchers.mjs AirThreat
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v8/render_final.py
```

The parent task owns runtime clip selection, authority changes, collision, real game playback, audit and release. Candidate completion and numeric checks do not imply user approval of the final appearance or smartphone performance.
