import "./title-entry.css";
import { titleEntryInputGate } from "./title-entry-input";
import { waitForFullscreenTransition } from "./landscape";

let shown = false;

/** A single entry per document; direct operation/invitation links keep their route. */
export function mountTitleEntry(root: HTMLElement) {
  if (shown) return;
  shown = true;
  const query = new URL(location.href).searchParams;
  if (["solo", "coop", "frontRoom", "room"].some((key) => query.has(key)))
    return;
  const logo = root.querySelector<SVGElement>(".title-logo svg");
  if (!logo) return;

  const entry = document.createElement("dialog");
  entry.className = "title-entry";
  entry.setAttribute("aria-label", "SWARM FRONT タイトル");
  const button = document.createElement("button");
  button.className = "title-entry-start";
  button.setAttribute("aria-label", "SWARM FRONT はじめる");
  const mark = document.createElement("span");
  mark.className = "title-entry-mark";
  mark.append(logo.cloneNode(true));
  const dot = document.createElement("span");
  dot.className = "title-entry-dot";
  dot.setAttribute("aria-hidden", "true");
  button.append(mark, dot);
  entry.append(button);
  document.body.append(entry);
  const portrait = matchMedia("(orientation: portrait)");
  if (!portrait.matches) entry.showModal();
  let starting = false;
  let closed = false;
  let waitingFullscreen = false;
  const animations = new Set<Animation>();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const input = titleEntryInputGate(window, () => {
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("fullscreenchange", promote);
    portrait.removeEventListener("change", orientation);
    entry.close();
    entry.remove();
    root
      .querySelector<HTMLButtonElement>("#solo")
      ?.focus({ preventScroll: true });
  });
  const finish = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    for (const animation of animations) animation.cancel();
    animations.clear();
    window.removeEventListener("resize", interrupt);
    reduced.removeEventListener("change", interrupt);
    document.removeEventListener("swarm-motion-preference", interrupt);
    // Reveal the menu immediately, but retain the transparent modal until the
    // initiating key/gesture is released so input cannot leak into that menu.
    entry.style.opacity = "0";
    input.settle();
  };
  const interrupt = () => {
    if (starting && !waitingFullscreen) finish();
  };
  const visibility = () => {
    if (document.hidden) {
      input.interrupt();
      if (starting) finish();
    }
  };
  const promote = () => {
    if (portrait.matches || !entry.isConnected) return;
    // Fullscreen reorders the top layer even when the dialog was already open.
    if (entry.open) entry.close();
    entry.inert = false;
    entry.showModal();
  };
  const orientation = () => {
    if (portrait.matches) {
      if (entry.open) entry.close();
      entry.inert = true;
      input.interrupt();
      if (starting) finish();
    } else {
      promote();
    }
  };
  const animate = (
    element: HTMLElement,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => {
    const animation = element.animate(frames, options);
    animations.add(animation);
    return animation.finished;
  };
  const start = async () => {
    if (starting || closed) return;
    starting = true;
    button.setAttribute("aria-disabled", "true");
    timeout = setTimeout(finish, 1400);
    try {
      waitingFullscreen = true;
      await waitForFullscreenTransition();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      waitingFullscreen = false;
      if (closed) return;
      if (portrait.matches) {
        orientation();
        return;
      }
      promote();
      clearTimeout(timeout);
      timeout = setTimeout(finish, 1400);
      if (
        reduced.matches ||
        document.documentElement.dataset.menuReducedMotion === "true" ||
        !entry.animate
      ) {
        finish();
        return;
      }
      const box = mark.getBoundingClientRect();
      // Artwork coordinates: dot centre (2704, 2431), crop (469,1580,2322,937).
      const x = box.left + box.width * (2235 / 2322);
      const y = box.top + box.height * (851 / 937);
      const radius = box.width * (64 / 2322);
      const farthest = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y),
      );
      Object.assign(dot.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${radius * 2}px`,
        height: `${radius * 2}px`,
        marginLeft: `${-radius}px`,
        marginTop: `${-radius}px`,
        opacity: "1",
      });
      await animate(
        dot,
        [
          { transform: "scale(1)" },
          { transform: `scale(${(farthest + 4) / radius})` },
        ],
        {
          duration: 680,
          easing: "cubic-bezier(.65,0,.2,1)",
          fill: "forwards",
        },
      );
      await animate(entry, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 240,
        easing: "ease-out",
        fill: "forwards",
      });
    } catch {
      // Animation cancellation must never leave an unresponsive entry screen.
    } finally {
      finish();
    }
  };
  button.onclick = () => void start();
  button.onkeydown = (event) => {
    entry.classList.add("title-entry-keyboard");
    if (event.repeat) event.preventDefault();
  };
  button.onpointerdown = () => entry.classList.remove("title-entry-keyboard");
  entry.addEventListener("cancel", (event) => {
    event.preventDefault();
    void start();
  });
  window.addEventListener("resize", interrupt);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("fullscreenchange", promote);
  portrait.addEventListener("change", orientation);
  reduced.addEventListener("change", interrupt);
  document.addEventListener("swarm-motion-preference", interrupt);
}
