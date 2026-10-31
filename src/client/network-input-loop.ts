import type { Input } from "../shared/game";

export type NetworkInputSource = () => Input | undefined;

/** RAFを待たずに最新入力を採取する。停止分の追いつき送信は行わない。 */
export class NetworkInputLoop {
  private source: NetworkInputSource | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private generation = 0;

  constructor(
    private consume: (input: Input) => void,
    private discard: () => void,
    private scheduling?: (lag: number) => void,
  ) {}

  setInputSource(source?: NetworkInputSource) {
    this.source = source;
    if (!source) {
      this.cancelTimer();
      this.discard();
    } else this.schedule();
  }

  start() {
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    this.generation++;
    this.cancelTimer();
    this.discard();
  }

  close() {
    this.stop();
    this.source = undefined;
  }

  private cancelTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    if (!this.running || !this.source || this.timer !== undefined) return;
    const due = performance.now() + 50;
    this.timer = setTimeout(() => {
      this.scheduling?.(Math.max(0, performance.now() - due));
      this.timer = undefined;
      const generation = this.generation;
      try {
        const input = this.source?.();
        if (!this.running || generation !== this.generation || !this.source)
          return;
        if (input) this.consume(input);
        else this.discard();
      } finally {
        // 入力処理の完了から50ms空ける。既存input()の間隔制限と競合させない。
        if (generation === this.generation) this.schedule();
      }
    }, 50);
  }
}
