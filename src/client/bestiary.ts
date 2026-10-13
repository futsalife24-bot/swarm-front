import { backgroundMusic } from "./bgm";
import { menuAnalyze } from "./menu-effects";
import { showModalAfterFullscreen } from "./landscape";
import { ENEMIES } from "../shared/defs";
import "./bestiary.css";
import { createEnemyViewer } from "./enemy-viewer";
import type { HoundClip } from "./hound-motion";
import { hasEncounterFilm, showEncounterFilm } from "./encounter-film";
import { ANOMALY_VOICES, ANOMALY_VOICE_PATH } from "./anomaly-voice";

type EnemyType = "生物型" | "異構型" | "機構型";
const entries: Record<
  keyof typeof ENEMIES,
  [string, EnemyType, string, string]
> = {
  harrow: [
    "HARROW",
    "異構型",
    "地上では短く突進し、翼爪から山なりの弾と直射弾を放ちます。地面すれすれまで伏せ、その場で一回転する攻撃も見られます。空中では山なり弾を放ち、標的の上空を直線に通過しながら左右二列へ爆撃します。急降下では二脚の爪を先行させ、地面に爪形の予兆が現れます。",
    "長い首から胴体へ連なる鱗の被覆と、喉から腹を覆う装甲。細い後脚で歩き、支柱で組まれた翼を広げて高く飛び上がります。地上と空中を行き来し、飛行中に大きく損傷すると体勢を崩して落下します。",
  ],
  calyx: [
    "CALYX",
    "生物型",
    "前の花弁を開いて振り下ろします。また、前方の花粉嚢から花粉弾を放ち、着弾地点に花粉がドーム状に広がって周囲を覆う様子が観察されています。",
    "灰緑に赤茶の斑が混じる丸い蕾。三本の曲線の根を支えに、兵士側へ傾いたコマのように回転し、その周囲を回ります。五枚の花弁の奥に花粉嚢を隠しています。",
  ],
  ant: [
    "HOUND / VOLLEY",
    "異構型",
    "扇状にエネルギー弾を放ちます。接近した対象にはパルスを発します。",
    "五脚と浮遊する背骨を持つHOUNDの派生個体。地上を回り込みます。",
  ],
  spider: [
    "HOUND / LEAPER",
    "異構型",
    "着地に続いて、周囲へパルスを発します。",
    "五脚を縮めて跳躍し、壁を足場に再び飛び出します。",
  ],
  crawler: [
    "PLEAT",
    "生物型",
    "胸部の襞が開き、姿勢を沈めます。襞が閉じると、地面に沿って前方へ衝撃波が走ります。",
    "獣の背を思わせる乾いた被覆。その下の支持肢は、外から見える体形と一致しません。低く追跡する途中で背が折り重なり、硬化した層が金属のように光ります。",
  ],
  spitter: [
    "PRISM",
    "異構型",
    "照準した地点へ、低速の強いエネルギー弾を放ちます。",
    "浮遊する非対称多面体。離れた間合いを保ち、射線が通る遠い隊員を優先します。",
  ],
  hornet: [
    "RAY",
    "生物型",
    "離れた隊員へ照準を向け、斜め下へ電撃杭を放ちます。発射に先立ち、中央の縦穴に光が集まります。",
    "エイのような平面、ウナギを思わせる推進尾と中央の縦穴。羽ばたかず空中を遊泳し、隊員の上方を旋回します。",
  ],
  boss: [
    "FOUNDRY ZERO",
    "機構型",
    "隊員の集まる場所へ予兆が広がり、周囲を攻撃します。損傷すると周囲の物質からPRISMを形成し、前脚と上体を高く持ち上げ、踏み下ろしと同時に攻撃します。",
    "壁・レール・リングからなる移動工場。大きな支持脚で身体を支え、隊員の集まる場所へ向きを変えます。",
  ],
};
const foundryWormReport = {
  attack:
    "頭部と各節の発光器官が隊員へ向き、光を集めてから細いレーザーを放ちます。頭部を失うと、そのとき頭部側につながっていた残存節と同じ数の個体が現れます。現れる種類はマップによって異なります。",
  movement:
    "ミミズのようにうねり、多数の脚で地面を這う機械型の巨体。ひとつの頭部に七つの胴節がつながり、広い範囲を移動します。胴節が壊れるとその位置で分離し、両側の鎖が加速して隊員を追います。",
};

