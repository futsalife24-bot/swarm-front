const DAY = 86_400_000;
const JST = 9 * 60 * 60 * 1000;

/** Server timestamps are authoritative for daily admission and weekly rewards. */
export function japanDay(now: number) {
  if (!Number.isFinite(now) || now < 0) throw Error("日付が不正です");
  return new Date(now + JST).toISOString().slice(0, 10);
}
export function japanWeek(now: number) {
  const date = new Date(now + JST);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  return japanDay(now - daysFromMonday * DAY);
}
export function nextJapanDay(now: number) {
  return (Math.floor((now + JST) / DAY) + 1) * DAY - JST;
}
