import "./screen-transition.css";

const mounted = new WeakSet<HTMLElement>();
const menuSelector =
  ".home-command,.menu-screen,.front-settings,.layout-editor,.front-pause,.room-entry,.lobby,.front-lobby,.armory,.result";

// Each band has an inert style scope: the real page never sees copied
// IDs/dialogs, and changing body[data-screen] cannot restyle the outgoing view.
let cachedStyles = "";
let cachedSources: CSSStyleSheet[] = [];
let cachedSheet: CSSStyleSheet | undefined;
function snapshotStyles() {
  const sources = Array.from(document.styleSheets);
  if (
    cachedSheet &&
    sources.length === cachedSources.length &&
    sources.every((sheet, i) => sheet === cachedSources[i])
  )
    return cachedSheet;
  cachedSources = sources;
  const flatten = (sheet: CSSStyleSheet): string => {
    try {
      return Array.from(sheet.cssRules, (rule) => {
        if (rule instanceof CSSImportRule && rule.styleSheet) {
          const imported = flatten(rule.styleSheet);
          return rule.media.mediaText
            ? `@media ${rule.media.mediaText}{${imported}}`
            : imported;
        }
        return rule.cssText;
      }).join("\n");
    } catch {
      return "";
    }
  };
  const css = sources.map(flatten).join("\n").replaceAll(":root", "html");
  if (!cachedSheet || css !== cachedStyles) {
    cachedStyles = css;
    cachedSheet = new CSSStyleSheet();
    cachedSheet.replaceSync(css);
  }
  return cachedSheet;
}
function freeze(source: HTMLElement): HTMLElement {
  const bounds = source.getBoundingClientRect();
  const bottom = Math.min(innerHeight, bounds.bottom),
    top = Math.max(0, bounds.top);
  const originals: HTMLElement[] = [];
  const copies: HTMLElement[] = [];
  const cloneVisible = (node: Node): Node => {
    const clone = node.cloneNode(false);
    if (node instanceof Element) {
      originals.push(node as HTMLElement);
      copies.push(clone as HTMLElement);
    }
    if (node instanceof HTMLElement && node !== source) {
      const rect = node.getBoundingClientRect();
      if (
        (rect.height > 0 && (rect.top >= bottom || rect.bottom <= top)) ||
        node.hidden
      ) {
        const box = clone as HTMLElement;
        Object.assign(box.style, {
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          boxSizing: "border-box",
          overflow: "hidden",
        });
        return box;
      }
    }
    for (const child of node.childNodes) clone.appendChild(cloneVisible(child));
    return clone;
  };
  const copy = cloneVisible(source) as HTMLElement;
  originals.forEach((node, i) => {
    const clone = copies[i]!;
    clone.removeAttribute("autofocus");
    for (const attribute of Array.from(clone.attributes))
      if (attribute.name.startsWith("on"))
        clone.removeAttribute(attribute.name);
    if (node instanceof HTMLMediaElement || node instanceof HTMLIFrameElement) {
      const still = document.createElement("div");
      still.style.width = `${node.clientWidth}px`;
      still.style.height = `${node.clientHeight}px`;
      clone.replaceWith(still);
    }
    if (node instanceof HTMLCanvasElement) {
      try {
        const image = document.createElement("img");
        image.src = node.toDataURL();
        image.style.width = `${node.clientWidth}px`;
        image.style.height = `${node.clientHeight}px`;
        clone.replaceWith(image);
      } catch {
        clone.remove();
      }
    }
    if (node instanceof HTMLInputElement) {
      clone.setAttribute("value", node.value);
      if (node.checked) clone.setAttribute("checked", "");
      else clone.removeAttribute("checked");
    }
    if (node instanceof HTMLSelectElement)
      for (const option of Array.from((clone as HTMLSelectElement).options))
        option.toggleAttribute("selected", option.value === node.value);
    if (node.scrollTop || node.scrollLeft) {
      clone.dataset.shutterTop = String(node.scrollTop);
      clone.dataset.shutterLeft = String(node.scrollLeft);
    }
  });
  return copy;
}

