import { menuMotion } from "./menu-effects";
import "./screen-transition.css";

const mounted = new WeakSet<HTMLElement>();

/** Watch only screen replacement at the UI root. Battle HUD updates stay untouched. */
export function mountScreenTransitions(root: HTMLElement) {
  if (mounted.has(root)) return;
  mounted.add(root);
  let cancel: Array<() => void> = [];
  const clear = () => {
    for (const stop of cancel) stop();
    cancel = [];
    root
      .querySelectorAll(
        ":scope > .menu-screen .screen-transition-line, :scope > .front-settings .screen-transition-line",
      )
      .forEach((line) => line.remove());
  };
  const observer = new MutationObserver((records) => {
    if (!records.some((record) => record.target === root)) return;
    clear();
    const screen = root.querySelector<HTMLElement>(
      ":scope > .menu-screen, :scope > .front-settings",
    );
    if (!screen) return;
    cancel.push(
      menuMotion(
        screen,
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        260,
      ),
    );
    const heading = screen.querySelector<HTMLElement>("h1,h2");
    if (heading)
      cancel.push(
        menuMotion(
          heading,
          [
            { opacity: 0.55, transform: "translateX(-10px)" },
            { opacity: 1, transform: "translateX(0)" },
          ],
          300,
        ),
      );
    const header = screen.querySelector<HTMLElement>(".menu-header,header");
    if (!header) return;
    const line = document.createElement("span");
    line.className = "screen-transition-line";
    line.setAttribute("aria-hidden", "true");
    header.append(line);
    cancel.push(
      menuMotion(
        line,
        [
          { opacity: 0.9, transform: "scaleX(0)" },
          { opacity: 0.85, transform: "scaleX(1)", offset: 0.65 },
          { opacity: 0, transform: "scaleX(1)" },
        ],
        460,
        () => line.remove(),
        1,
        { easing: "linear" },
      ),
    );
  });
  observer.observe(root, { childList: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener("change", clear);
  document.addEventListener("swarm-motion-preference", clear);
}
