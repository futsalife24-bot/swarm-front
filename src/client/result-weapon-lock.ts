import { loadProgress, persistProgress } from "./progression-save";

type StorageAccess = Pick<Storage, "getItem" | "setItem">;

/** 最新保存を読み、表示時の状態と一致する所持武器だけを変更する。 */
export function setResultWeaponLock(
  storage: StorageAccess,
  id: string,
  expected: boolean,
) {
  const save = loadProgress("normal", storage);
  if (!save || ![...save.inventory, ...save.pending].some((w) => w.id === id))
    throw new Error(
      "この武器の保存を確認できません。保存状態を確認してください。",
    );
  if (save.locks.includes(id) !== expected)
    throw new Error("ロック状態が更新されました。画面を開き直してください。");
  save.locks = expected
    ? save.locks.filter((x) => x !== id)
    : [...save.locks, id];
  persistProgress(save, storage);
  return save;
}
