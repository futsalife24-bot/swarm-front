/** Shared by the live model loader and the recorded-film freshness check. */
// ?rev= is the sha256 prefix: the service worker caches assets by URL, so a
// re-encoded file (scripts/optimize-enemy-glb.mjs) needs a new URL.
export const ENEMY_MOTION_FILES = {
  hound: "assets/enemies/hound_motion_v1.glb",
  leaper: "assets/enemies/leaper_motion_v3.glb?rev=167059c9a0a2be60",
  pleat: "assets/enemies/pleat_motion_v5.glb?rev=193fe91b5e5ce3c8",
  prism: "assets/enemies/prism_motion_v1.glb",
  ray: "assets/enemies/ray_motion_v1.glb",
  foundry_zero:
    "assets/enemies/foundry_zero_motion_v1.glb?rev=84d8c85b01e6284b",
  calyx: "assets/enemies/calyx_motion_v1.glb?rev=d1a7573d5976e284",
  harrow: "assets/enemies/harrow_motion_v16.glb?rev=f0f20b7ee449900d",
} as const;
export type EnemyMotionName = keyof typeof ENEMY_MOTION_FILES;
export const FOUNDRY_WORM_FILE =
  "assets/enemies/foundry_zero_mechanical_legs_v2.glb?rev=d6d0ad241d429250";
