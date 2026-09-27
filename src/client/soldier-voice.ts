import type { World } from "../shared/game";

export const SOLDIER_VOICES = [
  { id: "reload", label: "装填中！" },
  { id: "reload-alt", label: "リロード！" },
  { id: "empty", label: "くっ、弾切れだ！" },
  { id: "cover", label: "援護する！" },
  { id: "warning", label: "大型接近！" },
] as const;
export type SoldierClip = (typeof SOLDIER_VOICES)[number]["id"];
export const SOLDIER_PATH = "assets/audio/voice-fenrir-v1/";

/** Local presentation only. Observe even while muted so old lines never queue. */
export class SoldierVoice {
  private run = "";
  private owner = "";
  private event = 0;
  private previous?: { slot: number; reload: number; hp: number };
  private near = new Set<number>();
  private active = false;
  private next = -Infinity;
  private nextCover = -Infinity;
  private lastReload?: SoldierClip;
  constructor(private random = Math.random) {}

  collect(w: World, id: string, active: boolean): SoldierClip | undefined {
    const fresh = this.run !== w.run || this.owner !== id;
    if (fresh) {
      this.run = w.run;
      this.owner = id;
      this.event = 0;
      this.previous = undefined;
      this.near.clear();
      this.next = this.nextCover = -Infinity;
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
    this.active = active;
    this.previous = p
      ? { slot: p.slot, reload: p.reload, hp: p.hp }
      : undefined;
    this.near = near;
    if (
      fresh ||
      resumed ||
      !active ||
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
    else if (p.slot === prev.slot && prev.reload <= 0 && p.reload > 0) {
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
    }
    if (clip) this.next = w.time + (clip === "warning" ? 10 : 6);
    return clip;
  }
}
