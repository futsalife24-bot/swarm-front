import { ENEMY_REPORT_INTRO_TEXT } from "./control-voice-lines";
import { MediaVolume } from "./media-volume";
import { backgroundMusic } from "./bgm";
import { menuAnalyze } from "./menu-effects";
import { showModalAfterFullscreen } from "./landscape";
import {
  ENEMY_REPORT_NAMES,
  type EnemyReportId,
} from "../shared/enemy-identity";
import { ENEMY_REPORT_ORDER } from "../shared/enemy-report-order";
import { ENEMY_REPORT_ENTRIES } from "./enemy-report-entries";
import "./bestiary.css";
import { createEnemyViewer } from "./enemy-viewer";
import type { HoundClip } from "./hound-motion";
import { hasEncounterFilm, showEncounterFilm } from "./encounter-film";
import { ANOMALY_VOICE_PROFILES, ANOMALY_VOICE_PATH } from "./anomaly-voice";
import {
  reportIdentification,
  type ReportVoice,
} from "./report-identification";

const entries = ENEMY_REPORT_ENTRIES;

export function openBestiary(
  options: {
    encounters?: Record<string, "solo" | "coop">;
    onClose?: () => void;
    voiceVolume?: number;
    controlVoice?: ReportVoice;
  } = {},
) {
  const access = (key: string) => options.encounters?.[key];
  const identification = reportIdentification(options.controlVoice);
  const dialog = document.createElement("dialog");
  dialog.className = "bestiary";
  dialog.setAttribute("aria-labelledby", "bestiary-title");
  dialog.innerHTML = `<header><div><div class="eyebrow">ANOMALOUS STRUCTURES</div><h2 id="bestiary-title">エネミーレポート</h2></div><button type="button" id="report-close" autofocus>タイトルへ戻る</button></header><div class="report-layout"><nav class="enemy-list" aria-label="敵の一覧"><p class="report-scroll-guide">${ENEMY_REPORT_ORDER.length}種の敵 · 一覧は上下にスクロール ↕</p>${ENEMY_REPORT_ORDER.map(
    (key, index) => {
      const [knownRole] = entries[key];
      const knownName = ENEMY_REPORT_NAMES[key];
      const name = access(key) === "solo" ? knownName : "？？？";
      const role =
        access(key) === "solo"
          ? knownRole
          : access(key) === "coop"
            ? "協力で姿を確認"
            : "未遭遇";
      return `<button type="button" data-enemy="${key}" aria-pressed="false"><span class="eyebrow">${String(index + 1).padStart(2, "0")}</span><span><strong>${name}</strong><small>${role}</small></span><span aria-hidden="true">›</span></button>`;
    },
  ).join(
    "",
  )}</nav><section class="report-detail report-unselected" aria-label="選択した敵の解説"><div class="specimen"><div class="specimen-label eyebrow">3D SPECIMEN</div><div class="enemy-viewport"></div><p class="viewer-hint">ドラッグで回転 · ピンチ / ホイールで拡大</p></div><article class="enemy-description" tabindex="0" aria-label="敵の解説。上下にスクロールできます" aria-live="polite"></article></section></div>`;
  document.body.append(dialog);
  showModalAfterFullscreen(dialog);
  backgroundMusic().setReport(true);
  const voicePlayer = new Audio();
  voicePlayer.preload = "none";
  const voiceOutput = new MediaVolume(voicePlayer);
  voiceOutput.volume =
    Math.max(0, Math.min(1, options.voiceVolume ?? 0.35)) * 0.7;
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
  const showModel = (key: EnemyReportId, visible: boolean) => {
    viewport.querySelector(".menu-fx-mosaic")?.remove();
    analysisPending = true;
    if (visible) {
      try {
        viewer ??= createEnemyViewer(viewport);
        viewer.show(key === "worm" ? "boss" : key, key === "worm");
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
    viewport.style.filter = access(key) === "coop" ? "brightness(0)" : "";
  };
  function select(key: EnemyReportId) {
    dialog
      .querySelector(".report-detail")!
      .classList.remove("report-unselected");
    stopVoice();
    const state = access(key);
    identification.select(key, state);
    harrowPicker.hidden = key !== "harrow" || state !== "solo";
    harrowPicker.value = "";
    const name = ENEMY_REPORT_NAMES[key];
    const [role, attack, movement] = entries[key];
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-enemy]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.enemy === key),
        ),
      );
    article.innerHTML = `<div class="eyebrow">${role}</div><h3>${name}</h3><p class="report-scroll-guide">解説の続きは上下にスクロール ↕</p><h4>攻撃方法</h4><p>${attack}</p><h4>移動方法</h4><p>${movement}</p>`;
    article.scrollTop = 0;
    const film = document.createElement("button");
    film.type = "button";
    film.className = "report-film-open";
    film.textContent = "会敵ムービー";
    if (hasEncounterFilm(key)) {
      film.onclick = () => showEncounterFilm(key, dialog);
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
      voice.className = "report-voices";
      const profiles: (keyof typeof ANOMALY_VOICE_PROFILES)[] =
        key === "worm" ? ["boss-linked", "boss-separated"] : [key];
      const buttons: { button: HTMLButtonElement; label: string }[] = [];
      const resetLabels = () => {
        for (const { button, label } of buttons) button.textContent = label;
      };
      let playback = 0;
      for (const profile of profiles) {
        const button = document.createElement("button");
        button.type = "button";
        const label =
          profile === "boss-linked"
            ? "連結中の声"
            : profile === "boss-separated"
              ? "分離後の声"
              : "声を聴く";
        button.textContent = label;
        button.setAttribute(
          "aria-label",
          `${ANOMALY_VOICE_PROFILES[profile].name}の声を聴く`,
        );
        buttons.push({ button, label });
        const description = document.createElement("p");
        description.textContent = ANOMALY_VOICE_PROFILES[profile].description;
        let variant = 0;
        button.onclick = () => {
          identification.stop();
          stopVoice();
          resetLabels();
          const request = ++playback;
          voicePlayer.src = `${import.meta.env.BASE_URL}${ANOMALY_VOICE_PATH}${profile}-${variant}.wav`;
          variant = 1 - variant;
          button.textContent = "再生中…";
          voiceOutput.unlock();
          void voicePlayer.play().catch(() => {
            if (request === playback) button.textContent = "再試聴する";
          });
        };
        const row = document.createElement("div");
        row.className = "report-voice";
        row.append(button, description);
        voice.append(row);
      }
      voicePlayer.onended = resetLabels;
      article.querySelector("h3")!.after(voice);
    }
    showModel(key, !!state);
  }
  dialog
    .querySelectorAll<HTMLButtonElement>("[data-enemy]")
    .forEach(
      (button) =>
        (button.onclick = () => select(button.dataset.enemy as EnemyReportId)),
    );
  dialog.querySelector<HTMLButtonElement>("#report-close")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    identification.stop();
    stopVoice();
    voicePlayer.removeAttribute("src");
    voiceOutput.dispose();
    document.removeEventListener("visibilitychange", hideVoice);
    playbackObserver.disconnect();
    viewer?.dispose();
    dialog.remove();
    backgroundMusic().setReport(false);
    options.onClose?.();
  });
  article.textContent = ENEMY_REPORT_INTRO_TEXT;
  identification.enter();
}

