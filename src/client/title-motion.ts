/** Title entry only: presentation observes the existing actions, never delays them. */
const mounted = new WeakMap<HTMLElement, () => void>();

export function mountTitleMotion(root: HTMLElement) {
  const existing = mounted.get(root);
  if (existing) return existing();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Set<Animation>();
  let pressed: HTMLButtonElement | null = null;
  let heldKey = "";
  let returnId = "";
  let keyboardReturn = false;
  let departed = false;
  let observer: MutationObserver | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let accent: HTMLElement | null = null;
  let lastActivated: HTMLButtonElement | null = null;
  const isHome = () => !!root.querySelector(".home-command");
  const buttonFor = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "button",
    );
    return isHome() &&
      button &&
      root.contains(button) &&
      !button.disabled &&
      !document.querySelector("dialog[open]")
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
    for (const animation of animations) animation.cancel();
    animations.clear();
    accent?.remove();
    accent = null;
  };
  const animate = (
    element: HTMLElement,
    frames: Keyframe[],
    duration = 190,
  ) => {
    if (reduced.matches || document.hidden || !element.animate) return;
    const animation = element.animate(frames, {
      duration,
      easing: "cubic-bezier(.2,.75,.25,1)",
    });
    animations.add(animation);
    animation.onfinish = animation.oncancel = () =>
      animations.delete(animation);
  };
  const enter = (element: HTMLElement) =>
    animate(element, [
      { opacity: 0.78, transform: "translateY(7px)" },
      { opacity: 1, transform: "translateY(0)" },
    ]);
  const refresh = () => {
    if (!departed) return;
    cancel();
    departed = false;
    root.querySelectorAll<HTMLElement>(".title,.home-command").forEach(enter);
    if (keyboardReturn && returnId) {
      root.querySelector<HTMLButtonElement>(`#${CSS.escape(returnId)}`)?.focus({
        preventScroll: true,
      });
    }
    keyboardReturn = false;
  };
  mounted.set(root, refresh);
  root.addEventListener("pointerdown", (event) => {
    const button = buttonFor(event);
    if (!button || event.button !== 0) return;
    release();
    pressed = button;
    button.classList.add("title-pressed");
  });
  root.addEventListener("focusout", release);
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
      const button = buttonFor(event);
      if (!button) return;
      if (event.detail > 1 && button === lastActivated) {
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
      const from = button.getBoundingClientRect();
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
        enter(destination);
        if (reduced.matches || document.hidden) return;
        const to = destination.getBoundingClientRect();
        if (from.width <= 0 || to.width <= 0) return;
        accent = document.createElement("span");
        accent.className = "title-motion-accent";
        accent.setAttribute("aria-hidden", "true");
        Object.assign(accent.style, {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
        });
        document.body.append(accent);
        const line = accent;
        animate(
          line,
          [
            { opacity: 0.85, transform: "translate(0,0) scaleX(1)" },
            {
              opacity: 0.45,
              offset: 0.65,
              transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scaleX(${to.width / from.width})`,
            },
            {
              opacity: 0,
              transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scaleX(${to.width / from.width})`,
            },
          ],
          210,
        );
        setTimeout(() => {
          line.remove();
          if (accent === line) accent = null;
        }, 220);
      });
      observer.observe(root, { childList: true });
      observer.observe(document.body, { childList: true });
      expiry = setTimeout(stopWatching, 900);
    },
    true,
  );
}
