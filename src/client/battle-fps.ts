/** 実際の描画回数を実時間で集計する。ゲーム側のdt上限の影響を受けない。 */
export class BattleFps {
  private readonly label = document.createElement("div");
  private start: number | null = null;
  private firstFrame = 0;

  constructor() {
    this.label.className = "battle-fps";
    this.label.hidden = true;
    this.label.textContent = "— FPS";
    this.label.setAttribute("aria-label", "描画フレームレート");
    document.body.append(this.label);
  }

  update(
    now: number,
    renderedFrames: number,
    visible: boolean,
    active: boolean,
  ) {
    this.label.hidden = !visible;
    if (!visible || !active || document.hidden) {
      this.start = null;
      this.label.textContent = "— FPS";
      return;
    }
    if (this.start === null) {
      this.start = now;
      this.firstFrame = renderedFrames;
      return;
    }
    const elapsed = now - this.start;
    if (elapsed < 1000) return;
    this.label.textContent = `${Math.round(((renderedFrames - this.firstFrame) * 1000) / elapsed)} FPS`;
    this.start = now;
    this.firstFrame = renderedFrames;
  }
}
