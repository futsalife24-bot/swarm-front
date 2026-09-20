// Base city geometry is independent of weapon/progression initialization.
export interface Block {
  terrainBase?: number;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}
export const BLOCKS: Block[] = [];
for (const x of [-31, -17, 17, 31])
  for (const z of [-35, -17, 4, 24, 40])
    BLOCKS.push({
      x,
      z,
      w: 8,
      d: z === 4 ? 9 : 11,
      h: 8 + ((x * x + z * z) % 14),
    });
