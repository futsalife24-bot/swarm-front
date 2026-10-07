import "./menu-effects.css";

// NANKA DEKIRU's expressions adapted to the existing menus, without new libraries.
// Presentation never waits on an effect, changes saved values, or handles input.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const running = new Map<Animation, { owner: Element; cancel: () => void }>();
let watching = false;
const detached = new MutationObserver(() => {
  for (const { owner, cancel } of running.values())
    if (!owner.isConnected) cancel();
});
const stop = () => {
  for (const { cancel } of running.values()) cancel();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
reduced.addEventListener("change", () => {
  if (reduced.matches) stop();
});
export function menuMotion(
  element: Element | null,
  frames: Keyframe[],
  duration = 360,
  cleanup = () => {},
  iterations = 1,
) {
  if (!element?.isConnected || reduced.matches || document.hidden) {
    cleanup();
    return () => {};
  }
  if (running.size >= 96) running.values().next().value?.cancel();
  const animation = element.animate(frames, {
    duration,
    iterations,
    easing: "cubic-bezier(.2,.75,.25,1)",
  });
  if (!watching) {
    detached.observe(document.body, { childList: true, subtree: true });
    watching = true;
  }
  let cleaned = false;
  const done = () => {
    if (cleaned) return;
    cleaned = true;
    running.delete(animation);
    cleanup();
    if (!running.size) {
      detached.disconnect();
      watching = false;
    }
  };
  const cancel = () => {
    animation.cancel();
    done();
  };
  running.set(animation, { owner: element, cancel });
  animation.onfinish = animation.oncancel = done;
  return cancel;
}

export function menuGlow(element: Element | null) {
  menuMotion(
    element,
    [
      { filter: "brightness(1)" },
      { filter: "brightness(1.45)", offset: 0.3 },
      { filter: "brightness(1)" },
    ],
    420,
  );
}

export function menuShine(host: HTMLElement | null) {
  if (!host) return;
  const node = layer(host, "shine");
  const beam = document.createElement("i");
  node.append(beam);
  menuMotion(
    beam,
    [{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }],
    540,
  );
  menuMotion(node, [{ opacity: 1 }, { opacity: 1 }], 560, () => node.remove());
}

export function menuEquip(
  root: HTMLElement,
  target: HTMLElement | null,
  source?: DOMRect,
) {
  if (!target) return;
  menuTrace(target);
  menuGlow(target);
  if (!source) return;
  const bounds = root.getBoundingClientRect(),
    end = target.getBoundingClientRect();
  const node = layer(root, "equip");
  node.innerHTML = `<svg viewBox="0 0 ${bounds.width} ${bounds.height}"><path pathLength="1" d="M${source.x + source.width / 2 - bounds.x} ${source.y + source.height / 2 - bounds.y}L${end.x + end.width / 2 - bounds.x} ${end.y + end.height / 2 - bounds.y}"/></svg>`;
  menuMotion(
    node.querySelector("path"),
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    280,
  );
  menuMotion(node, [{ opacity: 0.8 }, { opacity: 0 }], 450, () =>
    node.remove(),
  );
}

function layer(host: HTMLElement, kind: string) {
  // Absolute decorations have no layout area, no focus and no pointer hitbox.
  host.classList.add("menu-fx-host");
  host.querySelectorAll(":scope > .menu-fx-layer").forEach((e) => e.remove());
  const node = document.createElement("span");
  node.className = `menu-fx-layer menu-fx-${kind}`;
  node.setAttribute("aria-hidden", "true");
  host.append(node);
  return node;
}

/** S12 line draw, also used for the saved confirmation check. */
export function menuTrace(host: HTMLElement | null, check = false) {
  if (!host) return;
  const node = layer(host, check ? "check" : "trace");
  node.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path pathLength="1" d="${check ? "M28 50L44 68L76 32" : "M2 50V2H98V98H2V50"}"/></svg>`;
  const path = node.querySelector("path")!;
  menuMotion(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 380);
  menuMotion(
    node,
    [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
    700,
    () => node.remove(),
  );
}

/** T01: particles form an accessory silhouette; the real item remains readable. */
export function menuAssemble(host: HTMLElement | null) {
  if (!host) return;
  const node = layer(host, "particles");
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement("i");
    const angle = (i * Math.PI) / 8;
    node.append(dot);
    menuMotion(
      dot,
      [
        {
          transform: `translate(${Math.cos(angle) * 68}px,${Math.sin(angle) * 40}px)`,
          opacity: 0,
        },
        { opacity: 1, offset: 0.25 },
        {
          transform: `translate(${Math.cos(angle) * 13}px,${Math.sin(angle) * 13}px)`,
          opacity: 1,
          offset: 0.75,
        },
        {
          transform: `translate(${Math.cos(angle) * 13}px,${Math.sin(angle) * 13}px)`,
          opacity: 0,
        },
      ],
      620,
    );
  }
  menuMotion(node, [{ opacity: 1 }, { opacity: 1 }], 650, () => node.remove());
  menuGlow(host);
}

/** P19 + S14: light flows to the wallet; final numbers are never overwritten. */
export function menuReward(host: HTMLElement | null) {
  if (!host) return;
  const node = layer(host, "reward");
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement("i");
    node.append(dot);
    menuMotion(
      dot,
      [
        {
          transform: `translate(${-60 - i * 5}px,${((i % 3) - 1) * 12}px)`,
          opacity: 0,
        },
        { opacity: 1, offset: 0.2 },
        { transform: "translate(0,0)", opacity: 0 },
      ],
      480 + i * 18,
    );
  }
  menuMotion(node, [{ opacity: 1 }, { opacity: 1 }], 650, () => node.remove());
  host.querySelectorAll("strong,b,.resource-value").forEach((value) =>
    menuMotion(
      value,
      [
        { transform: "translateY(-5px)", opacity: 0.5 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      300,
    ),
  );
  menuGlow(host);
}

/** S15: decorative terrain layers, fitted behind the existing mission controls. */
export function menuTerrain(host: HTMLElement | null, seed: number) {
  if (!host) return;
  const node = layer(host, "terrain");
  node.innerHTML = `<svg viewBox="0 0 240 100" preserveAspectRatio="none"><path d="M-20 100V${35 + (seed % 15)}L40 24L88 55L150 18L210 48L260 30V100Z"/><path d="M-20 100V80L55 47L112 75L178 43L260 70V100Z"/></svg>`;
  node
    .querySelectorAll("path")
    .forEach((path, i) =>
      menuMotion(
        path,
        [
          { transform: `translateX(${(i + 1) * 8}px)` },
          { transform: "translateX(0)" },
        ],
        500 + i * 160,
      ),
    );
}

/** G22: a coarse-to-fine mosaic veil over the specimen only. */
export function menuAnalyze(host: HTMLElement) {
  const node = layer(host, "mosaic");
  for (let i = 0; i < 48; i++) {
    const tile = document.createElement("i");
    node.append(tile);
    menuMotion(
      tile,
      [
        { opacity: 0.82, transform: "scale(1)" },
        { opacity: 0.4, transform: "scale(.5)", offset: 0.55 },
        { opacity: 0, transform: "scale(.1)" },
      ],
      300 + (i % 7) * 28,
    );
  }
  menuMotion(node, [{ opacity: 1 }, { opacity: 1 }], 540, () => node.remove());
}

/** S21: only a decorative new marker decodes; dates and history stay legible. */
export function menuNew(host: HTMLElement | null) {
  if (!host || host.querySelector(".menu-fx-new")) return;
  const marker = document.createElement("small");
  marker.className = "menu-fx-new";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "新着";
  host.append(marker);
  if (reduced.matches || document.hidden) return;
  const cover = document.createElement("span");
  cover.className = "menu-fx-code";
  cover.textContent = "◇#";
  marker.append(cover);
  menuMotion(
    cover,
    [
      { clipPath: "inset(0)" },
      { clipPath: "inset(0 0 0 50%)", offset: 0.6 },
      { clipPath: "inset(0 0 0 100%)" },
    ],
    420,
    () => cover.remove(),
  );
}

/** S24: draw an annotation around the selected guide tab, without resizing it. */
export function menuGuide(host: HTMLElement | null) {
  if (!host) return;
  const node = layer(host, "guide");
  node.innerHTML =
    '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="47" ry="43" pathLength="1"/></svg>';
  menuMotion(
    node.querySelector("ellipse"),
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    400,
  );
  menuMotion(
    node,
    [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
    800,
    () => node.remove(),
  );
}

/** Member state is scoped to the actual connection; rerenders don't retrigger. */
export function createSquadEffects() {
  let connection: object | undefined;
  let states = new Map<string, boolean>();
  return (
    owner: object,
    members: { id: string; ready: boolean; connected: boolean }[],
    nodes: Element[],
  ) => {
    if (connection !== owner) {
      connection = owner;
      states.clear();
    }
    const next = new Map<string, boolean>();
    for (const member of members) {
      if (!member.connected) continue;
      next.set(member.id, member.ready);
      if (!states.has(member.id) || (!states.get(member.id) && member.ready)) {
        const node = nodes.find(
          (n) => (n as HTMLElement).dataset.fxMember === member.id,
        );
        menuTrace(node as HTMLElement | null);
        menuGlow(node ?? null);
      }
    }
    states = next;
  };
}
