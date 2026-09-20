import { move } from "../shared/game";
import type { Block } from "../shared/defs";

// Predict horizontal motion only. Snapshots own jump/fall altitude; applying
// grounded movement here would snap descending soldiers through the floor.
export function predictPlayerMove(
  p: { x: number; z: number; y?: number },
  dx: number,
  dz: number,
  blocks: Block[],
) {
  move(p, dx, dz, 0.55, blocks, true, true);
}
