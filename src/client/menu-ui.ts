import { showModalAfterFullscreen } from "./landscape";

/** A dialog awaiting fullscreen has no native close event until it is open. */
export function closeMenuDialog(dialog: HTMLDialogElement) {
  if (!dialog.isConnected) return;
  if (dialog.open) dialog.close();
  else dialog.dispatchEvent(new Event("close"));
  // menuDialog's close listener removes the node, cancels its queued show,
  // disconnects observers and runs the caller's normal resource cleanup.
}

/** Shared, native modal: Escape, focus containment and return focus are browser managed. */
export function menuDialog(
  title: string,
  content: string,
  eyebrow = "FIELD MANUAL",
) {
  const trigger = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog");
  dialog.className = "menu-dialog";
  dialog.setAttribute("aria-labelledby", "menu-dialog-title");
  dialog.innerHTML = `<header><div><div class="eyebrow">${eyebrow}</div><h2 id="menu-dialog-title">${title}</h2></div><button type="button" class="dialog-close" aria-label="閉じる" autofocus>閉じる ×</button></header><div class="menu-dialog-body" tabindex="0">${content}</div>`;
  dialog.querySelector<HTMLButtonElement>(".dialog-close")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  document.body.append(dialog);
  showModalAfterFullscreen(dialog);
  const guide = document.createElement("div");
  guide.className = "reading-guide";
  guide.textContent = "続きは上下にスクロール ↕";
  dialog.append(guide);
  const body = dialog.querySelector<HTMLElement>(".menu-dialog-body")!;
  const update = () => {
    guide.hidden = body.scrollHeight <= body.clientHeight + 1;
    guide.textContent =
      body.scrollTop + body.clientHeight >= body.scrollHeight - 2
        ? "末尾まで表示しました · 上に戻る ↑"
        : "続きは上下にスクロール ↕";
  };
  const resize = new ResizeObserver(update);
  resize.observe(body);
  const changed = new MutationObserver(update);
  changed.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  body.addEventListener("scroll", update, { passive: true });
  dialog.addEventListener("close", () => {
    resize.disconnect();
    changed.disconnect();
  });
  return dialog;
}

const paths = {
  sortie:
    '<path d="m5 19 5-9 9-5-5 9-9 5Z"/><path d="m10 10 4 4M3 3h5M3 3v5m18 13h-5m5 0v-5"/>',
  squad:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2"/>',
  armory: '<path d="M4 7h16v13H4zM8 7V4h8v3M4 12h16m-10 0v3h4v-3"/>',
  report: '<path d="M6 3h12v18H6zM9 7h6m-6 4h6m-6 4h3"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6m8 0v6M9 15v6"/>',
} as const;
export function menuIcon(name: keyof typeof paths) {
  return `<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

/** Keep list position and keyboard focus when the same menu updates its DOM. */
export function restoreMenuPosition(
  root: HTMLElement,
  selector: string,
  top: number,
  focus?: string,
) {
  const list = root.querySelector(selector);
  if (list) list.scrollTop = top;
  if (focus)
    root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
}
