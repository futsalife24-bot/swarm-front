import {
  OPERATION_CUE_ASSETS,
  type OperationCueKind,
} from "./operation-cue-assets";
import { getMenuReducedMotion, menuMotion } from "./menu-effects";
import "./operation-cue.css";
let cancel = () => {};
export const cancelOperationCue = () => cancel();
/** Optional reviewed assets; overlays never lock combat input or delay navigation. */
export function showOperationCue(kind: OperationCueKind) {
  cancel();
  if (document.hidden) return;
  const labels: Record<OperationCueKind, string> = {
    sortie: "出撃",
    return: "撤収完了",
    end: "戦闘終了",
    clear: "ステージクリア",
  };
  const node = document.createElement("aside");
  node.className = "operation-cue";
  node.setAttribute("role", "status");
  const label = document.createElement("strong");
  label.textContent = labels[kind];
  node.append(label);
  const assets = OPERATION_CUE_ASSETS[kind];
  const reduced =
    getMenuReducedMotion() ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    navigator.hardwareConcurrency <= 4;
  if (assets) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = reduced ? assets.still : assets.animated;
    image.onerror = () => image.remove();
    node.prepend(image);
  }
  const skip = document.createElement("button");
  skip.textContent = "スキップ";
  skip.onclick = cancelOperationCue;
  node.append(skip);
  document.body.append(node);
  const stop = menuMotion(
    label,
    [
      { opacity: 0, transform: "translateY(-8px)" },
      { opacity: 1, transform: "translateY(0)", offset: 0.2 },
      { opacity: 1, transform: "translateY(0)", offset: 0.75 },
      { opacity: 0, transform: "translateY(-4px)" },
    ],
    1000,
  );
  const timer = setTimeout(() => {
    node.remove();
  }, 1100);
  cancel = () => {
    stop();
    clearTimeout(timer);
    node.remove();
  };
  window.dispatchEvent(
    new CustomEvent("swarm:operation-cue", { detail: { kind } }),
  );
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelOperationCue();
  });
  document.addEventListener("swarm-motion-preference", cancelOperationCue);
}
