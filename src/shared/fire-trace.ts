import type { Input, World } from "./game";

/**
 * 連射診断の1tick分。数値だけを持ち、戦闘の状態には書き込まない。
 * 操作内容は「射撃ボタンが有効だったか」だけを含み、照準や移動は含めない。
 */
export type FireTraceRow = [
  tick: number,
  /** 権威側の時計（ms）。サーバーはDate.now()、ソロは端末の時計。 */
  at: number,
  /** このtickで適用された入力番号。中立入力は0。 */
  seq: number,
  flags: number,
  /** このtickで生成された本人の主射撃イベント数。 */
  shots: number,
  /** その最初のイベントID。無ければ0。 */
  firstShot: number,
  /** tick後の射撃待ち時間（ms、負は次tickへの繰り越し）。 */
  coolMs: number,
  ammo: number,
  /** 適用した入力を受け取ってからの経過（ms）。入力が無ければ-1。 */
  ageMs: number,
];

export const FIRE_FLAG = {
  /** 適用された入力で射撃が有効。 */
  held: 1,
  /** 入力が失効期限を過ぎ、中立入力へ置き換えられた。 */
  expired: 2,
  /** 適用できる入力が無かった（選択中・再開猶予中に破棄された等）。 */
  missing: 4,
  reloading: 8,
  down: 16,
  swapping: 32,
  /** 戦闘が進行していない（カード選択・再開猶予など）。 */
  paused: 64,
} as const;

/** 射撃の本体だけを数える。カード効果・バディの追加射撃は含めない。 */
export function ownPrimaryShots(w: World, id: string, after: number) {
  const ids: number[] = [];
  for (const e of w.events)
    if (
      e.id > after &&
      e.type === "shot" &&
      e.owner === id &&
      !e.frontEffect &&
      !e.buddyEffect
    )
      ids.push(e.id);
  return ids;
}

/** stepの直後に呼ぶ。`eventFloor` はstep直前の `w.eventSerial`。 */
export function fireTraceRow(
  w: World,
  id: string,
  eventFloor: number,
  tick: number,
  at: number,
  applied: Input | undefined,
  ageMs: number,
  expired: boolean,
  paused: boolean,
): FireTraceRow | undefined {
  const p = w.players.find((p) => p.id === id);
  if (!p) return;
  const shots = ownPrimaryShots(w, id, eventFloor);
  return [
    tick,
    Math.round(at),
    applied?.seq ?? 0,
    (applied?.fire ? FIRE_FLAG.held : 0) |
      (expired ? FIRE_FLAG.expired : 0) |
      (applied ? 0 : FIRE_FLAG.missing) |
      (p.reload > 0 ? FIRE_FLAG.reloading : 0) |
      (p.hp <= 0 ? FIRE_FLAG.down : 0) |
      (p.swapCd > 0 ? FIRE_FLAG.swapping : 0) |
      (paused ? FIRE_FLAG.paused : 0),
    shots.length,
    shots[0] ?? 0,
    Math.round(p.cool * 10000) / 10,
    p.ammo[p.slot] ?? 0,
    applied && Number.isFinite(ageMs) ? Math.round(ageMs) : -1,
  ];
}
