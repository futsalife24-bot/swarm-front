/** The normal FOUNDRY's two-second walk advances 0.48 metres at model scale 1. */
export function foundryWalkSeconds(worldDistance: number, modelScale: number) {
  return (worldDistance * 2) / (0.48 * modelScale);
}
