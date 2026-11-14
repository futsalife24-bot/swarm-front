import { loadControlVoiceVolume } from "./control-voice-volume";
import { backgroundMusic } from "./bgm";
import { CombatAudio } from "./combat-audio";
import {
  SoldierVoice,
  SOLDIER_VOICES,
  SOLDIER_PATH,
  type SoldierClip,
} from "./soldier-voice";
import type { World } from "../shared/game";
import {
  AnomalyVoice,
  ANOMALY_VOICE_KEYS,
  ANOMALY_VOICE_PATH,
} from "./anomaly-voice";
import {
  ControlVoiceQueue,
  controlVoicePath,
  loadControlVoice,
  saveControlVoice,
  type ControlVoiceId,
} from "./control-voice";
import {
  controlVoiceLine,
  controlVoiceIdsForScene,
  playableLine,
  type ControlVoiceScene,
} from "./control-voice-lines";
import { ControlAnnouncer } from "./control-announcer";
import {
  controlVoicePacks,
  type ControlVoicePacks,
} from "./control-voice-packs";
const LEVELS: Record<string, number> = {
  ...Object.fromEntries(ANOMALY_VOICE_KEYS.map((key) => [key, 0.24])),
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
const clampVolume = (v: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
export class Sound {
  context: AudioContext | undefined;
  private master?: GainNode;
  private controlMaster?: GainNode;
  private controlLevel?: number;
  private level = 0.35;
  private musicLevel = 1;
  private effectsLevel = 1;
  private buffers = new Map<string, AudioBuffer>();
  private bytes = new Map<string, ArrayBuffer>();
  private loading?: Promise<void>;
  private decoding?: Promise<void>;
  private last = new Map<string, number>();
  private voices = new Set<AudioBufferSourceNode>();
  private menuVoices = new Set<AudioBufferSourceNode>();
  private tracker = new CombatAudio();
  private soldier = new SoldierVoice();
  private anomaly = new AnomalyVoice();
  private anomalyVoices = new Set<AudioBufferSourceNode>();
  private speech?: AudioBufferSourceNode;
  private speechRun = "";
  private speechOwner = "";
  private active = false;
  private controlSources = new Set<AudioBufferSourceNode>();
  private announcer = new ControlAnnouncer();
  /** 基礎訓練の間は兵士の掛け声を止める（tutorial-proposal §8-1 の3）。 */
  soldierVoiceEnabled = true;
  /** 管制AI音声。全体音量と専用の倍率を通り、SE音量から独立する。 */
  readonly controlVoice = new ControlVoiceQueue(
    {
      ready: (path) =>
        !!this.controlMaster &&
        this.context?.state === "running" &&
        this.controlOutputVolume > 0 &&
        !document.hidden &&
        this.buffers.has(`control:${path}`),
      start: (path, onEnded) => this.startControl(path, onEnded),
    },
    { voice: loadControlVoice() },
  );
  get volume() {
    return this.level;
  }
  set volume(v: number) {
    this.level = clampVolume(v);
    this.syncVolumes();
  }
  get musicVolume() {
    return this.level * this.musicLevel;
  }
  get effectsVolume() {
    return this.level * this.effectsLevel;
  }
  get controlVoiceVolume() {
    return this.controlLevel ?? 1;
  }
  set controlVoiceVolume(value: number) {
    this.controlLevel = clampVolume(value);
    this.syncVolumes();
  }
  get controlOutputVolume() {
    return this.level * this.controlVoiceVolume;
  }
  setVolumes(volume: number, bgm = 1, se = 1) {
    // 初回だけ旧SE倍率を既定にする。以後のSE変更には追随させない。
    this.controlLevel ??= loadControlVoiceVolume(clampVolume(se));
    this.level = clampVolume(volume);
    this.musicLevel = clampVolume(bgm);
    this.effectsLevel = clampVolume(se);
    this.syncVolumes();
  }
  private syncVolumes() {
    backgroundMusic().volume = this.musicVolume;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.effectsVolume,
        this.context.currentTime,
        0.015,
      );
    if (this.controlMaster && this.context)
      this.controlMaster.gain.setTargetAtTime(
        this.controlOutputVolume,
        this.context.currentTime,
        0.015,
      );
    if (this.effectsVolume === 0) this.stop(true);
    if (this.controlOutputVolume === 0) this.controlVoice.stop();
  }
  constructor(
    /** 管制AIの声の取得元（設定でダウンロードしたパック）。テストで差し替える。 */
    private readonly packs: ControlVoicePacks = controlVoicePacks,
  ) {
    // パックの保存・削除で、展開済みの声を捨てる（削除後は無音・字幕だけに戻る）。
    packs.subscribe((voice) => {
      const pattern = new RegExp(`^control:voice-[a-z]+-${voice}-v\\d+/`);
      let removed = false;
      for (const map of [this.buffers, this.bytes] as Map<string, unknown>[])
        for (const key of [...map.keys()])
          if (pattern.test(key)) {
            map.delete(key);
            removed = true;
          }
      if (removed) this.controlVoice.stop();
    });
    void this.preload();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
      }
    });
  }
  preload() {
    if (this.loading) return this.loading;
    this.loading = Promise.all(
      [
        ...Object.keys(LEVELS),
        ...SOLDIER_VOICES.map((v) => `voice:${v.id}`),
      ].map(async (key) => {
        if (this.bytes.has(key)) return;
        try {
          const r = await fetch(
            key.startsWith("anomaly:")
              ? `${import.meta.env.BASE_URL}${ANOMALY_VOICE_PATH}${key.slice(8)}.wav`
              : key.startsWith("voice:")
                ? `${import.meta.env.BASE_URL}${SOLDIER_PATH}${key.slice(6)}.wav`
                : (key !== "impact" && isImpact(key)
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
        this.context.onstatechange = () => {
          if (this.context?.state !== "running") {
            this.resetSpeech();
            this.controlVoice.stop();
          }
        };
        this.master = this.context.createGain();
        this.master.gain.value = this.effectsVolume;
        this.controlMaster = this.context.createGain();
        this.controlMaster.gain.value = this.controlOutputVolume;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.16;
        // Leave headroom for short transients before the compressor reacts.
        const headroom = this.context.createGain();
        headroom.gain.value = 0.6;
        this.controlMaster.connect(compressor);
        this.master
          .connect(compressor)
          .connect(headroom)
          .connect(this.context.destination);
      }
      if (this.context.state !== "running") {
        this.resetSpeech();
        void this.context.resume().catch(() => {});
      }
      void this.load();
    } catch {
      /* Gameplay also works where Web Audio is unavailable. */
    }
  }
  async load(): Promise<void> {
    if (!this.context) return;
    if (this.decoding) {
      // 展開中に追加された声（パックから読んだ台詞など）も、待たせた側で展開する。
      await this.decoding;
      if ([...this.bytes.keys()].every((key) => this.buffers.has(key))) return;
      return this.load();
    }
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
  /** 管制AIの声を切り替えて端末に保存する。読み込みは prepareControlVoice で行う。 */
  setControlVoice(voice: ControlVoiceId) {
    // 保存先がなくても、この起動中は選んだ声を使う。
    saveControlVoice(voice);
    if (this.controlVoice.voice === voice) return;
    this.controlVoice.stop();
    this.controlVoice.voice = voice;
  }
  /**
   * 指定した台詞だけを、選択中の声で展開する（起動時の一括読み込みには載せない）。
   * 音声は設定でダウンロードした声のパックから引く。通信はしない。
   * 未ダウンロード・旧版・削除済みの声は読み込まれず、再生要求は "unavailable"（字幕だけ）になる。
   */
  async prepareControlVoice(ids: readonly string[]) {
    await Promise.all(
      ids.map(async (id) => {
        const line = controlVoiceLine(id);
        if (!line || !playableLine(line)) return;
        const path = controlVoicePath(line, this.controlVoice.voice),
          key = `control:${path}`;
        if (this.buffers.has(key) || this.bytes.has(key)) return;
        try {
          const bytes = await this.packs.clip(path);
          if (bytes) this.bytes.set(key, bytes);
        } catch {
          /* 読めない保存は無音のまま。字幕だけで進められる。 */
        }
      }),
    );
    await this.load();
  }
  private announced: string[] = [];
  /**
   * 読み込み済みの1本を鳴らす。key を渡すと同じ key では二度鳴らさない
   * （作戦キューと同じく、画面の再表示で同じ合図を繰り返さない）。
   */
  announce(id: string, key?: string) {
    if (key) {
      if (this.announced.includes(key)) return "duplicate" as const;
      this.announced.push(key);
      if (this.announced.length > 64) this.announced.shift();
    }
    return this.controlVoice.request(id);
  }
  /** 場面の採用分をまとめて準備する（戦闘の読み込み画面など）。 */
  prepareControlScene(scene: ControlVoiceScene) {
    return this.prepareControlVoice(controlVoiceIdsForScene(scene));
  }
  /**
   * 1本を準備して鳴らす。waitMs 以内に用意できなければ声は諦める（字幕は呼び出し側）。
   * 音声の終了や成否を進行条件にしないため、結果は参考情報としてだけ返す。
   */
  async say(id: string, waitMs = 1500) {
    const line = controlVoiceLine(id);
    if (!line || !playableLine(line)) return "disabled" as const;
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ready = await Promise.race([
      this.prepareControlVoice([id]).then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), waitMs);
      }),
    ]);
    clearTimeout(timer);
    if (!ready || performance.now() - started > waitMs)
      return "unavailable" as const;
    return this.controlVoice.request(id);
  }
  private startControl(path: string, onEnded: () => void) {
    const c = this.context,
      buffer = this.buffers.get(`control:${path}`);
    if (!c || !buffer || !this.controlMaster)
      throw Error("control voice not ready");
    // 発話は同時に1本: 管制AIが話し始めたら兵士の掛け声を止める。
    this.speech?.stop();
    this.speech = undefined;
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.95;
    source.connect(gain).connect(this.controlMaster);
    this.controlSources.add(source);
    source.onended = () => {
      this.controlSources.delete(source);
      source.disconnect();
      gain.disconnect();
      onEnded();
    };
    source.start();
    return () => {
      if (!this.controlSources.has(source)) return;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    };
  }
  stop(combatOnly = false) {
    this.resetSpeech();
    if (!combatOnly) this.controlVoice.stop();
    for (const voice of this.voices) {
      if (combatOnly && this.menuVoices.has(voice)) continue;
      voice.stop();
      this.voices.delete(voice);
      this.menuVoices.delete(voice);
    }
  }
  /** Cancel speech immediately; the next snapshot is only a new baseline. */
  resetSpeech() {
    this.speech?.stop();
    this.speech = undefined;
    for (const voice of this.anomalyVoices) {
      voice.stop();
      this.voices.delete(voice);
    }
    this.anomalyVoices.clear();
    this.soldier.suspend();
    this.anomaly.suspend();
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
      this.resetSpeech();
      this.announcer.suspend();
      return;
    }
    const p = w.players.find((p) => p.id === id);
    if (this.speechRun !== w.run || this.speechOwner !== id) {
      this.resetSpeech();
      this.speechRun = w.run;
      this.speechOwner = id;
    }
    if (
      !active ||
      !p ||
      p.hp <= 0 ||
      !p.connected ||
      this.context?.state !== "running"
    ) {
      this.resetSpeech();
    }
    const line = this.soldier.collect(
      w,
      id,
      active &&
        this.soldierVoiceEnabled &&
        !!p?.connected &&
        p.hp > 0 &&
        this.effectsVolume > 0 &&
        this.context?.state === "running" &&
        SOLDIER_VOICES.every((v) => this.buffers.has(`voice:${v.id}`)),
    );
    if (line) this.speak(line);
    for (const cue of this.announcer.collect(w, id, active))
      this.controlVoice.request(cue);
    this.controlVoice.tick();
    const calls = this.anomaly.collect(
      w,
      id,
      active && this.effectsVolume > 0 && this.context?.state === "running",
    );
    for (const cue of [...this.tracker.collect(w, active), ...calls]) {
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
  private speak(clip: SoldierClip) {
    const c = this.context,
      buffer = this.buffers.get(`voice:${clip}`);
    if (!c || !buffer || !this.master) return;
    // 管制AIの発話中は兵士の掛け声を重ねない。
    if (this.controlVoice.current) return;
    if (this.speech) {
      if (clip !== "warning") return;
      this.speech.stop();
    }
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.95;
    source.connect(gain).connect(this.master);
    this.speech = source;
    source.onended = () => {
      if (this.speech === source) this.speech = undefined;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  play(type: string, gain = 1, pan = 0, key = type, delay = 0) {
    const c = this.context;
    if (
      !c ||
      c.state !== "running" ||
      this.effectsVolume <= 0 ||
      document.hidden ||
      !(type in LEVELS)
    )
      return;
    const now = c.currentTime;
    const monster = type.startsWith("anomaly:");
    // Missing voice assets stay silent; never replace a vocal with a click.
    if (monster && !this.buffers.has(type)) return;
    if (monster && this.anomalyVoices.size >= 2) return;
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
    if (monster) this.anomalyVoices.add(source);
    if (["menu", "equip", "unequip"].includes(type))
      this.menuVoices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      this.anomalyVoices.delete(source);
      this.menuVoices.delete(source);
      source.disconnect();
      g.disconnect();
      stereo.disconnect();
    };
    source.start(now + delay);
  }
}
