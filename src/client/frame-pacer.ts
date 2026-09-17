/** Limits visual work only. Simulation, input and network keep their own clocks. */
export class FramePacer {
  private budget = 0;
  private elapsed = 0;
  private target = 0;

  reset() {
    this.budget = this.elapsed = this.target = 0;
  }

  next(dt: number, fps: 30 | 60): number | null {
    if (!Number.isFinite(dt) || dt < 0) return null;
    this.elapsed += dt;
    this.budget += dt;
    const interval = 1 / fps;
    if (this.target !== fps) {
      this.target = fps;
      this.budget = interval;
    }
    if (this.budget + 0.00001 < interval) return null;
    this.budget %= interval;
    if (this.budget + 0.00001 >= interval) this.budget = 0;
    const elapsed = this.elapsed;
    this.elapsed = 0;
    return Math.min(0.1, elapsed);
  }
}
