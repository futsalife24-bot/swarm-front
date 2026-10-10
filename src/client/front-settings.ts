import type { Controls } from "./input";
import { menuTrace } from "./menu-effects";
import type { Sound } from "./audio";
import type { Renderer } from "./render";
import {
  LAYOUT_KEY,
  defaultLayout,
  parseLayout,
  placeControls,
  type Layout,
} from "./layout";
import { openLayoutEditor } from "./layout-editor";

export const FRONT_SETTINGS_KEY = "swarm-front-rebuild-settings-v1";
export interface FrontPreferences {
  sensitivity: number;
  fireSensitivity: number;
  gyroEnabled: boolean;
  gyroSensitivity: number;
  volume: number;
  bgmVolume: number;
  seVolume: number;
  quality: number;
  frameRate: 30 | 60;
}
export const defaultFrontPreferences = (): FrontPreferences => ({
  sensitivity: 1,
  fireSensitivity: 1,
  gyroEnabled: false,
  gyroSensitivity: 1,
  volume: 0.35,
  bgmVolume: 1,
  seVolume: 1,
  quality: 1,
  frameRate: 60,
});
export function parseFrontPreferences(raw: string | null): FrontPreferences {
  if (raw === null) return defaultFrontPreferences();
  const p = JSON.parse(raw);
  for (const key of ["sensitivity", "fireSensitivity", "gyroSensitivity"])
    if (!Number.isFinite(p?.[key]) || p[key] < 0.1 || p[key] > 6)
      throw new Error("操作設定が破損しています。");
  for (const key of ["volume", "bgmVolume", "seVolume"])
    if (!Number.isFinite(p?.[key]) || p[key] < 0 || p[key] > 1)
      throw new Error("音量設定が破損しています。");
  if (
    typeof p.gyroEnabled !== "boolean" ||
    ![0.65, 1].includes(p.quality) ||
    ![30, 60].includes(p.frameRate)
  )
    throw new Error("描画・ジャイロ設定が破損しています。");
  return Object.fromEntries(
    Object.keys(defaultFrontPreferences()).map((key) => [key, p[key]]),
  ) as unknown as FrontPreferences;
}

