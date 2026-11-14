import { stats } from "../shared/defs";
import type { Event, World } from "../shared/game";

/** これより遅い武器は1発ごとの間隔が十分に長く、均す必要がない。 */
const RAPID_INTERVAL = 0.4;
/** 均すために表示を遅らせる上限（秒）。超える分は間隔を詰めて追いつく。 */
const MAX_DELAY = 0.16;
/** 直前の射撃からこの倍率以上空いたら、別の連射として即時に表示する。 */
const STREAM_BREAK = 2.5;
const LIMIT = 512;

/**
 * 連射の「表示と音」の間隔だけを均す。権威側の射出数・時刻・ダメージには触れない。
 *
 * 権威側は50ms刻みで射撃を処理し、協力では100msごとにまとめて届くため、
 * 均等な連射でも届く時刻は 100/150ms や 100/200ms に揺れ、速い武器は2発が同時に届く。
 * ここでは届いたイベントを順番どおりに保持し、同じ射手の主射撃が武器の連射間隔より
 * 詰まって届いた分だけ表示を遅らせる。順番を保つので、後続の命中表示も射撃の後に出る。
 * 描画より先に次の戦況が届いても、未表示のイベントはここに残る。
 */
export class ShotPacer {
  private run = "";
  private ingested = 0;
  private queue: { event: Event; due: number }[] = [];
  private released = 0;
  private lastDue = new Map<string, number>();
  private out: Event[] = [];

  reset() {
    this.run = "";
    this.ingested = 0;
    this.queue.length = 0;
    this.released = 0;
    this.lastDue.clear();
    this.out.length = 0;
  }

  /** 新しく届いたイベントを取り込む。`now` は秒。同じイベントは二重に取り込まない。 */
  ingest(w: World, now: number) {
    if (w.run !== this.run) {
      this.reset();
      this.run = w.run;
    }
    for (const event of w.events) {
      if (event.id <= this.ingested) continue;
      this.ingested = event.id;
      let due = 0;
      const interval = this.interval(w, event);
      if (interval && event.owner) {
        const last = this.lastDue.get(event.owner);
        due =
          last !== undefined && now - last < interval * STREAM_BREAK
            ? Math.min(Math.max(now, last + interval), now + MAX_DELAY)
            : now;
        this.lastDue.set(event.owner, due);
      }
      this.queue.push({ event, due });
    }
    if (this.queue.length > LIMIT) {
      // 消費が止まっている（描画停止など）。古い演出から捨て、判定には影響しない。
      const drop = this.queue.length - LIMIT;
      this.queue.splice(0, drop);
      this.released = Math.max(0, this.released - drop);
    }
  }

  /** 均す対象は、兵士本人の速い主射撃だけ。追加効果・敵・遅い武器は対象外。 */
  private interval(w: World, event: Event) {
    if (
      event.type !== "shot" ||
      !event.owner ||
      event.owner === "enemy" ||
      event.frontEffect ||
      event.buddyEffect
    )
      return 0;
    const p = w.players.find((p) => p.id === event.owner);
    const weapon = p?.weapons[p.slot];
    if (!weapon) return 0;
    const { interval, pellets } = stats(weapon);
    // 散弾は1回の射撃で複数のイベントを出す。同時に出すものを分けない。
    return pellets === 1 && interval > 0 && interval < RAPID_INTERVAL
      ? interval
      : 0;
  }

  /**
   * 今の時刻までに表示してよいイベント。`consumed` 以下（描画と音の両方が
   * 取り込み済み）は捨てる。返す配列は次の呼び出しまで有効。
   */
  present(now: number, consumed: number) {
    let drop = 0;
    while (drop < this.queue.length && this.queue[drop].event.id <= consumed)
      drop++;
    if (drop) {
      this.queue.splice(0, drop);
      this.released = Math.max(0, this.released - drop);
    }
    while (
      this.released < this.queue.length &&
      this.queue[this.released].due <= now
    )
      this.released++;
    this.out.length = 0;
    for (let i = 0; i < this.released; i++) this.out.push(this.queue[i].event);
    return this.out;
  }
}

/** 描画と音にだけ均した順番のイベントを見せ、戦況そのものは元へ戻す。 */
export function withPresentedEvents<T>(
  w: World,
  events: Event[],
  consume: () => T,
): T {
  const actual = w.events;
  w.events = events;
  try {
    return consume();
  } finally {
    w.events = actual;
  }
}
