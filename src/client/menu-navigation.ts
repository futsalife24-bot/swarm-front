import { navigateMenu } from "./menu-route";
import "./menu-navigation.css";

const destinations = {
  base: "基地",
  gear: "出撃準備",
  armory: "武器一覧",
  workshop: "工房",
  supply: "補給",
  report: "エネミーレポート",
  settings: "設定・操作",
  title: "タイトル",
} as const;
export type MenuDestination = keyof typeof destinations;

export function readMenuDestination(
  value: string | null,
): MenuDestination | undefined {
  if (value && Object.hasOwn(destinations, value))
    return value as MenuDestination;
}

export function visitCampaignMenu(destination: MenuDestination) {
  navigateMenu(import.meta.env.BASE_URL + "?base=1&menu=" + destination);
}

type MenuNavigation = {
  go: (destination: MenuDestination) => void;
  back: () => void;
  enabled?: (destination: MenuDestination) => boolean;
};

const exitGuards = new WeakMap<Element, (proceed: () => void) => void>();
export function guardMenuExit(
  panel: Element,
  guard: (proceed: () => void) => void,
) {
  exitGuards.set(panel, guard);
}

function openDrawer(
  trigger: HTMLButtonElement,
  current: MenuDestination | undefined,
  options: MenuNavigation,
) {
  const drawer = document.createElement("dialog");
  drawer.className = "menu-navigation-drawer";
  drawer.setAttribute("aria-label", "サイドメニュー");
  drawer.innerHTML =
    '<header><h2>メニュー</h2><button type="button" data-drawer-close aria-label="メニューを閉じる">×</button></header><nav aria-label="主要画面"></nav>';
  const nav = drawer.querySelector("nav")!;
  const close = () => drawer.close();
  for (const [key, label] of Object.entries(destinations)) {
    const destination = key as MenuDestination;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.menuDestination = destination;
    button.textContent = label;
    if (destination === current) button.setAttribute("aria-current", "page");
    if (options.enabled && !options.enabled(destination))
      button.disabled = true;
    button.onclick = () => {
      close();
      if (destination === current) return;
      // Release native modal focus and run each menu's existing cleanup.
      document
        .querySelectorAll<HTMLDialogElement>("dialog[open]")
        .forEach((d) => d.close());
      const proceed = () => options.go(destination);
      const panel = trigger.closest("section");
      const guard = panel && exitGuards.get(panel);
      if (guard) guard(proceed);
      else proceed();
    };
    nav.append(button);
  }
  drawer.querySelector<HTMLButtonElement>("[data-drawer-close]")!.onclick =
    close;
  drawer.addEventListener("click", (event) => {
    const rect = drawer.getBoundingClientRect();
    if (
      event.target === drawer &&
      (event.clientX < rect.left ||
        event.clientY < rect.top ||
        event.clientX >= rect.right ||
        event.clientY >= rect.bottom)
    )
      close();
  });
  let start: Touch | undefined;
  drawer.addEventListener(
    "touchstart",
    (event) => {
      start = event.touches[0];
    },
    { passive: true },
  );
  drawer.addEventListener(
    "touchend",
    (event) => {
      const end = event.changedTouches[0];
      if (
        start &&
        end &&
        start.clientX - end.clientX > 48 &&
        Math.abs(start.clientY - end.clientY) < 48
      )
        close();
      start = undefined;
    },
    { passive: true },
  );
  drawer.addEventListener(
    "close",
    () => {
      trigger.setAttribute("aria-expanded", "false");
      drawer.remove();
    },
    { once: true },
  );
  document.body.append(drawer);
  trigger.setAttribute("aria-expanded", "true");
  drawer.showModal();
}

const existingBack = [
  "#report-close",
  ".dialog-close",
  "#workshop-back",
  "#layout-cancel",
  "#pt-daily-home",
  "#regear",
  "#front-settings-back",
  "#front-dialog-back",
  "#base-back",
  "#front-back",
  "#buddy-back",
  "#pt-genres",
  "#armory-home",
  "#home",
  "#leave-lobby",
  "#front-leave",
].join(",");
const menus = new Set([
  "title",
  "gear",
  "armory",
  "base",
  "buddy",
  "supply",
  "workshop",
  "accessories",
  "growth",
  "prep",
  "rooms",
  "lobby",
  "result",
  "daily-result",
  "settings",
]);

/** Attach to the actual header after a menu renderer replaces its content. */
export function installMenuNavigation(
  ui: HTMLElement,
  options: MenuNavigation,
) {
  let menuContext = false;
  const render = () => {
    const screen = document.body.dataset.screen ?? "";
    // The same layout editor is reachable from settings and from a live battle.
    if (screen !== "layout")
      menuContext =
        menus.has(screen) || !!ui.querySelector(".front-result-panel");
    if (!menuContext || ui.hidden) return;
    const modal = Array.from(
      document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
    ).at(-1);
    if (
      modal &&
      (modal.querySelector(
        "#pt-save-conflict, #pt-save-retry, #pt-export-unsaved",
      ) ||
        !modal.matches(".menu-dialog,.bestiary") ||
        !modal.querySelector(
          ":scope > header > :is(.dialog-close,#report-close)",
        ))
    )
      return;
    const header =
      modal?.querySelector<HTMLElement>(":scope > header") ??
      ui.querySelector<HTMLElement>(
        ":scope > section > header,.result-summary > header,.home-command",
      );
    if (!header || header.classList.contains("menu-navigation-header")) return;
    const current = modal?.matches(".bestiary")
      ? "report"
      : modal?.querySelector("#pt-volume,#volume") ||
          ui.querySelector(".front-settings")
        ? "settings"
        : ui.querySelector(".weapon-workshop")
          ? "workshop"
          : (readMenuDestination(screen) ??
            (screen === "prep" ? "gear" : undefined));
    const source = (modal ?? ui).querySelector<HTMLButtonElement>(existingBack);
    const back = document.createElement("button");
    back.type = "button";
    back.dataset.menuBack = "";
    back.textContent = "‹ 戻る";
    back.setAttribute("aria-label", "戻る");
    back.disabled = !modal && screen === "title" && !source;
    back.onclick = () => (source ? source.click() : options.back());
    const restoreFocus = modal && document.activeElement === source;
    if (source) source.hidden = true;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.menuToggle = "";
    toggle.textContent = "☰";
    toggle.setAttribute("aria-label", "サイドメニューを開く");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.onclick = () => openDrawer(toggle, current, options);
    header.classList.add("menu-navigation-header");
    if (modal && typeof HTMLElement.prototype.showPopover === "function") {
      // A top-layer descendant stays interactive in the native modal without
      // inheriting the dialog's clipping or entrance transform.
      const navigation = document.createElement("div");
      navigation.className = "modal-menu-navigation";
      navigation.popover = "manual";
      navigation.append(back, toggle);
      header.dataset.modalBackLabel = back.textContent;
      header.prepend(navigation);
      navigation.showPopover();
    } else {
      header.prepend(back);
      header.append(toggle);
    }
    if (restoreFocus) back.focus({ preventScroll: true });
  };
  const observer = new MutationObserver(render);
  observer.observe(ui, { childList: true });
  observer.observe(document.body, {
    childList: true,
    attributes: true,
    attributeFilter: ["data-screen"],
  });
  // Native dialogs may enter the top layer after a fullscreen request settles.
  document.addEventListener("toggle", render, true);
  render();
}
