import type { Enemy, World } from "../shared/game";
import {
  ENEMY_REPORT_NAMES,
  type ReportlessEnemyKind,
} from "../shared/enemy-identity";

/** Original non-verbal vocal identities, shared by combat and the listening list. */
export const ANOMALY_VOICES = {
  harrow: {
    name: "HARROW",
    description: "割れた喉の咆哮。短い喉鳴りの後、一息で吼えて途切れる。",
  },
  calyx: {
    name: "CALYX",
    description: "空洞へ吸い込む息が膨らみ、口を閉じるように急に止まる。",
  },
  ant: {
    name: "HOUND / VOLLEY",
    description: "乾いた短い二連吠え。二声の間に明確な間を置く。",
  },
  spider: {
    name: "HOUND / LEAPER",
    description: "細い鳴き声が三連から加速し、短い擦れ声で終わる。",
  },
  crawler: {
    name: "PLEAT",
    description: "襞を引きずる湿った擦れ。喉の奥の不規則な脈動を伴う。",
  },
  spitter: {
    name: "PRISM",
    description:
      "殻が擦れて裂けるような声。ざらついた響きが不規則にせり上がり、砕けて止まる。",
  },
  hornet: {
    name: "RAY",
    description: "鋭い息が断続的に震え、後半で細い笛声へ収束する。",
  },
  boss: {
    name: ENEMY_REPORT_NAMES.boss,
    description: "低い殻鳴りの後、重い金属がたわむ長い軋みが残る。",
  },
} as const satisfies Record<
  Exclude<Enemy["kind"], ReportlessEnemyKind>,
  { name: string; description: string }
>;
export const ANOMALY_VOICE_PROFILES = {
  ...ANOMALY_VOICES,
  "boss-linked": {
    name: `${ENEMY_REPORT_NAMES.worm}・連結中`,
    description:
      "複数の空洞が唸る、長く膨らむ重い息。異なる響きがうねり、底へ沈む。",
  },
  "boss-separated": {
    name: `${ENEMY_REPORT_NAMES.worm}・分離後`,
    description:
      "硬い顎を鳴らすような、荒い破裂声。ばらついた短い連声から擦れた叫びへ変わる。",
  },
} as const;
export function anomalyVoiceProfile(
  e: Enemy,
): keyof typeof ANOMALY_VOICE_PROFILES | undefined {
  // 声素材のないローカル候補は無音のまま（攻撃予兆は描画で伝える）。
  if (e.kind === "bastion") return undefined;
  return e.kind === "boss" && e.segments
    ? e.fractured
      ? "boss-separated"
      : "boss-linked"
    : e.kind;
}
export const ANOMALY_VOICE_PATH = "assets/audio/anomaly-voice-v3/";
export const ANOMALY_VOICE_KEYS = Object.keys(ANOMALY_VOICE_PROFILES).flatMap(
  (kind) => [0, 1].map((variant) => `anomaly:${kind}-${variant}`),
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
      if (
        !audible ||
        !prev ||
        e.hp <= 0 ||
        e.active === false ||
        !p ||
        !anomalyVoiceProfile(e)
      )
        continue;
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
        type: `anomaly:${anomalyVoiceProfile(e)}-${variant}`,
        x: e.x,
        z: e.z,
        key: `anomaly:${e.id}`,
      },
    ];
  }
}