export function openBestiary(
  options: {
    encounters?: Record<string, "solo" | "coop">;
    onClose?: () => void;
    voiceVolume?: number;
  } = {},
) {
  const access = (key: string) =>
    options.encounters ? options.encounters[key] : "solo";
  const dialog = document.createElement("dialog");
  dialog.className = "bestiary";
  dialog.setAttribute("aria-labelledby", "bestiary-title");
  dialog.innerHTML = `<header><div><div class="eyebrow">ANOMALOUS STRUCTURES</div><h2 id="bestiary-title">エネミーレポート</h2></div><button type="button" id="report-close" autofocus>タイトルへ戻る</button></header><div class="report-layout"><nav class="enemy-list" aria-label="敵の一覧"><p class="report-scroll-guide">${Object.keys(ENEMIES).length}種の敵 · 一覧は上下にスクロール ↕</p>${Object.entries(
    entries,
  )
    .map(([key, [knownName, knownRole]], index) => {
      const name = access(key) === "solo" ? knownName : "？？？";
      const role =
        access(key) === "solo"
          ? knownRole
          : access(key) === "coop"
            ? "協力で姿を確認"
            : "未遭遇";
      return `<button type="button" data-enemy="${key}" aria-pressed="false"><span class="eyebrow">${String(index + 1).padStart(2, "0")}</span><span><strong>${name}</strong><small>${role}</small></span><span aria-hidden="true">›</span></button>`;
    })
    .join(
      "",
    )}</nav><section class="report-detail" aria-label="選択した敵の解説"><div class="specimen"><div class="specimen-label eyebrow">3D SPECIMEN</div><div class="enemy-viewport"></div><p class="viewer-hint">ドラッグで回転 · ピンチ / ホイールで拡大</p></div><article class="enemy-description" tabindex="0" aria-label="敵の解説。上下にスクロールできます" aria-live="polite"></article></section></div>`;
  document.body.append(dialog);
  showModalAfterFullscreen(dialog);
  backgroundMusic().setReport(true);
  const voicePlayer = new Audio();
  voicePlayer.preload = "none";
  voicePlayer.volume = Math.max(0, Math.min(1, options.voiceVolume ?? 0.35));
  const stopVoice = () => {
    voicePlayer.pause();
    voicePlayer.currentTime = 0;
  };
  const hideVoice = () => {
    if (document.hidden) stopVoice();
  };
  document.addEventListener("visibilitychange", hideVoice);
  let viewer: ReturnType<typeof createEnemyViewer> | undefined;
  const viewport = dialog.querySelector<HTMLElement>(".enemy-viewport")!;
  const playback = document.createElement("div");
  playback.className = "report-playback";
  playback.setAttribute("role", "group");
  playback.setAttribute("aria-label", "モーション再生");
  playback.innerHTML =
    '<div class="motion-buttons"><button type="button" data-motion="move" aria-pressed="false" disabled>移動を見る</button><button type="button" data-motion="attack" aria-pressed="false" disabled>攻撃を見る</button><button type="button" data-motion="idle" aria-pressed="true" disabled>待機を見る</button><select class="harrow-attack-picker" aria-label="HARROWの攻撃を選択" hidden><option value="">全攻撃を連続再生</option><option value="Dash">短距離ダッシュ</option><option value="Threat">山なり弾</option><option value="Snipe">直射弾</option><option value="Spin">低姿勢回転</option><option value="Takeoff">離陸 A</option><option value="TakeoffB">離陸 B</option><option value="TakeoffC">離陸 C</option><option value="TakeoffD">離陸 D</option><option value="AirThreat">空中山なり弾</option><option value="BombPass">爆撃通過</option><option value="Dive">爪先行急降下</option></select></div><p class="motion-status" role="status">モデルを読み込み中…</p>';
  viewport.after(playback);
  const status = playback.querySelector<HTMLElement>(".motion-status")!;
  const motionButtons =
    playback.querySelectorAll<HTMLButtonElement>("[data-motion]");
  const harrowPicker = playback.querySelector<HTMLSelectElement>(
    ".harrow-attack-picker",
  )!;
  let analysisPending = true;
  function syncPlayback() {
    const ready = viewport.dataset.asset === "ready";
    if (ready && analysisPending && viewport.style.filter !== "brightness(0)") {
      analysisPending = false;
      menuAnalyze(viewport);
    }
    motionButtons.forEach((button) => {
      button.disabled = !ready;
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.motion === (viewport.dataset.motion ?? "idle")),
      );
    });
    status.textContent =
      viewport.dataset.asset === "error"
        ? "動作モデルを読み込めませんでした。敵を選び直してください。"
        : viewport.dataset.asset === "locked"
          ? "遭遇すると観察できます"
          : !ready
            ? "モデルを読み込み中…"
            : viewport.dataset.motion === "move"
              ? "移動モーションを再生中"
              : viewport.dataset.motion === "attack"
                ? "攻撃モーションを繰り返し再生中"
                : "待機モーションを再生中";
  }
  const playbackObserver = new MutationObserver(syncPlayback);
  playbackObserver.observe(viewport, {
    attributes: true,
    attributeFilter: ["data-asset", "data-motion"],
  });
  motionButtons.forEach(
    (button) =>
      (button.onclick = () =>
        viewer?.play(
          button.dataset.motion as "idle" | "move" | "attack",
          (harrowPicker.value || undefined) as HoundClip | undefined,
        )),
  );
  harrowPicker.onchange = () =>
    viewer?.play(
      "attack",
      (harrowPicker.value || undefined) as HoundClip | undefined,
    );
  const article = dialog.querySelector<HTMLElement>("article")!;
  const showModel = (
    key: keyof typeof ENEMIES,
    worm: boolean,
    visible: boolean,
  ) => {
    viewport.querySelector(".menu-fx-mosaic")?.remove();
    analysisPending = true;
    if (visible) {
      try {
        viewer ??= createEnemyViewer(viewport);
        viewer.show(key, worm);
      } catch {
        viewport.dataset.asset = "error";
        viewport.innerHTML =
          '<p class="viewer-error">3D表示を開始できませんでした。画面を開き直してください。</p>';
      }
    } else {
      viewer?.dispose();
      viewer = undefined;
      viewport.innerHTML = "";
      viewport.dataset.asset = "locked";
    }
    viewport.style.filter =
      access(worm ? "worm" : key) === "coop" ? "brightness(0)" : "";
  };
  function select(key: keyof typeof ENEMIES, worm = false) {
    stopVoice();
    const state = access(worm ? "worm" : key);
    harrowPicker.hidden = key !== "harrow" || state !== "solo";
    harrowPicker.value = "";
    const [name, role, attack, movement] = entries[key];
    const copy =
      worm && key === "boss" ? foundryWormReport : { attack, movement };
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-enemy]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.enemy === key),
        ),
      );
    article.innerHTML = `<div class="eyebrow">${role}</div><h3>${name}</h3>${key === "boss" ? `<div class="specimen-forms"><button type="button" data-worm="false" aria-pressed="${!worm}">通常型</button><button type="button" data-worm="true" aria-pressed="${worm}">連結炉形態</button></div>` : ""}<p class="report-scroll-guide">解説の続きは上下にスクロール ↕</p><h4>攻撃方法</h4><p>${copy.attack}</p><h4>移動方法</h4><p>${copy.movement}</p>`;
    article.scrollTop = 0;
    const film = document.createElement("button");
    film.type = "button";
    film.className = "report-film-open";
    film.textContent = "会敵ムービー";
    const filmKey = worm ? "worm" : key;
    if (hasEncounterFilm(filmKey)) {
      film.onclick = () => showEncounterFilm(filmKey, dialog);
      article.querySelector("h3")!.after(film);
    }
    if (state !== "solo") {
      article.querySelector(".eyebrow")!.textContent =
        state === "coop" ? "協力で姿を確認" : "未遭遇";
      article.querySelector("h3")!.textContent = "？？？";
      film.remove();
      article
        .querySelectorAll("h4, .report-scroll-guide, p")
        .forEach((el) => el.remove());
      const note = document.createElement("p");
      note.textContent =
        state === "coop"
          ? "協力で姿を確認。ソロで遭遇すると正式に記録されます。"
          : "まだ遭遇していません。";
      article.append(note);
    } else {
      const voice = document.createElement("div");
      voice.className = "report-voice";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "声を聴く";
      button.setAttribute("aria-label", `${name}の声を聴く`);
      const description = document.createElement("p");
      description.textContent = ANOMALY_VOICES[key].description;
      let variant = 0;
      button.onclick = () => {
        stopVoice();
        voicePlayer.src = `${import.meta.env.BASE_URL}${ANOMALY_VOICE_PATH}${key}-${variant}.wav`;
        variant = 1 - variant;
        button.textContent = "再生中…";
        void voicePlayer.play().catch(() => {
          button.textContent = "再試聴する";
        });
      };
      voicePlayer.onended = () => {
        button.textContent = "声を聴く";
      };
      voice.append(button, description);
      article.querySelector("h3")!.after(voice);
    }
    showModel(key, worm, !!state);
    article.querySelectorAll<HTMLButtonElement>("[data-worm]").forEach(
      (button) =>
        (button.onclick = () => {
          select(key, button.dataset.worm === "true");
          article
            .querySelector<HTMLButtonElement>(
              `[data-worm="${button.dataset.worm}"]`,
            )
            ?.focus({ preventScroll: true });
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
  dialog.querySelector<HTMLButtonElement>("#report-close")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    stopVoice();
    voicePlayer.removeAttribute("src");
    document.removeEventListener("visibilitychange", hideVoice);
    playbackObserver.disconnect();
    viewer?.dispose();
    dialog.remove();
    backgroundMusic().setReport(false);
    options.onClose?.();
  });
  select("crawler");
}
