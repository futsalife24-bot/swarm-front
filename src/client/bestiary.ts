import { ENEMIES } from "../shared/defs";
import "./bestiary.css";
import { createEnemyViewer } from "./enemy-viewer";

const entries: Record<keyof typeof ENEMIES, [string, string, string, string]> =
  {
    ant: [
      "HOUND / VOLLEY",
      "ANOMALY / 散射",
      "扇状にエネルギー弾を放ちます。接近した対象にはパルスを発します。",
      "五脚と浮遊する背骨を持つHOUNDの派生個体。地上を回り込みます。",
    ],
    spider: [
      "HOUND / LEAPER",
      "ANOMALY / 跳躍",
      "着地に続いて、周囲へパルスを発します。",
      "五脚を縮めて跳躍し、壁を足場に再び飛び出します。",
    ],
    crawler: [
      "PLEAT",
      "ANOMALY / 近接",
      "胸部の襞が開き、姿勢を沈めます。襞が閉じると、地面に沿って前方へ衝撃波が走ります。",
      "獣の背を思わせる乾いた被覆。その下の支持肢は、外から見える体形と一致しません。低く追跡する途中で背が折り重なり、硬化した層が金属のように光ります。",
    ],
    spitter: [
      "PRISM",
      "STRUCTURE / 遠距離",
      "照準した地点へ、低速の強いエネルギー弾を放ちます。",
      "浮遊する非対称多面体。離れた間合いを保ち、射線が通る遠い隊員を優先します。",
    ],
    hornet: [
      "RAY",
      "ANOMALY / 空中・孤立者狙い",
      "離れた隊員へ照準を向け、斜め下へ電撃杭を放ちます。発射に先立ち、中央の縦穴に光が集まります。",
      "エイのような平面、ウナギを思わせる推進尾と中央の縦穴。羽ばたかず空中を遊泳し、隊員の上方を旋回します。",
    ],
    boss: [
      "FOUNDRY ZERO",
      "STRUCTURE / 構造形成炉",
      "隊員の集まる場所へ予兆が広がり、周囲を攻撃します。損傷すると周囲の物質からPRISMを形成し、前脚と上体を高く持ち上げ、踏み下ろしと同時に攻撃します。",
      "壁・レール・リングからなる移動工場。連結炉形態は節ごとの破壊と分裂が可能で、残った炉が加速して移動し、各炉からエネルギー弾を発射します。",
    ],
  };

export function openBestiary() {
  const dialog = document.createElement("dialog");
  dialog.className = "bestiary";
  dialog.setAttribute("aria-labelledby", "bestiary-title");
  dialog.innerHTML = `<header><div><div class="eyebrow">ANOMALOUS STRUCTURES</div><h2 id="bestiary-title">エネミーレポート</h2></div><button type="button" id="report-close" autofocus>タイトルへ戻る</button></header><div class="report-layout"><nav class="enemy-list" aria-label="敵の一覧"><p class="report-scroll-guide">6種の敵 · 一覧は上下にスクロール ↕</p>${Object.entries(
    entries,
  )
    .map(
      ([key, [name, role]], index) =>
        `<button type="button" data-enemy="${key}" aria-pressed="false"><span class="eyebrow">${String(index + 1).padStart(2, "0")}</span><span><strong>${name}</strong><small>${role}</small></span><span aria-hidden="true">›</span></button>`,
    )
    .join(
      "",
    )}</nav><section class="report-detail" aria-label="選択した敵の解説"><div class="specimen"><div class="specimen-label eyebrow">3D SPECIMEN</div><div class="enemy-viewport"></div><div class="viewer-tools"><button type="button" id="rotate-left" aria-label="左へ回転">↶</button><button type="button" id="view-reset">視点リセット</button><button type="button" id="rotate-right" aria-label="右へ回転">↷</button></div><p class="viewer-hint">ドラッグで回転 · ピンチ / ホイールで拡大</p></div><article class="enemy-description" tabindex="0" aria-label="敵の解説。上下にスクロールできます" aria-live="polite"></article></section></div>`;
  document.body.append(dialog);
  dialog.showModal();
  let viewer: ReturnType<typeof createEnemyViewer> | undefined;
  const viewport = dialog.querySelector<HTMLElement>(".enemy-viewport")!;
  try {
    viewer = createEnemyViewer(viewport);
  } catch {
    viewport.innerHTML =
      '<p class="viewer-error">3D表示を開始できませんでした。画面を開き直してください。</p>';
  }
  const article = dialog.querySelector<HTMLElement>("article")!;
  function select(key: keyof typeof ENEMIES) {
    const [name, role, attack, movement] = entries[key];
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-enemy]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.enemy === key),
        ),
      );
    article.innerHTML = `<div class="eyebrow">${role}</div><h3>${name}</h3>${key === "boss" ? '<div class="specimen-forms"><button type="button" data-worm="false" aria-pressed="true">通常型</button><button type="button" data-worm="true" aria-pressed="false">連結炉形態</button></div>' : ""}<p class="report-scroll-guide">解説の続きは上下にスクロール ↕</p><h4>攻撃方法</h4><p>${attack}</p><h4>移動方法</h4><p>${movement}</p>`;
    article.scrollTop = 0;
    viewer?.show(key);
    article.querySelectorAll<HTMLButtonElement>("[data-worm]").forEach(
      (button) =>
        (button.onclick = () => {
          article
            .querySelectorAll("[data-worm]")
            .forEach((item) =>
              item.setAttribute("aria-pressed", String(item === button)),
            );
          viewer?.show(key, button.dataset.worm === "true");
        }),
    );
  }
  dialog
    .querySelectorAll<HTMLButtonElement>("[data-enemy]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          select(button.dataset.enemy as keyof typeof ENEMIES)),
    );
  dialog.querySelector<HTMLButtonElement>("#rotate-left")!.onclick = () =>
    viewer?.rotate(-1);
  dialog.querySelector<HTMLButtonElement>("#rotate-right")!.onclick = () =>
    viewer?.rotate(1);
  dialog.querySelector<HTMLButtonElement>("#view-reset")!.onclick = () =>
    viewer?.reset();
  dialog.querySelector<HTMLButtonElement>("#report-close")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    viewer?.dispose();
    dialog.remove();
  });
  select("crawler");
}
