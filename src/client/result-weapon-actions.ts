import type { StoredWeapon } from "../shared/progression";
import { loadProgress } from "./progression-save";
import { openWeaponDetail } from "./weapon-detail";
import { menuDialog } from "./menu-ui";
import { bindRewardWeaponDetails } from "./reward-weapon-details";

import { setResultWeaponLock } from "./result-weapon-lock";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export function bindResultWeaponActions(
  root: HTMLElement,
  weapons: readonly StoredWeapon[],
  storage: StorageAccess,
  redraw: () => void,
) {
  let active = true;
  const dialogs = new Set<HTMLDialogElement>();
  const showDetail = (id: string) => {
    if (!active || !root.isConnected) return;
    const supplied = weapons.find((w) => w.id === id);
    if (!supplied) return;
    const save = loadProgress("normal", storage);
    const owned = [...(save?.inventory ?? []), ...(save?.pending ?? [])].find(
      (w) => w.id === id,
    );
    const expected = save?.locks.includes(id) ?? false;
    const dialog = openWeaponDetail(owned ?? supplied, {
      locked: expected,
      lockDisabled: !owned,
      note: owned ? undefined : "未保存のためロックできません。",
      onLock: () => {
        if (!active) throw new Error("結果画面が切り替わりました。");
        setResultWeaponLock(storage, id, expected);
        dialog.close();
        redraw();
      },
    });
    dialogs.add(dialog);
    dialog.addEventListener("close", () => dialogs.delete(dialog), {
      once: true,
    });
  };
  const open = (id: string) => {
    try {
      showDetail(id);
    } catch {
      menuDialog(
        "保存を確認できません",
        "<p>保存データを保持しました。画面を開き直してください。</p>",
      );
    }
  };
  root
    .querySelectorAll<HTMLButtonElement>("[data-detail]")
    .forEach((button) => {
      button.onclick = () => open(button.dataset.detail!);
    });
  root.querySelectorAll<HTMLButtonElement>("[data-lock]").forEach((button) => {
    const expected = button.getAttribute("aria-pressed") === "true";
    button.onclick = () => {
      if (!active || button.disabled || !button.isConnected) return;
      button.disabled = true;
      try {
        setResultWeaponLock(storage, button.dataset.lock!, expected);
        redraw();
      } catch {
        button.disabled = false;
        menuDialog(
          "ロックを保存できません",
          "<p>保存状態が変わったか、保存に失敗しました。画面を開き直して再確認してください。</p>",
        );
      }
    };
  });
  const releaseHold = bindRewardWeaponDetails(root, open);
  return () => {
    active = false;
    releaseHold();
    dialogs.forEach((d) => d.close());
    dialogs.clear();
  };
}
