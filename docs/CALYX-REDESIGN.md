# CALYX — rounded bud and continuous roots (2026-09-20)

Latest user specification: reduce the grotesque bark/limb appearance; store the
front petal while closed, enlarge the resting bud, open before striking, use a
slightly reddish palette. Follow-up explicitly removes human-like knee/ankle
joints and requires three completely curved roots.

The new model uses five flush outer petals, a larger rounded terracotta bud,
sparse ribs, warm ivory interiors, and three smooth tapered cubic roots. The
roots deform through continuous polynomial translation over their entire length;
no root handle rotates. The internal upper/lower/foot names remain compatible
with the existing 16-bone renderer. Original v2 remains in Git history and
the standalone `../prototypes/calyx/v2/` directory.

No changes to combat rules, projectile origin, timings, stage placement, network
state or saves. Bestiary text now describes opening before striking and the new
silhouette. Runtime filename remains `calyx_motion_v1.glb`.

## Candidate and validation

- Base: ed42e62f4d86ceef9fb4a438fc83d47b41c777fe.
- Branch: codex/calyx-rounded-redesign in existing calyx-integration worktree.
- GLB SHA256: 86c12822e8e9ad6ebf88b876a8d88413bd6d9c5faaf4d9b658f2985d0270be72.
- 584,404 bytes, 13,990 triangles, 16 bones, five materials, four existing clips.
- Blender native reopen and GLB reimport succeeded. All authored 30fps frames
  checked: finite deformations, no floor penetration, exact clip return loops.
- Root handle rotation max 0 radians; skinned root-tip world stance slip below
  0.000001m at nominal 0.65m/s. Contact tip rests about 1.5cm above ground.
- P1 lowest point at impact 1.0s: 0.015m. Petal/petal and petal/whole-root
  triangle intersection checks find no intersections in sampled frames.
- Zero degenerate triangles; normalized weights. Tests calyx + structure-motion:
  19/19. Client and Worker type checks passed.
- IAB current GPU game renderer loads all four clips/16 bones. At Slam 1s the
  player loses 24 HP; at pollen cloud time 5s the player has lost 20 HP and one
  cloud is present. Browser fixture uses existing shared simulation and renderer.
- Evidence and exact hashes: `docs/evidence/calyx-v3/`. Reproduction scripts:
  `assets/blender/calyx/`. Standalone actual-GLB preview and recorded motion:
  `../prototypes/calyx/v3/` (local artifacts, not production URLs).
- Meloso Judge was invoked from canonical game root as required. Fixed check
  needs_context; live not_run/no_new_eligible_selected_change, API calls 0.
  It inspected that root's separate worktree, not this candidate: no CALYX
  approval is inferred from it.

Limits: sampled rather than continuous collision; intentional Body attachments
excluded from pairwise collision checks. User aesthetic acceptance is not
inferred. Independent Chat audit, main merge and publication are pending.

Independent audit sent with exact target 61d8fb63f8df3a7cb7f86859a35bdbb8b5a75957 and CALYX-v3-61d8fb6.zip: https://chatgpt.com/c/6aafd926-90a0-83ee-a297-65a7f91d005d . PR58: https://github.com/futsalife24-bot/swarm-front/pull/58 . Production build passed. Audit verdict pending.