/** 改装版の設定だけを保存する。旧版の所持品・進行キーには書かない。 */
export class FrontSettings {
  opened = false;
  layout: Layout = defaultLayout();
  preferences = defaultFrontPreferences();
  private error = "";
  constructor(
    private controls: Controls,
    private sound: Sound,
    private view: Renderer,
  ) {
    try {
      this.preferences = parseFrontPreferences(
        localStorage.getItem(FRONT_SETTINGS_KEY),
      );
    } catch {
      this.error =
        "設定を読み込めませんでした。元データを残し、初期値で動作しています。";
    }
    try {
      this.layout = parseLayout(localStorage.getItem(LAYOUT_KEY));
    } catch {
      this.error =
        "配置を読み込めませんでした。元データを残し、初期配置で動作しています。";
    }
    this.apply();
  }
  private apply() {
    const p = this.preferences;
    this.controls.sensitivity = p.sensitivity;
    this.controls.fireSensitivity = p.fireSensitivity;
    this.controls.gyroEnabled = p.gyroEnabled;
    this.controls.gyroSensitivity = p.gyroSensitivity;
    this.sound.setVolumes(p.volume, p.bgmVolume, p.seVolume);
    this.view.quality = p.quality;
    this.view.frameRate = p.frameRate;
    this.view.mapAssets.setQuality(p.quality);
    this.view.resize();
    placeControls(this.layout);
  }
  open(root: HTMLElement, onExit: () => void, backLabel = "保存して戻る") {
    this.opened = true;
    document.body.dataset.screen = "battle";
    const p = this.preferences;
    const ranges = [
      ["sensitivity", "視点感度"],
      ["fireSensitivity", "射撃ボタンの視点感度"],
      ["gyroSensitivity", "ジャイロ感度"],
      ["volume", "全体音量"],
      ["bgmVolume", "BGM音量"],
      ["seVolume", "SE音量"],
    ] as const;
    root.innerHTML = `<section class="pause-card rebuild-panel front-settings"><header><h1>設定・操作</h1><button id="front-settings-back">${backLabel}</button></header><div class="front-settings-grid">${ranges
      .map(([key, name]) => {
        const volume = key.toLowerCase().includes("volume");
        return `<label>${name}<input id="front-setting-${key}" type="range" min="${volume ? 0 : 0.1}" max="${volume ? 1 : 6}" step="${volume ? 0.05 : 0.1}" value="${p[key]}"><output></output></label>`;
      })
      .join(
        "",
      )}<label>ジャイロ<button id="front-setting-gyro" role="switch" aria-label="ジャイロ" aria-checked="${p.gyroEnabled}">${p.gyroEnabled ? "オン" : "オフ"}</button></label><label>描画品質<select id="front-setting-quality"><option value="1">標準</option><option value="0.65">軽量</option></select></label><label>描画上限<select id="front-setting-frameRate"><option value="60">60fps</option><option value="30">30fps</option></select></label><button id="front-setting-layout">操作ボタンの配置</button></div><p id="front-settings-status" role="status"></p></section>`;
    const status = root.querySelector<HTMLElement>("#front-settings-status")!;
    status.textContent = this.error || "変更はこの端末に自動保存されます。";
    const write = (next: FrontPreferences) => {
      try {
        localStorage.setItem(FRONT_SETTINGS_KEY, JSON.stringify(next));
        this.preferences = next;
        this.apply();
        this.error = "";
        status.textContent = "設定を保存しました。";
        menuTrace(status, true);
        return true;
      } catch {
        status.textContent =
          "設定を保存できませんでした。変更前の設定で動作しています。";
        return false;
      }
    };
    for (const [key] of ranges) {
      const input = root.querySelector<HTMLInputElement>(
        `#front-setting-${key}`,
      )!;
      const output = input.nextElementSibling!;
      const show = () => {
        output.textContent = key.toLowerCase().includes("volume")
          ? `${Math.round(Number(input.value) * 100)}%`
          : Number(input.value).toFixed(1);
      };
      show();
      input.oninput = () => {
        if (key.toLowerCase().includes("volume")) this.sound.unlock();
        if (!write({ ...this.preferences, [key]: Number(input.value) }))
          input.value = String(this.preferences[key]);
        show();
      };
    }
    for (const key of ["quality", "frameRate"] as const) {
      const input = root.querySelector<HTMLSelectElement>(
        `#front-setting-${key}`,
      )!;
      input.value = String(p[key]);
      input.onchange = () => {
        if (!write({ ...this.preferences, [key]: Number(input.value) }))
          input.value = String(this.preferences[key]);
      };
    }
    const gyro = root.querySelector<HTMLButtonElement>("#front-setting-gyro")!;
    gyro.onclick = async () => {
      const enabled = !this.preferences.gyroEnabled;
      gyro.disabled = true;
      try {
        if (enabled) await this.controls.requestGyro();
        if (write({ ...this.preferences, gyroEnabled: enabled })) {
          gyro.textContent = enabled ? "オン" : "オフ";
          gyro.setAttribute("aria-checked", String(enabled));
        }
      } catch {
        status.textContent =
          "ジャイロを利用できません。端末の対応・許可を確認してください。";
      } finally {
        gyro.disabled = false;
      }
    };
    root.querySelector<HTMLButtonElement>("#front-settings-back")!.onclick =
      () => {
        this.opened = false;
        onExit();
      };
    root.querySelector<HTMLButtonElement>("#front-setting-layout")!.onclick =
      () => {
        document.body.dataset.screen = "layout";
        openLayoutEditor(
          root,
          this.layout,
          (value) => {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(value));
            this.layout = value;
            placeControls(value);
          },
          () => this.open(root, onExit, backLabel),
          {
            config: () => ({}),
            enabled: false,
            disabledReason: "配置を保存して、戦闘に戻って確認できます。",
          },
        );
      };
  }
}
