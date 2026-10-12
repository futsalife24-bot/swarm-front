import {
  OPERATION_CUE_ASSETS,
  OPERATION_CUE_IDS,
  OPERATION_CUE_LABELS,
  operationCuePlan,
  type OperationCueKind,
  type OperationCueSources,
} from "./operation-cue-assets";
import { getMenuReducedMotion } from "./menu-effects";
import "./operation-cue.css";
interface CueOptions {
  key?: string;
}
interface RendererOptions {
  sources?: OperationCueSources;
  mobile?: () => boolean;
  lowPower?: () => boolean;
  reduced?: () => boolean;
  off?: () => boolean;
}
/** Decorative image and independent timers; no caller waits to save or navigate. */
export function createOperationCueRenderer(options: RendererOptions = {}) {
  let serial = 0;
  const seen = new Set<string>();
  type Entry = {
    token: number;
    id: OperationCueKind;
    key: string;
    node: HTMLElement;
    caption: HTMLElement;
    skip: HTMLButtonElement;
    abort: AbortController;
    timers: Set<ReturnType<typeof setTimeout>>;
    animations: Set<Animation>;
    image?: HTMLImageElement;
    load: number;
    format: "apng" | "png";
    variant: "standard" | "mobile";
  };
  let active: Entry | undefined;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const profile = () => ({
    mobile:
      options.mobile?.() ??
      (innerWidth < 960 || matchMedia("(pointer: coarse)").matches),
    lowPower:
      options.lowPower?.() ??
      (navigator.hardwareConcurrency <= 4 ||
        ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          8) <= 4),
    reduced: options.reduced?.() ?? reducedQuery.matches,
    off: options.off?.() ?? getMenuReducedMotion(),
  });
  function cancel() {
    const entry = active;
    active = undefined;
    serial++;
    if (!entry) return;
    entry.abort.abort();
    for (const timer of entry.timers) clearTimeout(timer);
    for (const animation of entry.animations) animation.cancel();
    if (entry.image) {
      entry.image.onload = entry.image.onerror = null;
      entry.image.removeAttribute("src");
    }
    entry.node.remove();
    entry.skip.remove();
  }
  const valid = (entry: Entry) =>
    active === entry && !entry.abort.signal.aborted && entry.token === serial;
  function schedule(entry: Entry, ms: number, action: () => void) {
    const timer = setTimeout(
      () => {
        entry.timers.delete(timer);
        if (valid(entry)) action();
      },
      Math.max(0, ms),
    );
    entry.timers.add(timer);
  }
  function animateOpacity(
    entry: Entry,
    element: Element,
    frames: Keyframe[],
    duration: number,
  ) {
    if (!valid(entry) || !element.animate || profile().off) return;
    const animation = element.animate(frames, {
      duration,
      fill: "forwards",
      easing: "linear",
    });
    entry.animations.add(animation);
    animation.onfinish = animation.oncancel = () =>
      entry.animations.delete(animation);
  }
  function loadImage(entry: Entry, format: "apng" | "png", fallback = false) {
    const source = (options.sources ?? OPERATION_CUE_ASSETS)[entry.id]?.[
      entry.variant
    ];
    if (!source) return;
    entry.format = format;
    entry.load++;
    const load = entry.load;
    if (entry.image) {
      entry.image.onload = entry.image.onerror = null;
      entry.image.removeAttribute("src");
      entry.image.remove();
    }
    const image = document.createElement("img");
    entry.image = image;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.decoding = "async";
    image.width = entry.variant === "mobile" ? 640 : 960;
    image.height = entry.variant === "mobile" ? 224 : 336;
    entry.node.classList.remove("is-loaded");
    entry.node.classList.add("has-image");
    image.onload = () => {
      if (valid(entry) && entry.load === load)
        entry.node.classList.add("is-loaded");
    };
    image.onerror = () => {
      if (!valid(entry) || entry.load !== load) return;
      if (format === "apng" && !fallback) loadImage(entry, "png", true);
      else {
        image.remove();
        entry.node.classList.remove("has-image", "is-loaded");
      }
    };
    entry.node.prepend(image);
    image.src = source[format];
  }
  function show(id: OperationCueKind, { key }: CueOptions = {}) {
    if (!OPERATION_CUE_IDS.includes(id) || document.hidden) return false;
    const eventKey = key ?? `event-${serial + 1}`;
    if (seen.has(eventKey)) return false;
    cancel();
    seen.add(eventKey);
    if (seen.size > 128) seen.delete(seen.values().next().value!);
    const plan = operationCuePlan(id, profile());
    const node = document.createElement("aside");
    node.className = "operation-cue";
    node.dataset.event = id;
    const caption = document.createElement("strong");
    caption.textContent = OPERATION_CUE_LABELS[id];
    caption.setAttribute("role", "status");
    caption.setAttribute("aria-live", "polite");
    caption.setAttribute("aria-atomic", "true");
    node.append(caption);
    // A regular control is outside the entirely pointer-transparent visual layer.
    const skip = document.createElement("button");
    skip.className = "operation-cue-skip";
    skip.textContent = "演出をスキップ";
    skip.onclick = cancel;
    skip.hidden = true;
    const entry: Entry = {
      token: serial,
      id,
      key: eventKey,
      node,
      caption,
      skip,
      abort: new AbortController(),
      timers: new Set(),
      animations: new Set(),
      load: 0,
      format: plan.format,
      variant: plan.variant,
    };
    active = entry;
    document.body.append(node, skip);
    // Put the optional control in normal menu flow. Battle input stays untouched;
    // opening its existing pause control cancels the cue instead.
    schedule(entry, 0, () => {
      if (document.body.dataset.screen === "battle" && id.endsWith("sortie"))
        return;
      const host = document.querySelector(
        "#ui header nav, #ui header, #ui .home-utilities",
      );
      if (host) {
        host.append(skip);
        skip.hidden = false;
      }
    });
    loadImage(entry, plan.format);
    if (plan.fadeMs && entry.image) {
      const image = entry.image;
      animateOpacity(
        entry,
        image,
        [{ opacity: 0 }, { opacity: 1 }],
        plan.fadeMs,
      );
      schedule(entry, plan.durationMs - plan.fadeMs, () =>
        animateOpacity(
          entry,
          image,
          [{ opacity: 1 }, { opacity: 0 }],
          plan.fadeMs,
        ),
      );
    }
    schedule(entry, plan.durationMs, cancel);
    window.dispatchEvent(
      new CustomEvent("swarm:operation-cue", {
        detail: { eventId: id, key: eventKey },
      }),
    );
    return true;
  }
  const preferenceChanged = () => {
    const entry = active;
    if (!entry) return;
    const next = operationCuePlan(entry.id, profile());
    if (next.format !== "png") return;
    for (const animation of entry.animations) animation.cancel();
    if (entry.format !== "png") loadImage(entry, "png");
    // Keep the original deadline and caption; no second announcement.
  };
  const hidden = () => {
    if (document.hidden) cancel();
  };
  document.addEventListener("visibilitychange", hidden);
  document.addEventListener("swarm-motion-preference", preferenceChanged);
  reducedQuery.addEventListener("change", preferenceChanged);
  window.addEventListener("pagehide", cancel);
  return {
    show,
    cancel,
    destroy() {
      cancel();
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener(
        "swarm-motion-preference",
        preferenceChanged,
      );
      reducedQuery.removeEventListener("change", preferenceChanged);
      window.removeEventListener("pagehide", cancel);
    },
  };
}
let renderer: ReturnType<typeof createOperationCueRenderer> | undefined;
export const cancelOperationCue = () => renderer?.cancel();
export function showOperationCue(id: OperationCueKind, options?: CueOptions) {
  renderer ??= createOperationCueRenderer();
  return renderer.show(id, options);
}
