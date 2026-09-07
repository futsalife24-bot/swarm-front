export class Sound {
  context: AudioContext | undefined;
  volume = 0.35;
  last = 0;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      // A fresh context starts at currentTime 0, which the 45ms guard below
      // reads as "just played" and swallows the very first sound.
      this.last = -1;
    }
    void this.context.resume();
  }
  // A latch closing: a short scrape of noise over a low knock. The single
  // swept oscillator used for combat cannot sound mechanical.
  clack() {
    const c = this.context!,
      t = this.last;
    const frames = Math.floor(c.sampleRate * 0.06);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2100;
    band.Q.value = 1.1;
    const ng = c.createGain();
    ng.gain.value = this.volume * 0.5;
    noise.connect(band).connect(ng).connect(c.destination);
    noise.start(t);
    const knock = c.createOscillator(),
      kg = c.createGain();
    knock.type = "square";
    knock.frequency.setValueAtTime(160, t);
    knock.frequency.exponentialRampToValueAtTime(60, t + 0.05);
    kg.gain.setValueAtTime(this.volume * 0.14, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    knock.connect(kg).connect(c.destination);
    knock.start(t);
    knock.stop(t + 0.08);
  }
  play(type: string) {
    if (
      !this.context ||
      this.volume <= 0 ||
      this.context.currentTime - this.last < 0.045
    )
      return;
    this.last = this.context.currentTime;
    if (type === "equip") return this.clack();
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
