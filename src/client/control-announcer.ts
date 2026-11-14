import type { World } from "../shared/game";
import { stageFor } from "../shared/stages";

/**
 * 戦闘中の管制AIアナウンスを、World の変化から拾う（表示専用。戦闘ルールには触れない）。
 * 兵士ボイス（soldier-voice.ts）と同じく、中断・別の戦闘・非表示の間は基準を取り直し、
 * 古い出来事をあとからまとめて鳴らさない。
 * solo / multi の出し分けは再生キュー側のタグで行う（ally-down などは multi 専用）。
 */
const LARGE = new Set(["boss", "harrow", "calyx"]);
/** HUD の「HP · 危険」と同じ閾値。 */
export const HP_DANGER = 40;
const HP_DANGER_INTERVAL = 30,
  BOSS_INTERVAL = 15,
  BASE_INTERVAL = 20;

interface Snapshot {
  hp: number;
  allies: Map<string, number>;
  cleared: boolean;
  armory?: number;
}

export class ControlAnnouncer {
  private run = "";
  private owner = "";
  private previous?: Snapshot;
  private large = new Set<number>();
  private nextHp = -Infinity;
  private nextBoss = -Infinity;
  private nextBase = -Infinity;

  /** 中断のあとは基準を取り直す（同じ戦闘の間隔制限は残す）。 */
  suspend() {
    this.previous = undefined;
  }

  collect(w: World, id: string, active: boolean): string[] {
    if (this.run !== w.run || this.owner !== id) {
      this.run = w.run;
      this.owner = id;
      this.previous = undefined;
      this.large.clear();
      this.nextHp = this.nextBoss = this.nextBase = -Infinity;
    }
    const p = w.players.find((v) => v.id === id);
    const large = new Set(
      w.enemies
        .filter((e) => e.hp > 0 && e.active !== false && LARGE.has(e.kind))
        .map((e) => e.id),
    );
    const snapshot: Snapshot | undefined = p && {
      hp: p.hp,
      allies: new Map(
        w.players
          .filter((a) => a.id !== id && a.connected)
          .map((a) => [a.id, a.hp]),
      ),
      cleared:
        w.waveClearAt !== null || (w.solo?.waveCompleteAt ?? null) !== null,
      armory: w.defense?.armory.hp,
    };
    const prev = this.previous,
      newLarge = [...large].some((e) => !this.large.has(e));
    this.previous = snapshot;
    this.large = large;
    if (
      !active ||
      !prev ||
      !p ||
      !snapshot ||
      w.training ||
      w.phase !== "battle"
    ) {
      if (!active) this.previous = undefined;
      return [];
    }
    const lines: string[] = [];
    // 自分の状態（multi 専用の行はソロでは再生キューが捨てる）。
    if (prev.hp > 0 && p.hp <= 0 && p.down > 0) lines.push("self-down");
    else if (prev.hp <= 0 && p.hp > 0) lines.push("revived");
    else if (
      p.hp > 0 &&
      p.hp <= HP_DANGER &&
      prev.hp > HP_DANGER &&
      w.time >= this.nextHp
    ) {
      this.nextHp = w.time + HP_DANGER_INTERVAL;
      lines.push("hp-danger");
    }
    for (const [ally, hp] of snapshot.allies)
      if ((prev.allies.get(ally) ?? 0) > 0 && hp <= 0) {
        lines.push("ally-down");
        break;
      }
    if (newLarge && !w.front && w.time >= this.nextBoss) {
      this.nextBoss = w.time + BOSS_INTERVAL;
      lines.push("boss-detected");
    }
    if (
      snapshot.armory !== undefined &&
      prev.armory !== undefined &&
      snapshot.armory < prev.armory &&
      snapshot.armory > 0 &&
      w.time >= this.nextBase
    ) {
      this.nextBase = w.time + BASE_INTERVAL;
      lines.push("base-under-attack");
    }
    if (
      !prev.cleared &&
      snapshot.cleared &&
      !w.front &&
      !w.defense &&
      w.wave < stageFor(w).waves.length
    )
      lines.push("wave-clear");
    return lines;
  }
}
