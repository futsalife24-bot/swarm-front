import type { MockStore } from "./storage";
import type { MockOrientation } from "./orientation";
import type { Controls } from "../input";
export interface MockSettings {
  sensitivity: number;
  fireSensitivity: number;
  gyroEnabled: boolean;
  gyroSensitivity: number;
  volume: number;
  bgmVolume: number;
  seVolume: number;
  quality: 0.65 | 1;
  frameRate: 30 | 60;
  mapRotates: boolean;
  damageNumbers: "self" | "all" | "off";
}
export const DEFAULT_SETTINGS: MockSettings = {
  sensitivity: 1,
  fireSensitivity: 1,
  gyroEnabled: false,
  gyroSensitivity: 1,
  volume: 0.35,
  bgmVolume: 1,
  seVolume: 1,
  quality: 1,
  frameRate: 60,
  mapRotates: false,
  damageNumbers: "self",
};
export function readSettings(store: MockStore): MockSettings {
  const raw = store.read<Partial<MockSettings>>("settings", {}),
    result = { ...DEFAULT_SETTINGS };
  for (const key of [
    "sensitivity",
    "fireSensitivity",
    "gyroSensitivity",
  ] as const)
    if (Number.isFinite(raw[key]) && raw[key]! >= 0.1 && raw[key]! <= 6)
      result[key] = raw[key]!;
  for (const key of ["volume", "bgmVolume", "seVolume"] as const)
    if (Number.isFinite(raw[key]) && raw[key]! >= 0 && raw[key]! <= 1)
      result[key] = raw[key]!;
  for (const key of ["gyroEnabled", "mapRotates"] as const)
    if (typeof raw[key] === "boolean") result[key] = raw[key]!;
  if (raw.quality === 0.65) result.quality = 0.65;
  if (raw.frameRate === 30) result.frameRate = 30;
  if (raw.damageNumbers === "all" || raw.damageNumbers === "off")
    result.damageNumbers = raw.damageNumbers;
  return result;
}
export function mountSettings(
  root: HTMLElement,
  settings: MockSettings,
  store: MockStore,
  orientation: MockOrientation,
  controls: Controls,
  actions: {
    back: () => void;
    layout: () => void;
    pv: () => void;
    changed: () => void;
  },
) {
  root.innerHTML = `<section class="mock-page mock-settings"><header><button id="settings-back">戻る</button><h1>設定 <small>モック専用</small></h1></header><div id="orientation-setting"></div><button id="settings-fullscreen">全画面で遊ぶ</button><button id="settings-layout">ボタン配置・試し撃ち</button><button id="settings-pv">PVを見る</button><div id="settings-fields"></div><p id="settings-status" role="status"></p></section>`;
  const fields = root.querySelector("#settings-fields")!,
    status = root.querySelector("#settings-status")!;
  const ranges = [
    ["sensitivity", "照準の感度", 0.1, 6],
    ["fireSensitivity", "射撃中の感度", 0.1, 6],
    ["gyroSensitivity", "ジャイロの感度", 0.1, 6],
    ["volume", "全体の音量", 0, 1],
    ["bgmVolume", "BGMの音量", 0, 1],
    ["seVolume", "効果音の音量", 0, 1],
  ] as const;
  fields.innerHTML =
    ranges
      .map(
        ([key, label, min, max]) =>
          `<label>${label}<input data-setting="${key}" type="range" min="${min}" max="${max}" step="0.05" value="${settings[key]}"><output>${settings[key]}</output></label>`,
      )
      .join("") +
    `<label>画質<select data-setting="quality"><option value="1">標準</option><option value="0.65">軽量</option></select></label><label>描画速度<select data-setting="frameRate"><option value="60">60 fps</option><option value="30">30 fps</option></select></label><label>ダメージ表示<select data-setting="damageNumbers"><option value="self">自分</option><option value="all">全員</option><option value="off">なし</option></select></label><label><input type="checkbox" data-setting="mapRotates">ミニマップを回転</label><label><input type="checkbox" data-setting="gyroEnabled">ジャイロ照準</label>`;
  const save = () => {
    actions.changed();
    status.textContent = store.write("settings", settings)
      ? "モックの設定を保存しました。"
      : "保存できませんでした。このタブ内でのみ適用しています。";
  };
  fields
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")
    .forEach((input) => {
      const key = input.dataset.setting as keyof MockSettings;
      if (input instanceof HTMLInputElement && input.type === "checkbox")
        input.checked = settings[key] === true;
      else input.value = String(settings[key]);
      input.onchange = async () => {
        if (key === "gyroEnabled") {
          const checkbox = input as HTMLInputElement;
          if (checkbox.checked)
            try {
              await controls.requestGyro();
            } catch {
              checkbox.checked = false;
              status.textContent =
                "ジャイロを利用できません。端末の許可とHTTPS接続をご確認ください。";
              return;
            }
        }
        const value =
          input instanceof HTMLInputElement && input.type === "checkbox"
            ? input.checked
            : key === "damageNumbers"
              ? input.value
              : Number(input.value);
        Object.assign(settings, { [key]: value });
        const output = input.parentElement?.querySelector("output");
        if (output) output.textContent = String(value);
        save();
      };
    });
  root.querySelector<HTMLElement>("#settings-back")!.onclick = actions.back;
  root.querySelector<HTMLElement>("#settings-layout")!.onclick = actions.layout;
  root.querySelector<HTMLElement>("#settings-pv")!.onclick = actions.pv;
  root.querySelector<HTMLElement>("#settings-fullscreen")!.onclick = () =>
    void orientation.fullscreen();
  return orientation.mount(
    root.querySelector<HTMLElement>("#orientation-setting")!,
  );
}
