/** Render resolution only: never changes simulation, input, or saved preferences. */
export class AdaptiveQuality {
  scale = 1;
  private elapsed = 0;
  private frames = 0;
  private recovery = 0;
  update(dt: number, active: boolean): boolean {
    if (!active || !Number.isFinite(dt) || dt <= 0 || dt > 0.15) {
      this.elapsed = this.frames = this.recovery = 0;
      return false;
    }
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed < 2) return false;
    const fps = this.frames / this.elapsed;
    this.elapsed = this.frames = 0;
    const previous = this.scale;
    if (fps < 42) {
      this.scale = Math.max(0.65, Math.round((this.scale - 0.1) * 100) / 100);
      this.recovery = 0;
    } else if (fps > 55) {
      if (++this.recovery >= 4) {
        this.scale = Math.min(1, Math.round((this.scale + 0.05) * 100) / 100);
        this.recovery = 0;
      }
    } else this.recovery = 0;
    return this.scale !== previous;
  }
}
