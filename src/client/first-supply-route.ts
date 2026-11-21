/** C-6 F7: 初回10連のACK後にだけ出す出撃準備の1行。 */
export const FIRST_SUPPLY_GEAR_NOTICE =
  "入手した武器は一覧タップで装備できます";

/**
 * 遷移はF6の初回ルート・10連・ACK成功の3条件が揃ったときだけ。
 * 受領保存前や通信断の再開フローには触れない。
 */
export function shouldAdvanceAfterFirstSupply(
  firstTime: boolean,
  count: 1 | 10,
  acknowledged: boolean,
): boolean {
  return acknowledged && firstTime && count === 10;
}
