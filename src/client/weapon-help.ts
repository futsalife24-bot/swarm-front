import type { Effect, Family, Kind } from "../shared/defs";
import { familyOf, isSpecialEffect } from "../shared/defs";

const kinds: Record<Kind, [string, string]> = {
  rifle: [
    "ライフル",
    "連射で狙った敵を攻撃する、中距離向けの武器です。移動しながら継続して攻撃したい場面に向いています。",
  ],
  smg: [
    "SMG",
    "ライフル系統の近距離型です。連射がさらに速く装弾数も多い一方、1発の威力が低く、拡散が広く、12mを超えると威力が落ち始めます。距離を詰めて撃ち続ける戦い方に向いています。",
  ],
  shotgun: [
    "ショットガン",
    "一度に8発の散弾を発射します。散弾1発ごとに射線上の敵を最大3体まで貫通する標準性能があります。建物は貫通しません。特殊効果の枠を使わず、残弾装填などと併用できます。近距離で多くの弾を当てると強力ですが、遠くでは弾が広がり、威力も低下します。表示威力の「×8」は散弾数です。",
  ],
  slug: [
    "スラッグ",
    "ショットガン系統の単発型です。散弾ではなく1発の重い弾を撃ち出し、射程45mまで届きます。ショットガン標準の最大3体貫通はそのまま残るため、並んだ敵を一直線に撃ち抜けます。威力の距離減衰はライフルと同じ緩やかな曲線です。",
  ],
  rocket: [
    "ロケット",
    "着弾地点の周囲を爆風で攻撃します。密集した敵に有効ですが、装弾数が少なく、装填の隙があります。建物に当たると、そこで爆発します。",
  ],
  heavy: [
    "重ロケット",
    "ロケット系統の単発特化型です。爆風半径11mと非常に大きく、1発の威力も最大ですが、装弾数1発ごとに長い装填が入り、弾速も遅めです。ボスや密集した群れに対して、当てる機会を選んで撃つ武器です。",
  ],
  sniper: [
    "スナイパー",
    "射程140mの長距離狙撃銃です。拡散がなく、距離による威力減衰もありません。スコープボタンで拡大でき、拡大中は視点の感度が半分になります。遠くの敵を正確に撃ち抜く武器で、接近されると連射の遅さが弱点になります。",
  ],
  grenade: [
    "グレネード",
    "山なりの弾道で榴弾を撃ち出し、着弾地点を爆風で攻撃します。重力で落ちるため、遠くを狙うほど上向きに撃つ必要があります。障害物の向こう側へ撃ち込めるのが最大の特徴です。装填は速く、連射も利きます。",
  ],
  sticky: [
    "粘着グレネード",
    "グレネード系統の高威力型です。より強く落ちる重い弾で、1発の威力と引き換えに射程と装弾数が下がります。近〜中距離の足元へ撃ち込む使い方に向いています。",
  ],
  laser: [
    "レーザー",
    "スナイパー系統のもう一つの選び方です。極めて短い間隔で照射し続ける連続ビームで、射程95m、拡散も距離減衰もありません。1発の威力は小さい代わりに、標準で射線上の敵を最大3体まで貫通します。狙撃銃が遠くの1体を一撃で仕留めるのに対し、こちらは一直線に迫ってくる列をまとめて薙ぎ払う武器です。当て続ける必要があるためスコープの拡大は控えめです。装弾数は熱容量にあたり、撃ち切ると冷却のため長い装填が入ります。",
  ],
  kick: [
    "反動射出器",
    "至近距離へ散弾を撃ち込むと同時に、その反動で自分を後方へ大きく飛ばします。囲まれた場所から抜ける、崖や段差を跳び越える、距離を取り直す、といった移動の道具として使えます。壁の向こうへは飛べません。特殊効果「撃退散弾」を付けると、押し返しと自分の離脱を同時に行えます。",
  ],
  medic: [
    "支援回復銃",
    "味方に当てるとHPを回復させます。敵にはダメージを与えません。散弾を7発ばらまく形式で、射程は45mと長く、当たった散弾の数だけ回復します。動いている味方にも当てやすいよう、判定は通常の射撃より広めです。表示されている威力の数値が、散弾1発あたりの回復量です（全弾命中で7倍）。レア度とバリアンスは回復量にそのまま効きます。特殊効果「貫通」を付けると、一直線に並んだ味方を最大3人まとめて回復できます。ダウンした味方の蘇生には使えません（蘇生は従来どおり近づいて行います）。",
  ],
};
const effects: Record<Effect, [string, string, string]> = {
  repel: [
    "撃退散弾",
    "8m以内で命中した通常敵を最大3m押し戻します。1回の射撃につき各敵に1回だけ作用し、ボスや建物の向こうへは押し出せません。標準性能の貫通と併用できます。",
    "ショットガン系統・反動射出器",
  ],
  chain: [
    "誘爆弾頭",
    "直撃した通常敵をその爆風で倒すと、その敵の位置に半径3.5mの追加爆発が発生します。中心威力は武器威力の50%で、外側ほど低下します。壁で遮られ、追加爆発からの再誘爆はありません。壁・地面への着弾や、爆風だけで倒した敵、ボスの撃破では誘爆しません。",
    "ロケット系統・グレネード系統",
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
    "ライフル系統・スナイパー系統・特殊系統",
  ],
  quick: [
    "高速装填",
    "装填時間を20%短縮します。一覧と詳細の装填時間には、この短縮がすでに反映されています。",
    "全武器",
  ],
};
export function kindSummary(kind: Kind | Family | "all") {
  const byFamily: Record<Family, string> = {
    rifle:
      "中距離向け。連射で狙った敵を攻撃し、移動しながら継続して攻撃できます。",
    shotgun:
      "近距離向け。散弾または単発の重い弾が各最大3体を貫通。建物は貫通しません。",
    rocket:
      "着弾地点を爆風で範囲攻撃。密集した敵に有効ですが、装弾数が少なく装填に隙があります。",
    sniper:
      "長距離向け。拡散も距離減衰もなし。1体を撃ち抜く狙撃銃と、列を薙ぎ払う貫通ビーム。",
    grenade:
      "山なりの弾道で榴弾を撃ち込み、障害物の向こう側も爆風で攻撃できます。",
    special:
      "戦い方を変える道具枠。後方へ飛び退く反動射出器と、味方を回復する支援銃。",
  };
  if (kind === "all")
    return "ライフルは中距離・連射、ショットガンは近距離・散弾貫通、ロケットは爆風で範囲攻撃。スナイパーは長距離、グレネードは山なり弾道、特殊は道具枠。";
  return byFamily[kind in byFamily ? (kind as Family) : familyOf(kind as Kind)];
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
