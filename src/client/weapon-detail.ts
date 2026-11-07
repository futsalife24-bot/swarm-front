import { WEAPONS, effectLabel, stats } from "../shared/defs";
import {
  type StoredWeapon,
  weaponGrade,
  weaponStatVariance,
  varianceClass,
  varianceMark,
} from "../shared/progression";
import { lockMarkup } from "./gear-weapon-list";
import { menuDialog } from "./menu-ui";
import "./weapon-detail.css";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** 全武器・全入口で同じ実数値と同レア基準差を使用する。装備比較はしない。 */
export function weaponDetailStats(w: StoredWeapon) {
  const d = stats(w);
  const rows = [
    [
      "power",
      "威力",
      `${d.damage.toFixed(0)}${d.pellets > 1 ? ` × ${d.pellets}` : ""}`,
    ],
    ["mag", "装弾", String(d.mag)],
    ["reload", "装填秒", d.reload.toFixed(2)],
    ["range", "射程m", d.range.toFixed(1)],
    ["rate", "連射/秒", (1 / d.interval).toFixed(2)],
  ] as const;
  return `<table><thead><tr><th>性能</th><th>実数値</th><th>同レア基準差</th></tr></thead><tbody>${rows
    .map(([key, label, value]) => {
      const variance = weaponStatVariance(w, key);
      return `<tr><th>${label}</th><td class="pt-var-${varianceClass(variance)}">${value}<sup>${varianceMark(variance)}</sup></td><td>${w.format === 2 && key === "mag" ? "固定" : `${w.format === 2 ? "" : "約"}${variance >= 0 ? "+" : ""}${Number(variance.toFixed(3))}%`}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

export interface WeaponDetailOptions {
  dialog?: (title: string, content: string) => HTMLDialogElement;
  locked: boolean;
  lockDisabled?: boolean;
  note?: string;
  onLock: (dialog: HTMLDialogElement) => void | Promise<void>;
  onShare?: () => void | Promise<void>;
}

/** 既存の画像・性能・ロック・共有を一つのネイティブdialogへ集約する。 */
export function openWeaponDetail(
  w: StoredWeapon,
  options: WeaponDetailOptions,
) {
  const makeDialog =
    options.dialog ?? ((title, body) => menuDialog(title, body, "SWARM FRONT"));
  const d = makeDialog(
    `${esc(WEAPONS[w.kind].name)} / ${weaponGrade(w)}`,
    `<div class="weapon-detail-layout"><div class="weapon-detail-visual"><div id="pt-weapon-preview" aria-label="${esc(WEAPONS[w.kind].name)}の3D画像"></div><p class="weapon-detail-effect">${esc(effectLabel(w))}</p></div><div class="weapon-detail-data"><div id="pt-comparison">${weaponDetailStats(w)}</div><p class="weapon-detail-help">同種・同レアの標準性能との差。装填は速度換算、特殊効果は除外。</p><p class="weapon-detail-note" ${options.note ? "" : "hidden"}>${esc(options.note ?? "")}</p><div class="weapon-detail-actions"><button type="button" id="pt-detail-lock" aria-pressed="${options.locked}" ${options.lockDisabled ? "disabled" : ""}>${lockMarkup(options.locked, true)}</button><button type="button" id="pt-share">共有</button></div><p class="weapon-detail-error" role="alert" hidden></p></div></div>`,
  );
  d.classList.add("weapon-detail-dialog");
  const error = d.querySelector<HTMLElement>(".weapon-detail-error")!;
  const handle = async (
    button: HTMLButtonElement,
    action: () => void | Promise<void>,
  ) => {
    if (button.disabled) return;
    button.disabled = true;
    error.hidden = true;
    try {
      await action();
    } catch (e) {
      error.textContent =
        (e as Error).message || "操作を完了できませんでした。";
      error.hidden = false;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
  const lock = d.querySelector<HTMLButtonElement>("#pt-detail-lock")!;
  lock.onclick = () => void handle(lock, () => options.onLock(d));
  const share = d.querySelector<HTMLButtonElement>("#pt-share")!;
  share.onclick = () =>
    void handle(
      share,
      options.onShare ??
        (async () => {
          const { shareImage } = await import("./weapon-sharing");
          await shareImage(w);
        }),
    );
  const host = d.querySelector<HTMLElement>("#pt-weapon-preview")!;
  void import("./weapon-sharing")
    .then((m) => m.previewWeapon(host, w))
    .then((dispose) => {
      if (!d.isConnected) dispose();
      else d.addEventListener("close", dispose, { once: true });
    })
    .catch(() => {
      if (host.isConnected)
        host.textContent = "3D画像を読み込めませんでした。性能は確認できます。";
    });
  return d;
}
