/** Shared attack timing: authoritative wind-up ends at the authored impact pose. */
export const STRUCTURE_TIMING = {
  crawler: { wind: 0.45, impact: 0.45, duration: 1.2, cooldown: 1.2 },
  spitter: { wind: 0.8, impact: 0.8, duration: 1.6, cooldown: 2.7 },
  hornet: { wind: 2.05, impact: 2.05, duration: 3.6, cooldown: 2.7 },
  boss: { wind: 3.1, impact: 3.1, duration: 4.8, cooldown: 3 },
} as const;
export type StructureKind = keyof typeof STRUCTURE_TIMING;
