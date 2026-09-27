import type { World } from "../shared/game";

export const SOLDIER_VOICES = [
  { id: "reload", label: "装填中！" },
  { id: "reload-alt", label: "リロード！" },
  { id: "empty", label: "くっ、弾切れだ！" },
  { id: "cover", label: "援護する！" },
  { id: "warning", label: "大型接近！" },
  { id: "wave", label: "次が来るぞ！" },
  { id: "wave-alt", label: "よし、迎え撃つ！" },
  { id: "hurt", label: "ぐっ！" },
  { id: "hurt-alt", label: "ちっ、やるな！" },
  { id: "fire", label: "くらえっ！" },
  { id: "fire-alt", label: "押し返すぞ！" },
] as const;
export type SoldierClip = (typeof SOLDIER_VOICES)[number]["id"];
export const SOLDIER_PATH = "assets/audio/voice-fenrir-v1/";

/** Local presentation only. Observe even while muted so old lines never queue. */
export class SoldierVoice {
  private run = "";
  private owner = "";
  private event = 0;
  private previous?: { slot: number; reload: number; hp: number; wave: number };
  private near = new Set<number>();
  private active = false;
  private next = -Infinity;
  private nextCover = -Infinity;
  private nextHurt = -Infinity;
  private nextFire = -Infinity;
  private lastShot = -Infinity;
  private lastWave?: SoldierClip;
  private lastFire?: SoldierClip;
  private lastReload?: SoldierClip;
  constructor(private random = Math.random) {}

  /** Rebaseline after interruptions without erasing same-run rate limits. */
  suspend() {
    this.active = false;
  }

  collect(w: World, id: string, active: boolean): SoldierClip | undefined {
    const fresh = this.run !== w.run || this.owner !== id;
    if (fresh) {
      this.run = w.run;
      this.owner = id;
      this.event = 0;
      this.previous = undefined;
      this.near.clear();
      this.next = this.nextCover = -Infinity;
      this.nextHurt = this.nextFire = this.lastShot = -Infinity;
      this.lastWave = this.lastFire = undefined;
      this.lastReload = undefined;
    }
    const p = w.players.find((v) => v.id === id);
    const near = new Set(
      p
        ? w.enemies
            .filter(
              (e) =>
                e.hp > 0 &&
                e.active !== false &&
                ["boss", "harrow", "calyx"].includes(e.kind) &&
                Math.hypot(e.x - p.x, e.z - p.z) <= 55,
            )
            .map((e) => e.id)
        : [],
    );
    const approaching = [...near].some((enemy) => !this.near.has(enemy));
    const shot = w.events.some(
      (e) => e.id > this.event && e.type === "shot" && e.owner === id,
    );
    for (const e of w.events) this.event = Math.max(this.event, e.id);
    const prev = this.previous;
    const resumed = !this.active;
    const observing =
      !fresh &&
      !resumed &&
      active &&
      w.phase === "battle" &&
      !!p &&
      !!prev &&
      p.hp > 0 &&
      prev.hp > 0 &&
      p.connected;
    const firingStarted = shot && w.time - this.lastShot >= 2;
    if (shot || fresh || resumed || !active) this.lastShot = w.time;
    const hurt = observing && p.hp < prev.hp && w.time >= this.nextHurt;
    const fire = observing && firingStarted && w.time >= this.nextFire;
    // Consume opportunities even while another line is cooling down: no backlog.
    if (hurt) this.nextHurt = w.time + 4;
    if (fire) this.nextFire = w.time + 12;
    this.active = active;
    this.previous = p
      ? { slot: p.slot, reload: p.reload, hp: p.hp, wave: w.wave }
      : undefined;
    this.near = near;
    if (
      fresh ||
      resumed ||
      !active ||
      w.phase !== "battle" ||
      !p ||
      !prev ||
      p.hp <= 0 ||
      prev.hp <= 0 ||
      !p.connected ||
      w.time < this.next
    )
      return;

    let clip: SoldierClip | undefined;
    if (approaching) clip = "warning";
    else if (prev.wave > 0 && w.wave > prev.wave) {
      if (this.random() >= 0.25) return;
      clip =
        this.lastWave === "wave"
          ? "wave-alt"
          : this.lastWave === "wave-alt"
            ? "wave"
            : this.random() < 0.5
              ? "wave"
              : "wave-alt";
      this.lastWave = clip;
    } else if (hurt) {
      if (this.random() >= 0.3) return;
      clip = this.random() < 0.75 ? "hurt" : "hurt-alt";
    } else if (p.slot === prev.slot && prev.reload <= 0 && p.reload > 0) {
      if (this.random() >= 0.6) return;
      const choices: SoldierClip[] = ["reload", "reload-alt"];
      if (p.ammo[p.slot] === 0) choices.push("empty");
      const eligible = choices.filter((v) => v !== this.lastReload);
      clip = eligible[Math.floor(this.random() * eligible.length)];
      this.lastReload = clip;
    } else if (
      shot &&
      w.time >= this.nextCover &&
      w.players.some(
        (ally) =>
          ally.id !== id &&
          ally.connected &&
          ally.hp <= 0 &&
          Math.hypot(ally.x - p.x, ally.z - p.z) <= 20,
      )
    ) {
      // One opportunity per 20 seconds, rather than a lottery on every bullet.
      this.nextCover = w.time + 20;
      if (this.random() < 0.35) clip = "cover";
    } else if (fire) {
      if (this.random() >= 0.15) return;
      clip =
        this.lastFire === "fire"
          ? "fire-alt"
          : this.lastFire === "fire-alt"
            ? "fire"
            : this.random() < 0.5
              ? "fire"
              : "fire-alt";
      this.lastFire = clip;
    }
    if (clip) this.next = w.time + (clip === "warning" ? 10 : 6);
    return clip;
  }
}
