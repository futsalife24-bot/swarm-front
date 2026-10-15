/** Shared by the live model loader and the recorded-film freshness check. */
export const ENEMY_MOTION_FILES = {
  hound: "assets/enemies/hound_motion_v1.glb",
  leaper: "assets/enemies/leaper_motion_v3.glb",
  pleat: "assets/enemies/pleat_motion_v5.glb",
  prism: "assets/enemies/prism_motion_v1.glb",
  ray: "assets/enemies/ray_motion_v1.glb",
  foundry_zero: "assets/enemies/foundry_zero_motion_v1.glb",
  calyx: "assets/enemies/calyx_motion_v1.glb?rev=d1a7573d5976e284",
  harrow: "assets/enemies/harrow_motion_v14.glb",
} as const;
export type EnemyMotionName = keyof typeof ENEMY_MOTION_FILES;
export const FOUNDRY_WORM_FILE =
  "assets/enemies/foundry_zero_mechanical_legs_v2.glb";
