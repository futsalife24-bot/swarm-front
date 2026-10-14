import { mountScreenTransitions } from "./screen-transition";
import { mountTitleEntry } from "./title-entry";
import { consumeTitleEntryClick } from "./title-entry-input";

/** Title entry only: presentation observes the existing actions, never delays them. */
const mounted = new WeakMap<HTMLElement, () => void>();
const pending = new WeakMap<HTMLElement, number>();

/** Retain the decision guard until the actual action settles, not a motion timer. */
export function trackTitleAction<T>(root: HTMLElement, action: () => T): T {
  pending.set(root, (pending.get(root) ?? 0) + 1);
  const done = () =>
    pending.set(root, Math.max(0, (pending.get(root) ?? 1) - 1));
  try {
    const result = action();
    if (result instanceof Promise) return result.finally(done) as T;
    done();
    return result;
  } catch (error) {
    done();
    throw error;
  }
}

export function mountTitleMotion(root: HTMLElement) {
  mountTitleEntry(root);
  mountScreenTransitions(root);
  const existing = mounted.get(root);
  if (existing) return existing();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let pressed: HTMLButtonElement | null = null;
  let heldKey = "";
  let returnId = "";
  let keyboardReturn = false;
  let departed = false;
  let observer: MutationObserver | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let lastActivated: HTMLButtonElement | null = null;
  const wrapped = new WeakSet<HTMLButtonElement>();
  const wrapActions = () => {
    root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const action = button.onclick;
      if (!action || wrapped.has(button)) return;
      wrapped.add(button);
      button.onclick = function (event) {
        return trackTitleAction(root, () => action.call(this, event));
      };
    });
  };
  const isHome = () => !!root.querySelector(".home-command");
  const buttonFor = (event: Event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button")
        : null;
    return isHome() && button && root.contains(button) && !button.disabled
      ? button
      : null;
  };
  const release = () => {
    pressed?.classList.remove("title-pressed");
    pressed = null;
  };
  const stopWatching = () => {
    observer?.disconnect();
    observer = null;
    clearTimeout(expiry);
  };
  const cancel = () => {
    stopWatching();
    release();
  };
  const refresh = () => {
    wrapActions();
    if (!departed) return;
    cancel();
    departed = false;
    if (keyboardReturn && returnId) {
      root.querySelector<HTMLButtonElement>(`#${CSS.escape(returnId)}`)?.focus({
        preventScroll: true,
      });
    }
    keyboardReturn = false;
  };
  mounted.set(root, refresh);
  wrapActions();
  root.addEventListener("pointerdown", (event) => {
    const button = buttonFor(event);
    if (!button || event.button !== 0) return;
    release();
    pressed = button;
    button.classList.add("title-pressed");
  });
  root.addEventListener("focusout", (event) => {
    if (event.target === pressed) release();
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", () => {
    heldKey = "";
    cancel();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      heldKey = "";
      cancel();
    }
  });
  reduced.addEventListener("change", cancel);
  document.addEventListener("swarm-motion-preference", cancel);
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (heldKey === event.key && event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const button = buttonFor(event);
      if (!button) return;
      heldKey = event.key;
      pressed = button;
      button.classList.add("title-pressed");
    },
    true,
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (event.key === heldKey) {
        heldKey = "";
        release();
      }
    },
    true,
  );
  root.addEventListener(
    "click",
    (event) => {
      if (consumeTitleEntryClick(root, event)) return;
      const button = buttonFor(event);
      if (!button) return;
      if (
        (pending.get(root) ?? 0) > 0 ||
        document.querySelector("dialog.menu-dialog,dialog[open]") ||
        (event.detail > 1 && button === lastActivated)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastActivated = button;
      const oldContent = root.firstElementChild;
      returnId = button.id;
      keyboardReturn = event.detail === 0;
      cancel();
      // Observe only this activation, not the battle loop or every UI mutation.
      observer = new MutationObserver(() => {
        // Fullscreen-safe dialogs may open after their insertion microtask.
        document.querySelectorAll("dialog:not([open])").forEach((dialog) =>
          observer?.observe(dialog, {
            attributes: true,
            attributeFilter: ["open"],
          }),
        );
        const dialog =
          document.querySelector<HTMLDialogElement>("dialog[open]");
        const changed = root.firstElementChild !== oldContent;
        const destination = dialog ?? (changed ? root.firstElementChild : null);
        if (!(destination instanceof HTMLElement)) return;
        stopWatching();
        departed = changed;
      });
      observer.observe(root, { childList: true });
      observer.observe(document.body, { childList: true });
      expiry = setTimeout(stopWatching, 900);
    },
    true,
  );
}
