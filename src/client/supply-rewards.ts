import { bank, validateProgress, type ProgressSave } from "./progression-save";
import {
  freshBuddyProgress,
  BUDDY_RECRUIT_RULES,
} from "../shared/buddy-progression";
import {
  validSupplyReceipt,
  supplyReceiptKey,
  type SupplyReceipt,
} from "../shared/supply-contract";

/** 保存済み受領IDで二重付与を防ぐ。呼出元が保存成功した後だけ表示・ACKする。 */
export function applySupplyReceipt(save: ProgressSave, receipt: SupplyReceipt) {
  if (!validSupplyReceipt(receipt))
    throw Error("補給の確定結果を確認できません");
  if (save.mode !== "normal")
    throw Error("補給は通常プレイの基地で行ってください");
  const key = supplyReceiptKey(receipt);
  if (save.receipts.includes(key)) return save;
  if (
    receipt.rewards.some((r) => r.type === "buddy") &&
    !save.buddies?.starterChosen
  )
    throw Error(
      "基地の「バディ」で初回バディを選択してから、補給を受領してください",
    );
  const next = structuredClone(save);
  for (const reward of receipt.rewards) {
    if (reward.type === "weapon") {
      bank(next, [structuredClone(reward.weapon)]);
      next.serial = Math.max(next.serial, reward.weapon.acquired + 1);
    } else if (reward.type === "shard") {
      next.powder += reward.amount;
      if (!Number.isSafeInteger(next.powder))
        throw Error("武装片の保存上限です");
    } else {
      const buddies = next.buddies ?? (next.buddies = freshBuddyProgress());
      if (buddies.owned[reward.buddyId]) {
        buddies.fragments += BUDDY_RECRUIT_RULES.duplicateFragments;
      } else {
        buddies.owned[reward.buddyId] = { xp: 0, breakthrough: 0 };
      }
    }
  }
  next.receipts.push(key);
  validateProgress(next);
  return next;
}
