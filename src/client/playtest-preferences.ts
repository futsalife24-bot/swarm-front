import { fresh, parseSave, SAVE_KEY, type Save } from "./save";
import type { Controls } from "./input";
import type { Sound } from "./audio";
import type { Renderer } from "./render";
import type { Minimap } from "./minimap";

const KEY = "swarm-front-playtest-preferences-v1";
type Preferences = Pick<
  Save,
  | "volume"
  | "bgmVolume"
  | "seVolume"
  | "sensitivity"
  | "fireSensitivity"
  | "gyroEnabled"
  | "gyroSensitivity"
  | "quality"
  | "frameRate"
  | "mapRotates"
  | "damageNumbers"
>;
const pick = (s: Save): Preferences => ({
  volume: s.volume,
  bgmVolume: s.bgmVolume ?? 1,
  seVolume: s.seVolume ?? 1,
  sensitivity: s.sensitivity,
  fireSensitivity: s.fireSensitivity ?? s.sensitivity,
  gyroEnabled: s.gyroEnabled ?? false,
  gyroSensitivity: s.gyroSensitivity ?? 1,
  quality: s.quality,
  frameRate: s.frameRate ?? 60,
  mapRotates: s.mapRotates ?? false,
  damageNumbers: s.damageNumbers ?? "self",
});
export function createPlaytestPreferences(
  controls: Controls,
  sound: Sound,
  view: Renderer,
  minimap: Minimap,
) {
  let value = pick(fresh()),
    loadError = "";
  try {
    const raw = localStorage.getItem(KEY);
    value = raw
      ? pick(parseSave(JSON.stringify({ ...fresh(), ...JSON.parse(raw) })))
      : pick(parseSave(localStorage.getItem(SAVE_KEY)));
  } catch {
    loadError = "保存済みの設定を読めなかったため、初期設定で表示しています。";
  }
  const apply = () => {
    controls.sensitivity = value.sensitivity;
    controls.fireSensitivity = value.fireSensitivity ?? value.sensitivity;
    controls.gyroEnabled = value.gyroEnabled === true;
    controls.gyroSensitivity = value.gyroSensitivity ?? 1;
    sound.setVolumes(value.volume, value.bgmVolume, value.seVolume);
    view.quality = value.quality;
    view.frameRate = value.frameRate ?? 60;
    view.mapAssets.setQuality(value.quality);
    view.damageNumbers = value.damageNumbers ?? "self";
    minimap.rotates = value.mapRotates === true;
    view.resize();
  };
  apply();
  return {
    snapshot: () => ({ ...value }),
    mount(d: HTMLDialogElement, editLayout: () => void) {
      const body = d.querySelector(".menu-dialog-body")!;
      const existing = [...body.children];
      const displayValue = (key: keyof Preferences, level: unknown) =>
        ["volume", "bgmVolume", "seVolume"].includes(key)
          ? `${Math.round(Number(level) * 100)}%`
          : String(level);
      const range = (
        key: keyof Preferences,
        label: string,
        min = 0.1,
        max = 6,
        step = 0.1,
      ) =>
        `<label class="setting-row"><span class="setting-name">${label}</span><span class="setting-control"><input data-preference="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${value[key]}"><output>${displayValue(key, value[key])}</output></span></label>`;
      body.innerHTML = `<p class="settings-status" role="status"></p><div class="settings-content settings-columns"><section id="settings-preferences" aria-labelledby="preferences-heading"><h3 id="preferences-heading">環境設定</h3>${range("sensitivity", "視点感度")}${range("fireSensitivity", "射撃ボタンの視点感度")}<label class="setting-row"><span class="setting-name">ジャイロ</span><span class="setting-control"><button id="pt-gyro" role="switch" aria-checked="${value.gyroEnabled}">${value.gyroEnabled ? "オン" : "オフ"}</button></span></label>${range("gyroSensitivity", "ジャイロ感度")}${range("volume", "全体音量", 0, 1, 0.05)}${range("bgmVolume", "BGM音量", 0, 1, 0.05)}${range("seVolume", "SE音量", 0, 1, 0.05)}<label class="setting-row"><span class="setting-name">描画品質</span><span class="setting-control"><select data-preference="quality"><option value="1">標準</option><option value="0.65">軽量</option></select></span></label><label class="setting-row"><span class="setting-name">描画上限</span><span class="setting-control"><select data-preference="frameRate" aria-label="描画上限"><option value="60">60fps（なめらか）</option><option value="30">30fps（省電力）</option></select></span></label><label class="setting-row"><span class="setting-name">ミニマップ</span><span class="setting-control"><select data-preference="mapRotates"><option value="false">北を上に固定</option><option value="true">視点に合わせて回す</option></select></span></label><label class="setting-row"><span class="setting-name">ダメージ表示</span><span class="setting-control"><select data-preference="damageNumbers"><option value="self">自分のみ</option><option value="all">味方も表示</option><option value="off">表示しない</option></select></span></label><button id="pt-layout">操作ボタンの配置</button></section><section id="settings-save" aria-labelledby="save-heading"><h3 id="save-heading">メニュー</h3></section></div>`;
      const status = d.querySelector(".settings-status")!;
      status.textContent = loadError || "変更はこの端末に自動保存されます。";
      const savePanel = d.querySelector("#settings-save")!;
      // Preserve the existing save export and development-only test entry handlers.
      for (const element of existing) {
        if (element.querySelector("#pt-volume,#pt-quality")) {
          element.setAttribute("hidden", "");
        }
        savePanel.append(element);
      }
      const update = (next: Preferences) => {
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
          value = next;
          apply();
          status.textContent = "設定を保存しました。";
          return true;
        } catch {
          status.textContent =
            "設定を保存できませんでした。変更前の設定を維持しています。";
          return false;
        }
      };
      d.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-preference]",
      ).forEach((el) => {
        const key = el.dataset.preference as keyof Preferences;
        el.value = String(value[key]);
        el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
          const next =
            key === "mapRotates"
              ? el.value === "true"
              : key === "damageNumbers"
                ? (el.value as Preferences["damageNumbers"])
                : Number(el.value);
          if (!update({ ...value, [key]: next })) el.value = String(value[key]);
          const output = el.parentElement?.querySelector("output");
          if (output) output.textContent = displayValue(key, el.value);
        });
      });
      const gyro = d.querySelector<HTMLButtonElement>("#pt-gyro")!;
      gyro.onclick = async () => {
        try {
          if (!value.gyroEnabled) await controls.requestGyro();
          update({ ...value, gyroEnabled: !value.gyroEnabled });
        } catch (e) {
          status.textContent = (e as Error).message;
        }
        gyro.setAttribute("aria-checked", String(value.gyroEnabled));
        gyro.textContent = value.gyroEnabled ? "オン" : "オフ";
      };
      d.querySelector<HTMLButtonElement>("#pt-layout")!.onclick = editLayout;
    },
  };
}
