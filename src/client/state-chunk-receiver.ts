import { StateChunkAssembler } from "../shared/state-chunks";

/** 未完成と放棄を区別する。切断・再接続を超えてtimerを持ち越さない。 */
export class StateChunkReceiver {
  private assembler = new StateChunkAssembler();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  constructor(private reconnect: () => void) {}
  read(input: unknown): unknown | undefined {
    if (this.stopped) return;
    const result = this.assembler.read(input);
    if (this.assembler.failed) {
      this.reject();
      return;
    }
    this.schedule();
    return result;
  }
  reject() {
    if (this.stopped) return;
    this.close();
    this.reconnect();
  }
  close() {
    this.stopped = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private schedule() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const deadline = this.assembler.deadline;
    if (this.stopped || deadline === undefined) return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (this.stopped) return;
        if (this.assembler.expire()) this.reject();
        else this.schedule();
      },
      Math.max(1, deadline - performance.now() + 1),
    );
  }
}
