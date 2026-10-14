// A browser can classify a second click after the short touch guard expires.
// Keep that sequence's ownership on this root until a fresh click/key action.
const entryClicks = new WeakSet<HTMLElement>();

export function rememberTitleEntryClick(root: HTMLElement) {
  entryClicks.add(root);
}

export function consumeTitleEntryClick(root: HTMLElement, event: MouseEvent) {
  if (!entryClicks.has(root)) return false;
  if (event.detail > 1) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  entryClicks.delete(root);
  return false;
}

/** Keep the modal input boundary until the gesture that opened it is released. */
export function titleEntryInputGate(target: Window, release: () => void) {
  const keys = new Set<string>();
  const pointers = new Set<number>();
  let settling = false;
  let done = false;
  let pointerUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    clearTimeout(timer);
    if (!settling || done || keys.size || pointers.size) return;
    const remaining = pointerUntil - performance.now();
    if (remaining > 0) {
      timer = setTimeout(check, remaining);
      return;
    }
    done = true;
    target.removeEventListener("keydown", keydown, { capture: true });
    target.removeEventListener("keyup", keyup, { capture: true });
    target.removeEventListener("pointerdown", pointerdown, { capture: true });
    target.removeEventListener("pointerup", pointerup, { capture: true });
    target.removeEventListener("pointercancel", pointerup, { capture: true });
    target.removeEventListener("blur", interrupt);
    release();
  };
  const activationKey = (key: string) => ["Enter", " ", "Escape"].includes(key);
  const keydown = (event: KeyboardEvent) => {
    if (!activationKey(event.key)) return;
    keys.add(event.key);
    if (settling) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const keyup = (event: KeyboardEvent) => {
    if (!activationKey(event.key)) return;
    keys.delete(event.key);
    if (settling) {
      // In particular, Space must not activate the newly focused menu button.
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    check();
  };
  const pointerdown = (event: PointerEvent) => {
    pointers.add(event.pointerId);
    clearTimeout(timer);
  };
  const pointerup = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    // Also absorb the second tap/click when reduced motion reveals the menu now.
    pointerUntil = performance.now() + 400;
    check();
  };
  const interrupt = () => {
    keys.clear();
    pointers.clear();
    pointerUntil = 0;
    check();
  };
  target.addEventListener("keydown", keydown, { capture: true });
  target.addEventListener("keyup", keyup, { capture: true });
  target.addEventListener("pointerdown", pointerdown, { capture: true });
  target.addEventListener("pointerup", pointerup, { capture: true });
  target.addEventListener("pointercancel", pointerup, { capture: true });
  target.addEventListener("blur", interrupt);
  return {
    settle() {
      settling = true;
      check();
    },
    interrupt,
  };
}
