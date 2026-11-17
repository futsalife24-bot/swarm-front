import { SUPPLY_RULES } from "../shared/supply-policy";
import { SUPPLY_GRANTS } from "../shared/supply-grants";
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
import { createSupplyService, type SupplyError } from "./supply-service";
import { createCloudSave } from "./cloud-save";
import { applySupplyReceipt } from "./supply-rewards";
import { getMenuReducedMotion } from "./menu-effects";
import {
  loadSupplyReveal,
  supplyResults,
  type Reveal,
} from "./supply-presentation";
import "./supply-menu.css";
import { openSupplyResult, shareSupplyResults } from "./supply-result-actions";

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
    needsCloud = false,
    reveal: Reveal | null = null;
  host.innerHTML = `<div class="supply-menu">
    <section><p>補給券 <strong class="supply-count" data-supply-count>確認中…</strong></p>
      <div class="supply-actions"><button type="button" data-supply-draw="1" disabled>1回 · 1枚</button><button type="button" data-supply-draw="10" disabled>10連 · 10枚</button><button type="button" data-supply-recover hidden>前回の補給を再開</button><button type="button" data-supply-cloud hidden>クラウド保存を作成</button><button type="button" data-supply-refresh>再確認</button></div>
      <p class="supply-guarantee">10連は最後の1個がSR以上確定</p>
      <p data-supply-credit role="status" hidden></p>
      <p class="supply-feedback" data-supply-feedback role="status" aria-live="polite"></p>
      <button type="button" data-supply-starter hidden>初回バディを選ぶ</button>
      <small>無料の補給券です。初回${SUPPLY_RULES.initialTickets}枚（クラウド保存1つに1回）。以後は初回クリア${SUPPLY_GRANTS.firstClear}枚・星②③各${SUPPLY_GRANTS.star}枚・最高到達各${SUPPLY_GRANTS.frontStage}枚・週${SUPPLY_GRANTS.weeklyClearCap}回までのクリア各${SUPPLY_GRANTS.weeklyClear}枚・その日の最初のクリア${SUPPLY_GRANTS.dailyFirstClear}枚・週間ミッションで入手。日次配布はありません。バディ招集券とは別です。</small>
      <small>補給券はクラウド保存（引き継ぎコード）に紐づき、初回10枚はクラウド保存1つにつき1回です。通信できるときに利用できます。クラウド保存を削除すると補給券も引き継げません。</small>
    </section>
    <section><h2>排出内容・確率</h2><table class="supply-rates"><thead><tr><th>通常1枠</th><th>確率</th></tr></thead><tbody>
      ${Object.entries(SUPPLY_RULES.weights)
        .map(
          ([key, weight]) =>
            `<tr><td>${key === "buddy" ? "バディ" : key === "shard" ? `武装片${SUPPLY_RULES.shardAmount}個` : `${key}武器`}</td><td>${Number((weight * 100).toFixed(1))}%</td></tr>`,
        )
        .join("")}
      </tbody></table><small>10連は最後の1個がSR以上確定。通常抽選で対象が0個なら最後の1枠が${Object.entries(
        SUPPLY_RULES.guaranteeWeights,
      )
        .map(
          ([key, weight]) =>
            `${key === "buddy" ? "バディ" : key}${weight * 100}%`,
        )
        .join(
          "／",
        )}になります。SR以上の1個を最後に配置します。武器はLv1でLRは対象外。同じ区分内は均等です。</small>
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
    const credit = $("[data-supply-credit]");
    if (snapshot?.credited?.past) {
      credit.hidden = false;
      credit.textContent = `過去の達成分 +${snapshot.credited.past}枚`;
    }
    const hasStarter = !!getSave().buddies?.starterChosen;
    $("[data-supply-count]").textContent = snapshot
      ? `${snapshot.tickets}枚`
      : needsCloud
        ? "未作成"
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
    const cloud = $<HTMLButtonElement>("[data-supply-cloud]");
    cloud.hidden = !needsCloud;
    cloud.disabled = busy;
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
    const results = supplyResults(
      receipt.rewards,
      new Set(Object.keys(current.buddies?.owned ?? {})),
    );
    const module = await loadSupplyReveal();
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
      finalActions: [
        { id: "share", label: "Xで共有" },
        { id: "close", label: "次へ", primary: true },
      ],
      onResult: openSupplyResult,
      onShare: shareSupplyResults,
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
      needsCloud = false;
      feedback(
        snapshot.pending
          ? "前回の確定した補給を再開できます。"
          : "補給券を確認しました。",
      );
    } catch (error) {
      needsCloud = (error as SupplyError).cloudRequired === true;
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
  $("[data-supply-cloud]").onclick = async () => {
    if (busy || closed) return;
    busy = true;
    feedback("クラウド保存を作成しています…");
    update();
    try {
      await createCloudSave();
      busy = false;
      await refresh();
    } catch (error) {
      busy = false;
      feedback((error as Error).message);
      update();
    }
  };
  $("[data-supply-starter]").onclick = chooseStarter;
  void refresh();
  return {
    destroy() {
      closed = true;
      reveal?.destroy();
    },
  };
}
