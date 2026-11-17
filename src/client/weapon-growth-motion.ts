import "./weapon-growth-motion.css";
import { getMenuReducedMotion } from "./menu-effects";

const reduced = () =>
  getMenuReducedMotion() ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function connectDetailMotion(
  row: HTMLElement,
  dialog: HTMLDialogElement,
) {
  const heading = dialog.querySelector<HTMLElement>("header h2");
  const close = dialog.querySelector<HTMLButtonElement>(".dialog-close");
  if (!heading || !close) return;
  let flight: Animation | undefined;
  let closing = false;
  const animate = (reverse: boolean) => {
    flight?.cancel();
    if (reduced()) {
      return dialog.animate(
        reverse
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 0 }, { opacity: 1 }],
        100,
      );
    }
    const source = row.getBoundingClientRect();
    const destination = heading.getBoundingClientRect();
    const tile = document.createElement("div");
    tile.className = "weapon-row-flight";
    tile.setAttribute("aria-hidden", "true");
    const title = document.createElement("span");
    title.textContent = heading.textContent;
    tile.append(title);
    // The modal lives outside the list's themed subtree. Freeze the tapped
    // row's rendered typography and grid so the shared element starts intact.
    const snapshot = row.cloneNode(true) as HTMLElement;
    snapshot.inert = true;
    const originals = [row, ...row.querySelectorAll<HTMLElement>("*")];
    [snapshot, ...snapshot.querySelectorAll<HTMLElement>("*")].forEach(
      (copy, index) => {
        const style = getComputedStyle(originals[index]);
        for (const property of [
          "display",
          "width",
          "height",
          "grid-template-columns",
          "align-items",
          "justify-content",
          "gap",
          "padding",
          "background",
          "color",
          "border",
          "box-sizing",
          "font",
          "text-align",
          "overflow",
          "white-space",
        ]) {
          copy.style.setProperty(property, style.getPropertyValue(property));
        }
        copy.removeAttribute("id");
      },
    );
    Object.assign(snapshot.style, {
      position: "absolute",
      inset: "0 auto auto 0",
      margin: "0",
      transformOrigin: "top left",
      transform: `scale(${destination.width / Math.max(1, source.width)},${destination.height / Math.max(1, source.height)})`,
    });
    tile.append(snapshot);
    tile.popover = "manual";
    Object.assign(tile.style, {
      left: destination.left + "px",
      top: destination.top + "px",
      width: destination.width + "px",
      height: destination.height + "px",
    });
    dialog.append(tile);
    tile.showPopover?.();
    const start = {
      transform: `translate(${source.left - destination.left}px,${source.top - destination.top}px) scale(${source.width / Math.max(1, destination.width)},${source.height / Math.max(1, destination.height)})`,
    };
    const end = { transform: "none" };
    snapshot.animate(
      reverse
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: 300,
        easing: "ease-out",
        fill: "both",
      },
    );
    const motion = tile.animate(reverse ? [end, start] : [start, end], {
      duration: 300,
      easing: "cubic-bezier(.18,.78,.22,1)",
    });
    motion.finished.then(
      () => tile.remove(),
      () => tile.remove(),
    );
    return motion;
  };
  const frame = requestAnimationFrame(() => {
    if (!dialog.open || closing) return;
    // The shared heading supplies the entrance, so the generic modal slide must
    // not establish a transformed containing block for the flying element.
    dialog.getAnimations().forEach((animation) => animation.cancel());
    flight = animate(false);
  });
  const back = () => {
    if (closing) return;
    closing = true;
    flight = animate(true);
    flight.finished.then(
      () => dialog.close(),
      () => {},
    );
  };
  close.onclick = back;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    back();
  });
  dialog.addEventListener(
    "close",
    () => {
      cancelAnimationFrame(frame);
      flight?.cancel();
    },
    { once: true },
  );
}

export function showGrowthResult(
  host: HTMLElement,
  oldLevel: number,
  level: number,
  oldDamage: number,
  damage: number,
  capped: boolean,
) {
  const result = document.createElement("button");
  result.type = "button";
  result.className = "workshop-growth-result";
  result.setAttribute(
    "aria-label",
    `強化完了、レベル${level}、威力${damage.toFixed(1)}。結果を閉じる`,
  );
  result.innerHTML = `<strong>${capped ? "上限到達" : "強化完了"}</strong><span data-ticker></span><small>タップで閉じる</small>`;
  const ticker = result.querySelector<HTMLElement>("[data-ticker]")!;
  const paint = (t: number) => {
    ticker.textContent = `↑ Lv${Math.round(oldLevel + (level - oldLevel) * t)}　↑ 威力 ${(oldDamage + (damage - oldDamage) * t).toFixed(1)}`;
  };
  host.append(result);
  result.focus({ preventScroll: true });
  let frame = 0;
  result.onclick = () => {
    cancelAnimationFrame(frame);
    result.remove();
    (
      host.querySelector<HTMLButtonElement>("#workshop-level:not(:disabled)") ??
      document.querySelector<HTMLSelectElement>("#workshop-weapon")
    )?.focus({ preventScroll: true });
  };
  if (reduced()) {
    paint(1);
    return;
  }
  paint(0);
  const start = performance.now();
  const tick = (now: number) => {
    if (!result.isConnected) return;
    const t = Math.min(1, (now - start) / 600);
    paint(1 - (1 - t) ** 2);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  const count = capped ? 22 : 10;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("i");
    particle.setAttribute("aria-hidden", "true");
    const angle = (i * Math.PI * 2) / count;
    const x = Math.cos(angle) * (capped ? 100 : 45);
    const y = Math.sin(angle) * (capped ? 38 : 24);
    if (capped) {
      particle.className = "confetti";
      particle.style.backgroundColor = ["#ffe498", "#8fe4ca", "#9ebfff"][i % 3];
    }
    result.append(particle);
    particle
      .animate(
        [
          { transform: "scale(.4)", opacity: 0 },
          {
            transform: `translate(${x * 0.85}px,${y - 9}px) scale(1.3)`,
            opacity: 1,
            offset: 0.42,
          },
          {
            transform: `translate(${x}px,${y + (capped ? 45 : 3)}px) rotate(${i * 40}deg) scale(.7)`,
            opacity: 0,
          },
        ],
        { duration: capped ? 1000 : 400, easing: "ease-out" },
      )
      .finished.then(() => particle.remove());
  }
}
