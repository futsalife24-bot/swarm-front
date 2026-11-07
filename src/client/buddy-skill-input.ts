export interface BuddySkillInputActions {
  onActivate(): void;
  onHoldStart?(): void;
  onHoldEnd?(activate: boolean): void;
}

/** A tap and a hold share one release; interrupted gestures never activate. */
export function bindBuddySkillInput(
  button: HTMLButtonElement,
  available: () => boolean,
  actions: BuddySkillInputActions,
) {
  let pointer: number | undefined;
  let key: string | undefined;
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: (() => void)[] = [];
  const listen = <E extends Event>(
    target: EventTarget,
    type: string,
    handler: (e: E) => void,
  ) => {
    const listener = handler as EventListener;
    target.addEventListener(type, listener);
    listeners.push(() => target.removeEventListener(type, listener));
  };
  const suppressKeyClick = () => {
    suppressClick = true;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      suppressClick = false;
    }, 0);
  };
  const finish = (activate: boolean) => {
    if (pointer === undefined && key === undefined) return;
    const captured = pointer;
    if (key !== undefined) suppressKeyClick();
    pointer = undefined;
    key = undefined;
    if (captured !== undefined && button.hasPointerCapture(captured))
      button.releasePointerCapture(captured);
    if (actions.onHoldEnd) actions.onHoldEnd(activate && available());
    else if (activate && available()) actions.onActivate();
  };
  const cancel = () => finish(false);
  listen(button, "pointerdown", (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (!available() || pointer !== undefined || key !== undefined) return;
    pointer = e.pointerId;
    button.setPointerCapture(pointer);
    actions.onHoldStart?.();
  });
  listen(button, "pointerup", (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    finish(true);
  });
  listen(button, "pointermove", (e: PointerEvent) => {
    // Mouse button chords report the primary release as a move, not an up.
    if (
      e.pointerId === pointer &&
      e.pointerType === "mouse" &&
      !(e.buttons & 1)
    )
      finish(true);
  });
  for (const type of ["pointercancel", "lostpointercapture"])
    listen(button, type, (e: PointerEvent) => {
      if (e.pointerId === pointer) cancel();
    });
  listen(button, "keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation(); // Space on this button must not also dodge.
    if (e.repeat || !available() || pointer !== undefined || key !== undefined)
      return;
    suppressClick = true;
    clearTimeout(clickTimer);
    key = e.key;
    actions.onHoldStart?.();
  });
  listen(button, "keyup", (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    suppressKeyClick();
    if (e.key === key) finish(true);
  });
  listen(button, "click", (e: MouseEvent) => {
    e.preventDefault();
    // Pointer and keyboard releases were handled above. Preserve AT clicks.
    if (
      e.detail === 0 &&
      !suppressClick &&
      pointer === undefined &&
      key === undefined &&
      available()
    )
      actions.onActivate();
  });
  listen(button, "contextmenu", (e: Event) => e.preventDefault());
  listen(button, "blur", cancel);
  for (const type of ["blur", "pagehide", "orientationchange"])
    listen(window, type, cancel);
  listen(document, "visibilitychange", () => {
    if (document.hidden) cancel();
  });
  return {
    cancel,
    destroy() {
      cancel();
      clearTimeout(clickTimer);
      listeners.forEach((remove) => remove());
    },
  };
}
