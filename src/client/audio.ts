import { backgroundMusic } from "./bgm";
import { CombatAudio } from "./combat-audio";
import type { World } from "../shared/game";
const LEVELS: Record<string, number> = {
  rifle: 0.62,
  shotgun: 0.8,
  rocket: 0.75,
  burst: 0.7,
  rocketBurst: 0.7,
  impact: 0.24,
  impactShell: 0.24,
  impactHard: 0.24,
  impactSoft: 0.24,
  reload: 0.28,
  ready: 0.32,
  switch: 0.32,
  equip: 0.36,
  unequip: 0.3,
  menu: 0.14,
  dodge: 0.4,
  hurt: 0.42,
  melee: 0.5,
  spit: 0.4,
  acid: 0.3,
  stake: 0.48,
  laser: 0.56,
  charge: 0.28,
  warning: 0.18,
  leap: 0.32,
  lunge: 0.4,
  land: 0.5,
  kill: 0.27,
  down: 0.4,
  revive: 0.35,
};
const BASE = `${import.meta.env.BASE_URL}assets/audio/se-v1/`;
const SELECTED = `${import.meta.env.BASE_URL}assets/audio/selected-v1/`;
const ROCKET_FINAL = `${import.meta.env.BASE_URL}assets/audio/rocket-final-v1/`;
const AR_HIT = `${import.meta.env.BASE_URL}assets/audio/ar-hit-v1/`;
const isImpact = (type: string) =>
  type === "impact" ||
  ["impactShell", "impactHard", "impactSoft"].includes(type);
export class Sound {
  context: AudioContext | undefined;
  private master?: GainNode;
  private level = 0.35;
  private buffers = new Map<string, AudioBuffer>();
  private bytes = new Map<string, ArrayBuffer>();
  private loading?: Promise<void>;
  private decoding?: Promise<void>;
  private last = new Map<string, number>();
  private voices = new Set<AudioBufferSourceNode>();
  private menuVoices = new Set<AudioBufferSourceNode>();
  private tracker = new CombatAudio();
  private active = false;
  get volume() {
    return this.level;
  }
  set volume(v: number) {
    this.level = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    backgroundMusic().volume = this.level;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.level,
        this.context.currentTime,
        0.015,
      );
    if (this.level === 0) this.stop();
  }
  constructor() {
    void this.preload();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
    });
  }
  preload() {
    if (this.loading) return this.loading;
    this.loading = Promise.all(
      Object.keys(LEVELS).map(async (key) => {
        if (this.bytes.has(key)) return;
        try {
          const r = await fetch(
            (key !== "impact" && isImpact(key)
              ? AR_HIT
              : key === "rocketBurst"
                ? ROCKET_FINAL
                : ["rifle", "shotgun"].includes(key)
                  ? SELECTED
                  : BASE) +
              key +
              ".wav",
          );
          if (!r.ok) throw Error(String(r.status));
          this.bytes.set(key, await r.arrayBuffer());
        } catch {
          /* A failed clip can be retried on the next user gesture. */
        }
      }),
    ).then(() => {
      this.loading = undefined;
    });
    return this.loading;
  }
  unlock() {
    backgroundMusic().unlock();
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.16;
        // Leave headroom for short transients before the compressor reacts.
        const headroom = this.context.createGain();
        headroom.gain.value = 0.6;
        this.master
          .connect(compressor)
          .connect(headroom)
          .connect(this.context.destination);
      }
      if (this.context.state !== "running")
        void this.context.resume().catch(() => {});
      void this.load();
    } catch {
      /* Gameplay also works where Web Audio is unavailable. */
    }
  }
  async load() {
    if (!this.context) return;
    if (this.decoding) return this.decoding;
    this.decoding = (async () => {
      await this.preload();
      await Promise.all(
        [...this.bytes].map(async ([key, bytes]) => {
          if (this.buffers.has(key)) return;
          try {
            this.buffers.set(
              key,
              await this.context!.decodeAudioData(bytes.slice(0)),
            );
          } catch {
            this.bytes.delete(key);
          }
        }),
      );
    })().finally(() => {
      this.decoding = undefined;
    });
    return this.decoding;
  }
  stop(combatOnly = false) {
    for (const voice of this.voices) {
      if (combatOnly && this.menuVoices.has(voice)) continue;
      voice.stop();
      this.voices.delete(voice);
      this.menuVoices.delete(voice);
    }
  }
  consumed(run: string) {
    return this.tracker.consumed(run);
  }
  update(
    w: World | null | undefined,
    id: string,
    yaw: number,
    active: boolean,
  ) {
    active &&= !document.hidden;
    if (!active && this.active) this.stop(true);
    this.active = active;
    if (!w) {
      this.tracker = new CombatAudio();
      return;
    }
    const p = w.players.find((p) => p.id === id);
    for (const cue of this.tracker.collect(w, active)) {
      if (!p) continue;
      const dx = (cue.x ?? p.x) - p.x,
        dz = (cue.z ?? p.z) - p.z,
        d = Math.hypot(dx, dz),
        mine = cue.owner === id;
      const gain =
        mine &&
        !isImpact(cue.type) &&
        !["burst", "rocketBurst", "kill"].includes(cue.type)
          ? 1
          : 1 / (1 + (d / 13) ** 2);
      if (d > 85 && !mine) continue;
      const pan = mine
        ? 0
        : Math.max(
            -0.85,
            Math.min(
              0.85,
              (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.max(6, d),
            ),
          );
      this.play(cue.type, gain, pan, cue.key);
    }
  }
  play(type: string, gain = 1, pan = 0, key = type, delay = 0) {
    const c = this.context;
    if (
      !c ||
      c.state !== "running" ||
      this.volume <= 0 ||
      document.hidden ||
      !(type in LEVELS)
    )
      return;
    const now = c.currentTime;
    // Per cue/source: pellets coalesce, but a shot never suppresses a hit or dodge.
    if (
      now - (this.last.get(key) ?? -Infinity) <
      (isImpact(type) ? 0.075 : 0.045)
    )
      return;
    this.last.set(key, now);
    if (this.last.size > 256)
      for (const [k, t] of this.last) if (now - t > 2) this.last.delete(k);
    if (this.voices.size >= 32) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
      if (oldest) this.voices.delete(oldest);
    }
    const source = c.createBufferSource(),
      g = c.createGain(),
      stereo = c.createStereoPanner();
    const buffer = this.buffers.get(type);
    if (buffer) source.buffer = buffer;
    else {
      // Tiny click during first-gesture decoding; no late combat audio backlog.
      const b = c.createBuffer(
          1,
          Math.ceil(c.sampleRate * 0.035),
          c.sampleRate,
        ),
        d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3 * 0.15;
      source.buffer = b;
    }
    source.playbackRate.value = [
      "menu",
      "equip",
      "unequip",
      "reload",
      "ready",
    ].includes(type)
      ? 1
      : 0.975 + Math.random() * 0.05;
    g.gain.value = LEVELS[type] * Math.max(0, Math.min(1, gain));
    stereo.pan.value = pan;
    source.connect(g).connect(stereo).connect(this.master!);
    this.voices.add(source);
    if (["menu", "equip", "unequip"].includes(type))
      this.menuVoices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      this.menuVoices.delete(source);
      source.disconnect();
      g.disconnect();
      stereo.disconnect();
    };
    source.start(now + delay);
  }
}
