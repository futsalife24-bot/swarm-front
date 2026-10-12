import { WEAPONS, stats, type Kind } from "../shared/defs";
import { weaponGrade } from "../shared/progression";
import {
  weaponLevel,
  WEAPON_MOD_NAMES,
  type WeaponMod,
} from "../shared/weapon-growth";
import {
  conversionCost,
  modificationCost,
  convertWeapon,
  modifyWeapon,
} from "./weapon-workshop";
import {
  loadProgress,
  initializeProgress,
  persistProgress,
  type ProgressSave,
} from "./progression-save";
import { menuAssemble } from "./menu-effects";
import "./weapon-workshop.css";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function openWeaponWorkshop(
  root: HTMLElement,
  storage: StorageAccess,
  back: () => void,
  initialId?: string,
) {
  let save =
    loadProgress("normal", storage) ?? initializeProgress("normal", storage);
  let id = initialId ?? save.inventory[0]?.id;
  let target: Kind = "smg",
    key: WeaponMod = "damage";
  let busy = false,
    notice = "武装片を使い、武器個体の基礎性能を恒久的に変更します。";
  function draw() {
    const w =
      save.inventory.find((item) => item.id === id) ?? save.inventory[0];
    if (!w) {
      back();
      return;
    }
    id = w.id;
    if (target === w.kind)
      target = (Object.keys(WEAPONS) as Kind[]).find((k) => k !== w.kind)!;
    let converted: ProgressSave | undefined,
      modified: ProgressSave | undefined,
      conversionError = "",
      modError = "";
    try {
      converted = convertWeapon(save, id, target);
    } catch (e) {
      conversionError = (e as Error).message;
    }
    try {
      modified = modifyWeapon(save, id, key);
    } catch (e) {
      modError = (e as Error).message;
    }
    const metrics = (next?: ProgressSave) => {
      const item = next?.inventory.find((item) => item.id === id) ?? w,
        d = stats(item);
      return `火力 ${d.damage.toFixed(1)} · 装填 ${d.mag}${"speed" in d ? ` · 弾速 ${Number(d.speed).toFixed(1)}m/s` : ""}`;
    };
    root.innerHTML = `<section class="panel menu-screen pt-screen weapon-workshop" aria-label="武器工房"><header class="menu-header"><h1>武器工房</h1><b>武装片 ${save.powder}</b><nav><button id="workshop-back">戻る</button></nav></header><label>対象武器<select id="workshop-weapon">${save.inventory.map((item) => `<option value="${esc(item.id)}" ${item.id === id ? "selected" : ""}>Lv${weaponLevel(item)} ${esc(WEAPONS[item.kind].name)} / ${weaponGrade(item)}</option>`).join("")}</select></label><p>Lv${weaponLevel(w)} / ${weaponGrade(w)} · ${metrics()} · 改造：${Object.entries(
      WEAPON_MOD_NAMES,
    )
      .map(([k, name]) => `${name} ${w.mods?.[k as WeaponMod] ?? 0}/10`)
      .join(
        "、",
      )}</p><div class="workshop-actions"><section><h2>同レベル変換</h2><label>別武器種<select id="workshop-kind">${(
      Object.keys(WEAPONS) as Kind[]
    )
      .filter((k) => k !== w.kind)
      .map(
        (k) =>
          `<option value="${k}" ${target === k ? "selected" : ""}>${esc(WEAPONS[k].name)}</option>`,
      )
      .join(
        "",
      )}</select></label><p>${metrics(converted)}</p><small>個体・レベル・品質・改造段階を維持。非対応の特殊効果は解除、弾速改造は休眠保存。</small><button id="workshop-convert" ${converted ? "" : "disabled"}>武装片 ${conversionCost(w)}で変換</button><p>${esc(conversionError)}</p></section><section><h2>性能を選んで改造</h2><label>性能<select id="workshop-mod">${Object.entries(
      WEAPON_MOD_NAMES,
    )
      .map(
        ([k, name]) =>
          `<option value="${k}" ${key === k ? "selected" : ""}>${name}${k === "speed" && !("speed" in WEAPONS[w.kind]) ? "（対象外）" : ""}</option>`,
      )
      .join(
        "",
      )}</select></label><p>${metrics(modified)}</p><small>火力・弾速は最大10段階、1段階+5%。装填数は約10%・最低1発ずつ、重ロケット3／ロケット4／擲弾系5／その他10段階。変換先の上限超過分は休眠保存。ラン内の強化・融合は持ち越しません。</small><button id="workshop-modify" ${modified ? "" : "disabled"}>武装片 ${modificationCost(w, key)}で改造</button><p>${esc(modError)}</p></section></div><p id="workshop-status" role="status">${esc(notice)}</p></section>`;
    const $ = (selector: string) =>
      root.querySelector<HTMLButtonElement>(selector)!;
    $("#workshop-back").onclick = back;
    $("#workshop-weapon").onchange = (e) => {
      id = (e.target as HTMLSelectElement).value;
      draw();
    };
    $("#workshop-kind").onchange = (e) => {
      target = (e.target as HTMLSelectElement).value as Kind;
      draw();
    };
    $("#workshop-mod").onchange = (e) => {
      key = (e.target as HTMLSelectElement).value as WeaponMod;
      draw();
    };
    const confirm = (candidate: ProgressSave, action: string) => {
      if (busy || root.querySelector("dialog")) return;
      const dialog = document.createElement("dialog");
      dialog.className = "workshop-confirm";
      const destination = candidate.inventory.find((item) => item.id === id)!;
      dialog.innerHTML = `<h2>${action}を確定</h2><p>${esc(WEAPONS[w.kind].name)} → ${esc(WEAPONS[destination.kind].name)} / Lv${weaponLevel(destination)}・${weaponGrade(destination)}</p><p>武装片 ${save.powder} → ${candidate.powder}</p><p>${metrics()} → ${metrics(candidate)}</p><button data-commit>確定して保存</button><button data-cancel>戻る</button><p role="status"></p>`;
      root.append(dialog);
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick =
        () => {
          dialog.close();
          dialog.remove();
        };
      let committed = false;
      dialog.querySelector<HTMLButtonElement>("[data-commit]")!.onclick =
        () => {
          if (committed || busy) return;
          busy = true;
          try {
            persistProgress(candidate, storage);
            committed = true;
            save = candidate;
            notice = `${action}を保存しました。`;
            dialog.close();
            dialog.remove();
            draw();
          } catch (e) {
            dialog.querySelector('[role="status"]')!.textContent = (
              e as Error
            ).message;
          } finally {
            busy = false;
          }
        };
      dialog.addEventListener("cancel", () => dialog.remove(), { once: true });
    };
    $("#workshop-convert").onclick = () => {
      if (converted) confirm(converted, "変換");
    };
    $("#workshop-modify").onclick = () => {
      if (modified) confirm(modified, "改造");
    };
    menuAssemble(root, root.querySelector(".workshop-actions"));
  }
  draw();
}
