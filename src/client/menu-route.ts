import { guardMenuTransitionInput } from "./menu-transition-input";

const ROUTE_KEY = "swarm-front-menu-route-v1";
const REDUCED_KEY = "swarm-front-menu-reduced-motion-v1";
const LIFETIME = 8000;

/** Keep navigation immediate; only the destination's presentation is staged. */
export function navigateMenu(url: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ROUTE_KEY);
    const destination = new URL(url, location.href);
    if (destination.origin === location.origin)
      sessionStorage.setItem(
        ROUTE_KEY,
        JSON.stringify({
          href: destination.href,
          expires: Date.now() + LIFETIME,
        }),
      );
  } catch {
    // Storage restrictions must never prevent the original navigation.
  }
  location.href = url;
}

function revealMenuRoute() {
  let ticket: { href?: unknown; expires?: unknown } | null;
  try {
    const value = sessionStorage.getItem(ROUTE_KEY);
    sessionStorage.removeItem(ROUTE_KEY);
    ticket = value ? JSON.parse(value) : null;
  } catch {
    return;
  }
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (
    !ticket ||
    ticket.href !== location.href ||
    typeof ticket.expires !== "number" ||
    ticket.expires <= Date.now() ||
    ticket.expires > Date.now() + LIFETIME ||
    (navigation && navigation.type !== "navigate")
  )
    return;

  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => {
    let stored = false;
    try {
      stored = localStorage.getItem(REDUCED_KEY) === "true";
    } catch {
      // The current document preference still applies without storage.
    }
    return (
      preference.matches ||
      document.documentElement.dataset.menuReducedMotion === "true" ||
      stored
    );
  };
  if (document.hidden || reduced()) return;
  let layer: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const animations: Animation[] = [];
  const releaseInputGuard = guardMenuTransitionInput(() => !!layer);
  const clear = () => {
    observer.disconnect();
    clearTimeout(timer);
    animations.forEach((animation) => animation.cancel());
    layer?.remove();
    layer = undefined;
    releaseInputGuard();
    document.removeEventListener("visibilitychange", clear);
    document.removeEventListener("swarm-motion-preference", clear);
    preference.removeEventListener("change", clear);
    window.removeEventListener("pagehide", clear);
    window.removeEventListener("resize", clear);
    document.removeEventListener("fullscreenchange", clear);
  };
  const reveal = () => {
    if (document.hidden || reduced()) {
      clear();
      return;
    }
    if (
      !document.querySelector(
        "#ui :is(.menu-screen,.home-command,.front-settings,.room-entry,.lobby,.front-lobby)",
      )
    )
      return;
    observer.disconnect();
    clearTimeout(timer);
    layer = document.createElement("div");
    releaseInputGuard.captureHeld();
    layer.className = "menu-route-shutter";
    layer.inert = true;
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647";
    document.body.append(layer);
    for (let i = 0; i < 6; i++) {
      const strip = document.createElement("div");
      strip.style.cssText = `position:absolute;left:0;right:0;top:${(i * 100) / 6}%;height:calc(100% / 6 + 1px);background:#080e13;pointer-events:none`;
      layer.append(strip);
      if (!strip.animate) {
        clear();
        return;
      }
      animations.push(
        strip.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${i % 2 ? 102 : -102}%)` },
          ],
          {
            duration: 310,
            delay: 80 + i * 30,
            easing: "cubic-bezier(.65,0,.25,1)",
            fill: "forwards",
          },
        ),
      );
    }
    timer = setTimeout(clear, 550);
  };
  const observer = new MutationObserver(reveal);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("visibilitychange", clear);
  document.addEventListener("swarm-motion-preference", clear);
  preference.addEventListener("change", clear);
  window.addEventListener("pagehide", clear);
  window.addEventListener("resize", clear);
  document.addEventListener("fullscreenchange", clear);
  timer = setTimeout(clear, Math.max(0, ticket.expires - Date.now()));
  reveal();
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  revealMenuRoute();
