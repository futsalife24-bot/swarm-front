/** Keep streaming media, but apply gain outside iOS's read-only media volume. */
export class MediaVolume {
  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private gain?: GainNode;
  private level = 1;
  private disposed = false;
  constructor(private media: HTMLMediaElement) {}
  set volume(value: number) {
    this.level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.apply();
  }
  private apply() {
    if (this.gain && this.context) {
      this.media.volume = 1;
      this.gain.gain.setTargetAtTime(
        this.level,
        this.context.currentTime,
        0.015,
      );
    } else this.media.volume = this.level;
    this.media.muted = this.level === 0;
  }
  /** Call synchronously in a click/touch/key handler; retry after interruptions. */
  unlock() {
    if (this.disposed) return;
    let created: AudioContext | undefined;
    try {
      if (!this.context) {
        const context = (created = new AudioContext());
        const gain = context.createGain();
        gain.gain.value = this.level;
        gain.connect(context.destination);
        const source = context.createMediaElementSource(this.media);
        source.connect(gain);
        this.context = context;
        this.source = source;
        this.gain = gain;
        this.apply();
      }
      if (this.context.state !== "running")
        void this.context.resume().catch(() => {});
    } catch {
      if (created && created !== this.context)
        void created.close().catch(() => {});
      // Browsers without Web Audio retain native media playback and mute.
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.source?.disconnect();
    this.gain?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