/** Observe navigation without replaying clicks or delaying save/network actions. */
export function mountScreenTransitions(root: HTMLElement) {
  if (mounted.has(root)) return;
  mounted.add(root);
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () =>
    preference.matches ||
    document.documentElement.dataset.menuReducedMotion === "true";
  const supported =
    typeof CSSStyleSheet !== "undefined" &&
    "replaceSync" in CSSStyleSheet.prototype &&
    "adoptedStyleSheets" in ShadowRoot.prototype;
  if (!supported) return;
  // Prepare shared CSS while the accepted title entry is idle, before a tap.
  setTimeout(() => {
    if (!reduced() && !document.hidden) snapshotStyles();
  }, 0);
  let overlay: HTMLElement | undefined;
  let pending: MutationObserver | undefined;
  let active: MutationObserver | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let animations: Animation[] = [];
  const clear = () => {
    pending?.disconnect();
    pending = undefined;
    active?.disconnect();
    active = undefined;
    clearTimeout(expiry);
    animations.forEach((animation) => animation.cancel());
    animations = [];
    overlay?.remove();
    overlay = undefined;
  };
  const currentDialog = () =>
    Array.from(
      document.querySelectorAll<HTMLDialogElement>(
        "dialog[open]:not(.title-entry)",
      ),
    ).at(-1);
  const identity = () => {
    const screen = root.querySelector(menuSelector);
    return `${screen?.className ?? ""}|${root.querySelector("h1")?.textContent ?? ""}`;
  };
  const capture = (event: Event) => {
    // The outgoing picture still covers the destination: never let another
    // activation hit a button the player cannot yet see.
    if (overlay) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    clear();
    if (
      reduced() ||
      document.hidden ||
      document.querySelector(".title-entry") ||
      !root.querySelector(menuSelector)
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    const dialog = currentDialog();
    if (!target || (!root.contains(target) && !dialog?.contains(target)))
      return;
    if (event instanceof KeyboardEvent && event.key !== "Escape") return;
    if (!(event instanceof KeyboardEvent) && !target.closest("button,a"))
      return;
    const button = target.closest("button");
    if (
      button?.matches(
        "[data-front-slot],[data-equip],[data-lock],[data-accessory-equip],[data-accessory-lock],#base-upgrades,#base-fusions,#base-store,#base-load,#front-save-pool,[data-growth-plus],[data-growth-minus]",
      )
    )
      return;
    const before = identity();
    const oldFirst = root.firstElementChild;
    const sheet = snapshotStyles();
    const scene = document.documentElement.cloneNode(false) as HTMLElement;
    const body = document.body.cloneNode(false) as HTMLElement;
    scene.append(body);
    const frozenRoot = freeze(root);
    frozenRoot.querySelectorAll("dialog").forEach((node) => node.remove());
    body.append(frozenRoot);
    if (dialog) {
      const backdrop = document.createElement("div");
      const style = getComputedStyle(dialog, "::backdrop");
      Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        background: style.background,
        backdropFilter: style.backdropFilter,
      });
      body.append(backdrop, freeze(dialog));
    }
    // Native dialogs become static visual surfaces inside the inert shadow.
    for (const native of body.querySelectorAll<HTMLDialogElement>(
      "dialog[open]",
    )) {
      const original = native.id ? document.getElementById(native.id) : dialog;
      if (!original) continue;
      const rect = original.getBoundingClientRect();
      Object.assign(native.style, {
        position: "fixed",
        margin: "0",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        boxSizing: "border-box",
        display: "block",
      });
    }
    const start = () => {
      const nextDialog = currentDialog();
      if (identity() === before && nextDialog === dialog) return;
      // Do not cover a battle or its loading/choice UI.
      if (!root.querySelector(menuSelector)) {
        clear();
        return;
      }
      pending?.disconnect();
      pending = undefined;
      clearTimeout(expiry);
      const layer = document.createElement("div");
      layer.className = "split-shutter";
      layer.setAttribute("aria-hidden", "true");
      layer.inert = true;
      // Share the native top layer without modal/focus/lifecycle side effects.
      layer.setAttribute("popover", "manual");
      document.body.append(layer);
      overlay = layer;
      try {
        layer.showPopover();
      } catch {
        /* Fixed stacking on older browsers. */
      }
      for (let i = 0; i < 6; i++) {
        const strip = document.createElement("div");
        strip.className = "split-shutter-strip";
        strip.style.clipPath = `inset(${(i * 100) / 6}% 0 ${100 - ((i + 1) * 100) / 6}% 0)`;
        const shadow = strip.attachShadow({ mode: "open" });
        shadow.adoptedStyleSheets = [sheet];
        const staticStyle = document.createElement("style");
        staticStyle.textContent =
          "html,body{width:100vw!important;height:100dvh!important;overflow:hidden!important}html{background:#080e13}*,*::before,*::after{animation:none!important;transition:none!important;pointer-events:none!important}dialog{z-index:10000}";
        shadow.append(staticStyle, scene.cloneNode(true));
        layer.append(strip);
        for (const scroll of shadow.querySelectorAll<HTMLElement>(
          "[data-shutter-top]",
        )) {
          scroll.scrollTop = Number(scroll.dataset.shutterTop);
          scroll.scrollLeft = Number(scroll.dataset.shutterLeft);
        }
        animations.push(
          strip.animate(
            [
              { transform: "translateX(0)" },
              { transform: `translateX(${i % 2 ? 102 : -102}%)` },
            ],
            {
              duration: 310,
              delay: 80 + i * 30,
              easing: "cubic-bezier(.65,0,.25,1)",
              fill: "forwards",
            },
          ),
        );
      }
      active = new MutationObserver(() => {
        if (!root.querySelector(menuSelector)) clear();
      });
      active.observe(root, { childList: true });
      expiry = setTimeout(clear, 550);
    };
    pending = new MutationObserver(() => {
      start();
      if (!pending) return;
      document.querySelectorAll("dialog").forEach((node) =>
        pending?.observe(node, {
          attributes: true,
          attributeFilter: ["open"],
        }),
      );
      // Equipment selection/sorting can replace the same screen's entire DOM.
      if (
        root.firstElementChild !== oldFirst &&
        identity() === before &&
        currentDialog() === dialog
      )
        clear();
    });
    pending.observe(root, { childList: true });
    pending.observe(document.body, { childList: true });
    if (dialog)
      pending.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    expiry = setTimeout(clear, 900);
  };
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!overlay) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  document.addEventListener("click", capture, true);
  document.addEventListener("keydown", capture, true);
  window.addEventListener("resize", clear);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  document.addEventListener("fullscreenchange", clear);
  document.addEventListener("swarm-motion-preference", clear);
  preference.addEventListener("change", clear);
}
