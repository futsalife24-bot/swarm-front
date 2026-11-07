/** Add a hold shortcut to existing result-name buttons, without taking over tap,
 * keyboard activation, lock buttons or native scrolling. */
export const REWARD_DETAIL_HOLD_MS = 500;
const MOVE_TOLERANCE = 8;

export function bindRewardWeaponDetails(
  root: HTMLElement,
  open: (id: string) => void,
): () => void {
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-detail]"),
  ];
  const owner = root.ownerDocument;
  const view = owner.defaultView!;
  let active: {
    button: HTMLButtonElement;
    id: number;
    x: number;
    y: number;
  } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suppressed: HTMLButtonElement | null = null;
  let stopWatching = () => {};
  const finish = (suppress: boolean) => {
    if (suppress && active) suppressed = active.button;
    active = null;
    clearTimeout(timer);
    timer = undefined;
    stopWatching();
    stopWatching = () => {};
  };
  const buttonFor = (target: EventTarget | null) => {
    const button = (target as Element | null)?.closest?.<HTMLButtonElement>(
      "[data-detail]",
    );
    return button && buttons.includes(button) ? button : null;
  };
  const down = (event: PointerEvent) => {
    const button = buttonFor(event.target);
    if (!button || button.disabled || !event.isPrimary || event.button !== 0)
      return;
    finish(true);
    suppressed = null;
    active = {
      button,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    const cancel = () => finish(true);
    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      if (
        Math.hypot(e.clientX - active.x, e.clientY - active.y) > MOVE_TOLERANCE
      )
        cancel();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === active?.id) finish(false);
    };
    const interrupted = (e: PointerEvent) => {
      if (e.pointerId === active?.id) cancel();
    };
    const anotherPointer = (e: PointerEvent) => {
      if (e.pointerId !== active?.id) cancel();
    };
    view.addEventListener("pointermove", move, true);
    view.addEventListener("pointerup", up, true);
    view.addEventListener("pointercancel", interrupted, true);
    view.addEventListener("pointerdown", anotherPointer, true);
    view.addEventListener("blur", cancel);
    view.addEventListener("pagehide", cancel);
    view.addEventListener("resize", cancel);
    view.addEventListener("keydown", cancel, true);
    owner.addEventListener("visibilitychange", cancel);
    owner.addEventListener("scroll", cancel, true);
    button.addEventListener("pointerleave", cancel);
    stopWatching = () => {
      view.removeEventListener("pointermove", move, true);
      view.removeEventListener("pointerup", up, true);
      view.removeEventListener("pointercancel", interrupted, true);
      view.removeEventListener("pointerdown", anotherPointer, true);
      view.removeEventListener("blur", cancel);
      view.removeEventListener("pagehide", cancel);
      view.removeEventListener("resize", cancel);
      view.removeEventListener("keydown", cancel, true);
      owner.removeEventListener("visibilitychange", cancel);
      owner.removeEventListener("scroll", cancel, true);
      button.removeEventListener("pointerleave", cancel);
    };
    timer = setTimeout(() => {
      const pressed = active?.button;
      finish(true);
      if (
        !pressed?.isConnected ||
        pressed.disabled ||
        owner.hidden ||
        owner.querySelector("dialog[open]")
      )
        return;
      // Native menuDialog restores focus to its trigger on Escape/Close.
      pressed.focus({ preventScroll: true });
      open(pressed.dataset.detail!);
    }, REWARD_DETAIL_HOLD_MS);
  };
  const click = (event: MouseEvent) => {
    // Keyboard and assistive activation (detail=0) keep the native button path.
    if (
      event.detail !== 0 &&
      buttonFor(event.target) === suppressed &&
      suppressed
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressed = null;
    }
  };
  const context = (event: MouseEvent) => {
    if (buttonFor(event.target)) event.preventDefault();
  };
  for (const button of buttons) {
    button.dataset.rewardDetailHold = "true";
    button.setAttribute("aria-haspopup", "dialog");
    button.title = "長押しで武器詳細（クリック・Enterでも表示）";
  }
  root.addEventListener("pointerdown", down);
  root.addEventListener("click", click, true);
  root.addEventListener("contextmenu", context);
  return () => {
    finish(false);
    suppressed = null;
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("click", click, true);
    root.removeEventListener("contextmenu", context);
  };
}
