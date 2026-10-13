import type { Enemy, World } from "../shared/game";

/** Original non-verbal vocal identities, shared by combat and the listening list. */
export const ANOMALY_VOICES = {
  harrow: {
    name: "HARROW",
    description: "掠れた喉鳴りから、低い唸りを重ねた鋭い咆哮。",
  },
  calyx: {
    name: "CALYX",
    description: "空洞の花弁が共鳴する、息を吸い込むような不気味な声。",
  },
  ant: {
    name: "HOUND / VOLLEY",
    description: "短い二連の吠え声に、乾いた骨の震えが混じる。",
  },
  spider: {
    name: "HOUND / LEAPER",
    description: "喉を絞った高めの唸りが、跳ねるようにせり上がる。",
  },
  crawler: {
    name: "PLEAT",
    description: "胸の奥から響く低い唸りと、襞が擦れるざらつき。",
  },
  spitter: {
    name: "PRISM",
    description: "複数の硬い面がずれて共鳴する、透き通った不協和音。",
  },
  hornet: {
    name: "RAY",
    description: "長く曲がる笛のような声に、電気的な震えが重なる。",
  },
  boss: {
    name: "FOUNDRY ZERO",
    description:
      "巨大な炉の奥が鳴る重低音と、金属の軋み。連結形態でも同じ声を使う。",
  },
} as const satisfies Record<
  Enemy["kind"],
  { name: string; description: string }
>;
export const ANOMALY_VOICE_PATH = "assets/audio/anomaly-voice-v1/";
export const ANOMALY_VOICE_KEYS = Object.keys(ANOMALY_VOICES).flatMap((kind) =>
  [0, 1].map((variant) => `anomaly:${kind}-${variant}`),
);
export interface AnomalyVoiceCue {
  type: string;
  x: number;
  z: number;
  key: string;
  owner?: string;
}
type Observation = { wind: number; attack: string; pulses: string };
function observe(e: Enemy): Observation {
  const attack =
    e.harrow &&
    [
      "Threat",
      "AirThreat",
      "Snipe",
      "Spin",
      "Dash",
      "BombPass",
      "Glide",
    ].includes(e.harrow.kind)
      ? `${e.harrow.kind}:${e.harrow.started}`
      : e.calyx
        ? `${e.calyx.kind}:${e.calyx.started}`
        : "";
  const pulses = [e, ...(e.segments ?? [])]
    .map((n) => (n.pulseAim && (n.partHp ?? e.hp) > 0 ? String(n.acidAt) : ""))
    .join("|");
  return { wind: e.wind, attack, pulses };
}

/** Observe snapshots even while muted. No replay after joining or resuming. */
export class AnomalyVoice {
  private run = "";
  private owner = "";
  private active = false;
  private previous = new Map<number, Observation>();
  private next = new Map<number, number>();
  private variants = new Map<number, number>();
  private globalNext = -Infinity;
  suspend() {
    this.active = false;
  }
  collect(w: World, owner: string, active: boolean): AnomalyVoiceCue[] {
    const fresh = this.run !== w.run || this.owner !== owner;
    if (fresh) {
      this.run = w.run;
      this.owner = owner;
      this.previous.clear();
      this.next.clear();
      this.variants.clear();
      this.globalNext = -Infinity;
    }
    const p = w.players.find((p) => p.id === owner);
    active &&= w.phase === "battle" && !!p?.connected && p.hp > 0;
    const audible = active && this.active && !fresh;
    const candidates: { enemy: Enemy; distance: number }[] = [];
    const live = new Set<number>();
    for (const e of w.enemies) {
      live.add(e.id);
      const prev = this.previous.get(e.id),
        now = observe(e);
      this.previous.set(e.id, now);
      if (!audible || !prev || e.hp <= 0 || e.active === false || !p) continue;
      const began =
        (now.attack && now.attack !== prev.attack) ||
        (!e.harrow && !e.calyx && now.wind > 0 && prev.wind <= 0) ||
        (e.segments &&
          now.pulses !== prev.pulses &&
          now.pulses
            .split("|")
            .some((v, i) => v && v !== prev.pulses.split("|")[i]));
      if (!began || w.time < (this.next.get(e.id) ?? -Infinity)) continue;
      // Consume the opportunity, including distant/overlapping calls: never queue.
      this.next.set(e.id, w.time + 2.2);
      const distance = Math.hypot(e.x - p.x, e.z - p.z);
      if (distance <= 55) candidates.push({ enemy: e, distance });
    }
    for (const id of this.previous.keys())
      if (!live.has(id)) {
        this.previous.delete(id);
        this.next.delete(id);
        this.variants.delete(id);
      }
    this.active = active;
    if (!candidates.length || w.time < this.globalNext) return [];
    candidates.sort(
      (a, b) => a.distance - b.distance || a.enemy.id - b.enemy.id,
    );
    const e = candidates[0].enemy,
      variant = this.variants.get(e.id) ?? e.id % 2;
    this.variants.set(e.id, 1 - variant);
    this.globalNext = w.time + 0.65;
    return [
      {
        type: `anomaly:${e.kind}-${variant}`,
        x: e.x,
        z: e.z,
        key: `anomaly:${e.id}`,
      },
    ];
  }
}
