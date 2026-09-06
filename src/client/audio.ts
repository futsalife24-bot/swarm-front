export class Sound {
  context: AudioContext | undefined;
  volume = 0.35;
  last = 0;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  play(type: string) {
    if (
      !this.context ||
      this.volume <= 0 ||
      this.context.currentTime - this.last < 0.045
    )
      return;
    this.last = this.context.currentTime;
    const o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type === "burst" ? "sawtooth" : "triangle";
    const freq =
      type === "shot" ? 180 : type === "hit" ? 650 : type === "kill" ? 330 : 80;
    o.frequency.setValueAtTime(freq, this.last);
    o.frequency.exponentialRampToValueAtTime(35, this.last + 0.12);
    g.gain.setValueAtTime(this.volume * 0.13, this.last);
    g.gain.exponentialRampToValueAtTime(0.001, this.last + 0.14);
    o.connect(g).connect(this.context.destination);
    o.start();
    o.stop(this.last + 0.15);
  }
}
