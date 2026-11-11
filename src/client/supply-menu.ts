import { WEAPONS, familyOf } from "../shared/defs";
import { GRADES } from "../shared/progression";
import { BUDDY_ASSETS } from "./buddy-assets";
import {
  loadProgress,
  persistProgress,
  type ProgressSave,
} from "./progression-save";
import {
  validSupplyReceipt,
  type SupplyReceipt,
  type SupplySnapshot,
} from "../shared/supply-contract";
import { createSupplyService } from "./supply-service";
import { applySupplyReceipt } from "./supply-rewards";
import { getMenuReducedMotion } from "./menu-effects";
import "./supply-menu.css";

interface Reveal {
  ready: Promise<unknown>;
  play(results: object[], options?: object): Promise<void>;
  destroy(): void;
  state(): { waiting: string | null };
}
let styleReady: Promise<void> | undefined;
function revealStyle() {
  return (styleReady ??= new Promise((resolve, reject) => {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = import.meta.env.BASE_URL + "supply-reveal/gacha.css";
    style.onload = () => resolve();
    style.onerror = () => {
      styleReady = undefined;
      style.remove();
      reject(Error("補給演出を読み込めません。再試行してください"));
    };
    document.head.appendChild(style);
  }));
}

/** 基地の新補給。保存成功済みの結果だけを表示レイヤーへ渡す。 */
export function mountSupplyMenu(
  host: HTMLElement,
  getSave: () => ProgressSave,
  saved: (save: ProgressSave) => void,
  chooseStarter: () => void,
  getVolume: () => number = () => 1,
) {
  const service = createSupplyService();
  let snapshot: SupplySnapshot | null = null;
  let busy = false,
    closed = false,
    reveal: Reveal | null = null;
  host.innerHTML = `<div class="supply-menu">
    <section><p>補給券 <strong class="supply-count" data-supply-count>確認中…</strong></p>
      <div class="supply-actions"><button type="button" data-supply-draw="1" disabled>1回 · 1枚</button><button type="button" data-supply-draw="10" disabled>10連 · 10枚</button><button type="button" data-supply-recover hidden>前回の補給を再開</button><button type="button" data-supply-refresh>再確認</button></div>
      <p class="supply-guarantee">10連はSR以上が1個以上確定</p>
      <p class="supply-feedback" data-supply-feedback role="status" aria-live="polite"></p>
      <button type="button" data-supply-starter hidden>初回バディを選ぶ</button>
      <small>無料の補給券です。初回10枚、翌日から日本時間で1日1枚。受け取らなかった日分の繰越はありません。バディ招集券とは別です。</small>
      <small>補給券はこの端末の補給接続情報に紐づきます。通信できるときに利用できます。ブラウザーのデータを消すと接続情報も失われます。</small>
    </section>
    <section><h2>排出内容・確率</h2><table class="supply-rates"><thead><tr><th>通常1枠</th><th>確率</th></tr></thead><tbody>
      <tr><td>N武器</td><td>45%</td></tr><tr><td>R武器</td><td>30%</td></tr><tr><td>SR武器</td><td>15%</td></tr><tr><td>SSR武器</td><td>4%</td></tr><tr><td>バディ</td><td>1%</td></tr><tr><td>武装片10個</td><td>5%</td></tr>
      </tbody></table><small>10連はSR以上が1個以上確定。通常抽選で対象が0個なら最後の1枠がSR75%／SSR20%／バディ5%になります。武器はLv1でLRは対象外。同じ区分内は均等です。</small>
      <small>所持済みバディは突破素材1個になります。確定演出やタップ・長押し・スキップで抽選結果は変わりません。</small>
    </section></div>`;
  const $ = <T extends HTMLElement>(selector: string) =>
    host.querySelector<T>(selector)!;
  const feedback = (message: string) => {
    if (!closed) $("[data-supply-feedback]").textContent = message;
  };
  const update = () => {
    if (closed) return;
    let pending;
    try {
      pending = service.pendingRequest();
    } catch (error) {
      host
        .querySelectorAll<HTMLButtonElement>(
          "[data-supply-draw],[data-supply-recover]",
        )
        .forEach((b) => (b.disabled = true));
      feedback((error as Error).message);
      return;
    }
    const hasStarter = !!getSave().buddies?.starterChosen;
    $("[data-supply-count]").textContent = snapshot
      ? `${snapshot.tickets}枚`
      : "確認中…";
    host
      .querySelectorAll<HTMLButtonElement>("[data-supply-draw]")
      .forEach((button) => {
        button.disabled =
          busy ||
          !hasStarter ||
          !snapshot ||
          !!snapshot.pending ||
          snapshot.tickets < Number(button.dataset.supplyDraw) ||
          !!pending;
      });
    const recover = $<HTMLButtonElement>("[data-supply-recover]");
    recover.hidden = !snapshot?.pending && !pending;
    recover.disabled = busy;
    $<HTMLButtonElement>("[data-supply-refresh]").disabled = busy;
    $("[data-supply-starter]").hidden = hasStarter;
  };
  const present = async (receipt: SupplyReceipt) => {
    if (closed) return;
    if (!validSupplyReceipt(receipt))
      throw Error("補給の確定結果を確認できません");
    // 別画面で更新された保存を読み直し、受領IDを持つ1回の保存へまとめる。
    const current = loadProgress("normal") ?? getSave();
    const next = applySupplyReceipt(current, receipt);
    if (next !== current) persistProgress(next);
    saved(next);
    const acquired = new Set(Object.keys(current.buddies?.owned ?? {}));
    const results = receipt.rewards.map((reward) => {
      if (reward.type === "shard")
        return { type: "shard", amount: reward.amount };
      if (reward.type === "buddy") {
        const result = {
          type: "buddy",
          name: BUDDY_ASSETS[reward.buddyId].name,
          art: `b-${reward.buddyId}`,
          new: !acquired.has(reward.buddyId),
        };
        acquired.add(reward.buddyId);
        return result;
      }
      const family = familyOf(reward.weapon.kind);
      const art =
        family === "shotgun"
          ? "w-shotgun"
          : family === "rocket" || family === "grenade"
            ? "w-rocket"
            : "w-rifle";
      return {
        type: "weapon",
        rarity: GRADES[reward.weapon.rarity],
        name: WEAPONS[reward.weapon.kind].name,
        art,
        new: true,
      };
    });
    const moduleUrl = import.meta.env.BASE_URL + "supply-reveal/runtime.js";
    const [module] = await Promise.all([
      import(/* @vite-ignore */ moduleUrl),
      revealStyle(),
    ]);
    if (closed) return;
    let finished = false;
    const onClose = async () => {
      if (finished || reveal?.state().waiting !== "final") return;
      finished = true;
      try {
        snapshot = await service.acknowledge(receipt.requestId);
        feedback("補給を受領しました。");
      } catch (error) {
        feedback(
          `受領は保存済みです。再確認してください。${(error as Error).message}`,
        );
      }
      busy = false;
      update();
    };
    reveal?.destroy();
    reveal = module.createSupplyReveal(document.body, {
      label: "補給券",
      reduced: getMenuReducedMotion(),
      sound: getVolume() > 0,
      volume: getVolume(),
      assetBase: new URL(
        import.meta.env.BASE_URL + "supply-reveal/assets/",
        location.origin,
      ).href,
      finalActions: [{ id: "close", label: "基地へ戻る", primary: true }],
      onClose,
    }) as Reveal;
    await reveal!.ready;
    if (closed) {
      reveal!.destroy();
      return;
    }
    feedback("確定した補給を保存しました。");
    await reveal!.play(results);
  };
  const refresh = async () => {
    if (busy || closed) return;
    busy = true;
    feedback("補給券を確認しています…");
    update();
    try {
      snapshot = await service.status();
      feedback(
        snapshot.pending
          ? "前回の確定した補給を再開できます。"
          : "補給券を確認しました。",
      );
    } catch (error) {
      feedback((error as Error).message);
    } finally {
      busy = false;
      update();
    }
  };
  const draw = async (count: 1 | 10) => {
    if (busy || closed) return;
    busy = true;
    feedback("補給を要請しています…");
    update();
    try {
      snapshot = await service.draw(count);
      if (!snapshot.pending) throw Error("確定結果を再確認してください");
      await present(snapshot.pending);
    } catch (error) {
      busy = false;
      feedback((error as Error).message);
      update();
    }
  };
  const recover = async () => {
    if (busy || closed) return;
    busy = true;
    update();
    try {
      snapshot = await service.status();
      if (snapshot.pending) await present(snapshot.pending);
      else {
        const pending = service.pendingRequest();
        if (pending?.phase === "draw") {
          snapshot = await service.draw(pending.count);
          if (snapshot.pending) await present(snapshot.pending);
        } else {
          busy = false;
          feedback("受領状況を確認しました。");
          update();
        }
      }
    } catch (error) {
      busy = false;
      feedback((error as Error).message);
      update();
    }
  };
  host
    .querySelectorAll<HTMLButtonElement>("[data-supply-draw]")
    .forEach(
      (b) =>
        (b.onclick = () => void draw(Number(b.dataset.supplyDraw) as 1 | 10)),
    );
  $("[data-supply-recover]").onclick = () => void recover();
  $("[data-supply-refresh]").onclick = () => void refresh();
  $("[data-supply-starter]").onclick = chooseStarter;
  void refresh();
  return {
    destroy() {
      closed = true;
      reveal?.destroy();
    },
  };
}
