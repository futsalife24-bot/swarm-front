import type { Effect, Kind } from "../shared/defs";
import { isSpecialEffect } from "../shared/defs";

const kinds: Record<Kind, [string, string]> = {
  rifle: [
    "ライフル",
    "連射で狙った敵を攻撃する、中距離向けの武器です。移動しながら継続して攻撃したい場面に向いています。",
  ],
  shotgun: [
    "ショットガン",
    "一度に8発の散弾を発射します。散弾1発ごとに射線上の敵を最大3体まで貫通する標準性能があります。建物は貫通しません。特殊効果の枠を使わず、残弾装填などと併用できます。近距離で多くの弾を当てると強力ですが、遠くでは弾が広がり、威力も低下します。表示威力の「×8」は散弾数です。",
  ],
  rocket: [
    "ロケット",
    "着弾地点の周囲を爆風で攻撃します。密集した敵に有効ですが、装弾数が少なく、装填の隙があります。建物に当たると、そこで爆発します。",
  ],
};
const effects: Record<Effect, [string, string, string]> = {
  repel: [
    "撃退散弾",
    "8m以内で命中した通常敵を最大3m押し戻します。1回の射撃につき各敵に1回だけ作用し、ボスや建物の向こうへは押し出せません。標準性能の貫通と併用できます。",
    "ショットガン",
  ],
  chain: [
    "誘爆弾頭",
    "直撃した通常敵をその爆風で倒すと、その敵の位置に半径3.5mの追加爆発が発生します。中心威力は武器威力の50%で、外側ほど低下します。壁で遮られ、追加爆発からの再誘爆はありません。壁・地面への着弾や、爆風だけで倒した敵、ボスの撃破では誘爆しません。",
    "ロケット",
  ],
  reserve: [
    "残弾装填",
    "リロード開始時の残弾割合に応じて、装填時間を短縮します。短縮率は残弾割合の半分（上限50%）。半分残っていれば25%短縮、空なら短縮なしです。満タンではリロードできません。性能欄の装填時間は、空から装填する場合の時間です。",
    "全武器",
  ],
  none: [
    "標準仕様",
    "特殊効果は付いていません。武器種の基本能力と、表示されている性能で攻撃します。",
    "全武器",
  ],
  pierce: [
    "貫通",
    "1発の弾が射線上の敵を最大3体まで貫通します。建物は貫通しません。",
    "アサルトライフル",
  ],
  quick: [
    "高速装填",
    "装填時間を20%短縮します。一覧と詳細の装填時間には、この短縮がすでに反映されています。",
    "全武器",
  ],
};
export function kindSummary(kind: Kind | "all") {
  return {
    all: "ライフルは中距離・連射、ショットガンは近距離・散弾貫通、ロケットは爆風で範囲攻撃。",
    rifle:
      "中距離向け。連射で狙った敵を攻撃し、移動しながら継続して攻撃できます。",
    shotgun:
      "近距離向け。8発の散弾が各最大3体を貫通。遠距離では拡散・威力低下。建物は貫通しません。",
    rocket:
      "着弾地点を爆風で範囲攻撃。密集した敵に有効ですが、装弾数が少なく装填に隙があります。",
  }[kind];
}
export function kindHelp(kind: Kind) {
  return `<button type="button" class="weapon-help-button kind-help" data-kind-help="${kind}" aria-label="${kinds[kind][0]}の説明" aria-haspopup="dialog">?</button>`;
}
export function effectHelp(effect: Effect, kind: Kind, compact = false) {
  if (!isSpecialEffect(effect, kind))
    return '<span class="standard-effect" data-no-effect>ー</span>';
  const label =
    compact && effect === "reserve" ? "残数装填" : effectText(effect, kind);
  return `<button type="button" class="weapon-help-button effect-help" data-effect-help="${effect}" aria-label="${label}の説明" aria-haspopup="dialog">${label}${compact ? "" : '<span aria-hidden="true"> ⓘ</span>'}</button>`;
}

export function effectText(effect: Effect, kind: Kind) {
  if (!isSpecialEffect(effect, kind)) return "ー";
  if (effect === "pierce") return "貫通×3";
  return effects[effect][0];
}

// Capture before row selection handlers: help never equips or selects a weapon.
document.addEventListener(
  "click",
  (event) => {
    if ((event.target as Element).closest("[data-no-effect]")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const trigger = (event.target as Element).closest<HTMLButtonElement>(
      "[data-kind-help], [data-effect-help]",
    );
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const entry = trigger.dataset.kindHelp
      ? kinds[trigger.dataset.kindHelp as Kind]
      : effects[trigger.dataset.effectHelp as Effect];
    if (!entry) return;
    const dialog = document.createElement("dialog");
    dialog.className = "weapon-help-dialog";
    dialog.setAttribute("aria-labelledby", "weapon-help-title");
    dialog.setAttribute("aria-describedby", "weapon-help-body");
    const title = document.createElement("h2");
    title.id = "weapon-help-title";
    title.textContent = entry[0];
    if (trigger.dataset.effectHelp) {
      const target = document.createElement("small");
      target.className = "weapon-help-target";
      target.textContent = `（対象武器：${effects[trigger.dataset.effectHelp as Effect][2]}）`;
      title.append(target);
    }
    const body = document.createElement("p");
    body.id = "weapon-help-body";
    body.textContent = entry[1];
    const close = document.createElement("button");
    close.textContent = "閉じる";
    close.onclick = () => dialog.close();
    dialog.append(title, body, close);
    dialog.addEventListener("click", (e) => {
      const box = dialog.getBoundingClientRect();
      if (
        e.target === dialog &&
        (e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom)
      )
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (trigger.isConnected) trigger.focus();
    });
    document.body.append(dialog);
    dialog.showModal();
  },
  true,
);
document.addEventListener(
  "keydown",
  (event) => {
    if (
      (event.target as Element).closest?.(
        "[data-kind-help], [data-effect-help]",
      ) &&
      (event.key === "Enter" || event.key === " ")
    )
      event.stopPropagation();
  },
  true,
);
