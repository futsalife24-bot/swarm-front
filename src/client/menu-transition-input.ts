type InputGuard = { sources: Set<() => boolean>; captureHeld: () => void };
const guards = new WeakMap<Document, InputGuard>();

/** Finish swallowing gestures that began behind a shutter, even after it closes. */
export function guardMenuTransitionInput(active: () => boolean) {
  let guard = guards.get(document);
  if (!guard) {
    guard = { sources: new Set(), captureHeld: () => {} };
    guards.set(document, guard);
    const sources = guard.sources;
    const pointers = new Set<number>();
    const keys = new Set<string>();
    const downKeys = new Set<string>();
    const downPointers = new Set<number>();
    guard.captureHeld = () => {
      downKeys.forEach((key) => keys.add(key));
      downPointers.forEach((id) => pointers.add(id));
    };
    document.defaultView?.addEventListener("blur", () => {
      downKeys.clear();
      downPointers.clear();
    });
    const releasedPointers = new Map<number, ReturnType<typeof setTimeout>>();
    let releasedKey = false;
    const blocked = () => [...sources].some((source) => source());
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const forgetPointer = (id: number) => {
      pointers.delete(id);
      clearTimeout(releasedPointers.get(id));
      releasedPointers.delete(id);
    };
    document.addEventListener(
      "pointerdown",
      (event) => {
        // A fresh press also recovers from a missing release after focus loss.
        forgetPointer(event.pointerId);
        downPointers.add(event.pointerId);
        if (!blocked()) return;
        pointers.add(event.pointerId);
        stop(event);
      },
      true,
    );
    document.addEventListener(
      "pointerup",
      (event) => {
        downPointers.delete(event.pointerId);
        if (!pointers.delete(event.pointerId)) return;
        stop(event);
        releasedPointers.set(
          event.pointerId,
          setTimeout(() => {
            releasedPointers.delete(event.pointerId);
          }, 1000),
        );
      },
      true,
    );
    document.addEventListener(
      "pointercancel",
      (event) => {
        downPointers.delete(event.pointerId);
        if (pointers.has(event.pointerId)) stop(event);
        forgetPointer(event.pointerId);
      },
      true,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        const key = event.code || event.key;
        downKeys.add(key);
        if (!event.repeat) {
          keys.delete(key);
          releasedKey = false;
        }
        if (!blocked() && !keys.has(key)) return;
        keys.add(key);
        stop(event);
      },
      true,
    );
    document.addEventListener(
      "keyup",
      (event) => {
        downKeys.delete(event.code || event.key);
        if (!keys.delete(event.code || event.key)) return;
        stop(event);
        releasedKey = true;
        // Space's default click is dispatched as part of keyup.
        setTimeout(() => {
          releasedKey = false;
        }, 0);
      },
      true,
    );
    document.addEventListener(
      "click",
      (event) => {
        const id = (event as PointerEvent).pointerId;
        const pointerGesture =
          pointers.has(id) ||
          releasedPointers.has(id) ||
          (id === undefined && event.detail > 0 && releasedPointers.size > 0);
        const keyGesture = event.detail === 0 && (keys.size > 0 || releasedKey);
        if (!blocked() && !pointerGesture && !keyGesture) return;
        stop(event);
        if (pointerGesture) forgetPointer(id);
      },
      true,
    );
  }
  guard.sources.add(active);
  // Keep the document's shared guard until tracked gestures have ended.
  // Removing a source never throws away a held pointer/key.
  return Object.assign(
    () => {
      guard.sources.delete(active);
    },
    {
      captureHeld: guard.captureHeld,
    },
  );
}
