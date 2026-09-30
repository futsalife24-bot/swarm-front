import type { World } from "../shared/game";
import { maxHp } from "../shared/solo-progression";

export const SOLDIER_VOICES = [
  { id: "reload", label: "装填中！" },
  { id: "reload-alt", label: "リロード！" },
  { id: "empty", label: "くっ、弾切れだ！" },
  { id: "cover", label: "援護する！" },
  { id: "warning", label: "大型接近！" },
  { id: "wave", label: "次が来るぞ！" },
  { id: "wave-alt", label: "よし、迎え撃つ！" },
  { id: "hurt", label: "ぐっ！" },
  { id: "hurt-alt-v2", label: "ちっ、やるな！" },
  { id: "fire", label: "くらえっ！" },
  { id: "fire-alt", label: "押し返すぞ！" },
  { id: "dodge", label: "ほっ！" },
  { id: "rescued", label: "ありがとう！" },
  { id: "rescued-alt", label: "助かったよ！" },
  { id: "danger", label: "まだやれる！" },
  { id: "danger-alt", label: "まずいな……！" },
  { id: "start", label: "よし、行こう！" },
] as const;
export type SoldierClip = (typeof SOLDIER_VOICES)[number]["id"];
export const SOLDIER_PATH = "assets/audio/voice-fenrir-v1/";

/** Local presentation only. Observe even while muted so old lines never queue. */
export class SoldierVoice {
  private run = "";
  private owner = "";
  private event = 0;
  private previous?: {
    slot: number;
    reload: number;
    hp: number;
    wave: number;
    evade: number;
  };
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
  private lastRescued?: SoldierClip;
  private lastDanger?: SoldierClip;
  private nextDodge = -Infinity;
  private nextDanger = -Infinity;
  private dangerArmed = false;
  private startConsumed = false;
  constructor(private random = Math.random) {}

  /** Rebaseline after interruptions without erasing same-run rate limits. */
  suspend() {
    this.active = false;
  }

  collect(
    w: World,
    id: string,
    active: boolean,
    battleStart = false,
  ): SoldierClip | undefined {
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
      this.lastRescued = this.lastDanger = undefined;
      this.nextDodge = this.nextDanger = -Infinity;
      this.dangerArmed = false;
      this.startConsumed = false;
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
    const rescuedEvent = w.events.some(
      (e) => e.id > this.event && e.type === "revive" && e.owner === id,
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
    const dodge =
      observing && prev.evade <= 0 && p.evade > 0 && w.time >= this.nextDodge;
    const ratio = p ? p.hp / maxHp(w) : 0;
    // Rebaseline low HP without manufacturing a crossing on resume/load.
    if (fresh || resumed || !active) this.dangerArmed = ratio > 0.4;
    if (ratio > 0.4) this.dangerArmed = true;
    const dangerCrossing = observing && this.dangerArmed && ratio <= 0.25;
    const danger = dangerCrossing && w.time >= this.nextDanger;
    if (ratio <= 0.25) this.dangerArmed = false;
    const rescued =
      !fresh &&
      !resumed &&
      active &&
      w.phase === "battle" &&
      !!p?.connected &&
      !!prev &&
      prev.hp <= 0 &&
      p.hp > 0 &&
      rescuedEvent;
    const starting = battleStart && !this.startConsumed;
    if (battleStart) this.startConsumed = true;
    // Consume opportunities even while another line is cooling down: no backlog.
    if (hurt) this.nextHurt = w.time + 4;
    if (fire) this.nextFire = w.time + 12;
    if (dodge) this.nextDodge = w.time + 6;
    if (danger) this.nextDanger = w.time + 30;
    this.active = active;
    this.previous = p
      ? {
          slot: p.slot,
          reload: p.reload,
          hp: p.hp,
          wave: w.wave,
          evade: p.evade,
        }
      : undefined;
    this.near = near;
    // Only an explicit, genuine sortie may voice its initial state. Consume
    // even muted/unloaded attempts; never defer a greeting until audio loads.
    if (
      starting &&
      active &&
      w.phase === "battle" &&
      p?.connected &&
      p.hp > 0
    ) {
      if (this.random() >= 0.35) return;
      this.next = w.time + 6;
      return "start";
    }
    if (
      fresh ||
      resumed ||
      !active ||
      w.phase !== "battle" ||
      !p ||
      !prev ||
      p.hp <= 0 ||
      (prev.hp <= 0 && !rescued) ||
      !p.connected ||
      w.time < this.next
    )
      return;

    let clip: SoldierClip | undefined;
    if (approaching) clip = "warning";
    else if (rescued) {
      if (this.random() >= 0.8) return;
      clip =
        this.lastRescued === "rescued"
          ? "rescued-alt"
          : this.lastRescued === "rescued-alt"
            ? "rescued"
            : this.random() < 0.5
              ? "rescued"
              : "rescued-alt";
      this.lastRescued = clip;
    } else if (dangerCrossing) {
      // Do not fall through to a hurt line when the low-HP lottery is silent.
      if (!danger || this.random() >= 0.25) return;
      clip =
        this.lastDanger === "danger"
          ? "danger-alt"
          : this.lastDanger === "danger-alt"
            ? "danger"
            : this.random() < 0.5
              ? "danger"
              : "danger-alt";
      this.lastDanger = clip;
    } else if (prev.wave > 0 && w.wave > prev.wave) {
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
    } else if (dodge) {
      if (this.random() >= 0.25) return;
      clip = "dodge";
    } else if (hurt) {
      if (this.random() >= 0.3) return;
      clip = this.random() < 0.75 ? "hurt" : "hurt-alt-v2";
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
