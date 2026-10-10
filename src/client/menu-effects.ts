import "./menu-effects.css";

// NANKA DEKIRU's expressions adapted to the existing menus, without new libraries.
// Presentation never waits on an effect, changes saved values, or handles input.
// Importable without a DOM (unit tests load menus that use these effects).
const dom = typeof window !== "undefined";
const reducedQuery = dom
  ? matchMedia("(prefers-reduced-motion: reduce)")
  : undefined;
const reduced = {
  get matches() {
    return reducedQuery?.matches ?? true;
  },
};
const running = new Map<Animation, { owner: Element; cancel: () => void }>();
let watching = false;
const detached = dom
  ? new MutationObserver(() => {
      for (const { owner, cancel } of running.values())
        if (!owner.isConnected) cancel();
    })
  : undefined;
const stop = () => {
  for (const { cancel } of running.values()) cancel();
};
if (dom) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  reducedQuery!.addEventListener("change", () => {
    if (reduced.matches) stop();
  });
}
const ease = "cubic-bezier(.2,.75,.25,1)";
export function menuMotion(
  element: Element | null,
  frames: Keyframe[],
  duration = 360,
  cleanup = () => {},
  iterations = 1,
  timing: { delay?: number; easing?: string; fill?: FillMode } = {},
) {
  if (!element?.isConnected || reduced.matches || document.hidden) {
    cleanup();
    return () => {};
  }
  if (running.size >= 96) running.values().next().value?.cancel();
  // Staged keyframes keep their offsets in real time (holds stay holds);
  // a curve for them belongs on the individual keyframes.
  const staged = frames.some((frame) => frame.offset !== undefined);
  const animation = element.animate(frames, {
    duration,
    iterations,
    easing: staged ? "linear" : ease,
    ...timing,
  });
  if (!watching) {
    detached!.observe(document.body, { childList: true, subtree: true });
    watching = true;
  }
  let cleaned = false;
  const done = () => {
    if (cleaned) return;
    cleaned = true;
    running.delete(animation);
    cleanup();
    if (!running.size) {
      detached!.disconnect();
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

export function menuGlow(element: Element | null, delay = 0) {
  menuMotion(
    element,
    [
      { filter: "brightness(1)" },
      { filter: "brightness(1.45)", offset: 0.3 },
      { filter: "brightness(1)" },
    ],
    420,
    () => {},
    1,
    { delay },
  );
}

/** Remove a decoration layer once its longest child motion has ended. */
function hold(node: HTMLElement, duration: number) {
  menuMotion(node, [{ opacity: 1 }, { opacity: 1 }], duration, () =>
    node.remove(),
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
  hold(node, 560);
}

function layer(host: HTMLElement, kind: string) {
  // Absolute decorations have no layout area, no focus and no pointer hitbox.
  // Positioned hosts (dialogs, the menu root) keep their own position rule.
  host.classList.add(
    getComputedStyle(host).position === "static"
      ? "menu-fx-host"
      : "menu-fx-isolate",
  );
  host.querySelectorAll(":scope > .menu-fx-layer").forEach((e) => e.remove());
  const node = document.createElement("span");
  node.className = `menu-fx-layer menu-fx-${kind}`;
  node.setAttribute("aria-hidden", "true");
  host.append(node);
  return node;
}

/** A point of an element inside a layer's coordinate space. */
function local(
  host: HTMLElement,
  target: Element | DOMRect,
  ax = 0.5,
  ay = 0.5,
) {
  const base = host.getBoundingClientRect();
  const r = target instanceof Element ? target.getBoundingClientRect() : target;
  return {
    x: r.left + r.width * ax - base.left - host.clientLeft + host.scrollLeft,
    y: r.top + r.height * ay - base.top - host.clientTop + host.scrollTop,
  };
}

/** End of the visible text, so confirmations sit beside what they confirm. */
function textEnd(host: HTMLElement) {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (text.data.trim() && !text.parentElement?.closest(".menu-fx-layer"))
      last = text;
  }
  if (!last) return null;
  const range = document.createRange();
  range.selectNodeContents(last);
  const rects = range.getClientRects();
  return rects[rects.length - 1] ?? null;
}

/**
 * Line from the chosen row to the slot it now fills. The slot frame is drawn
 * when the travelling light arrives, so cause and result read in order.
 */
export function menuEquip(
  root: HTMLElement,
  target: HTMLElement | null,
  from?: Element | DOMRect | null,
) {
  if (!target) return;
  const travel = from ? 230 : 0;
  menuTrace(target, false, travel);
  menuGlow(target, travel);
  if (!from) return;
  if (from instanceof Element)
    menuGlow(from.closest(".pt-weapon-row,.weapon-row") ?? from);
  const start = local(root, from, from instanceof Element ? 0 : 0.5);
  const end = local(root, target, 1, 0.5);
  const bounds = root.getBoundingClientRect();
  const node = layer(root, "equip");
  node.innerHTML = `<svg viewBox="0 0 ${bounds.width} ${bounds.height}"><path pathLength="1" d="M${start.x} ${start.y}L${end.x} ${end.y}"/></svg><b></b>`;
  const curve = "cubic-bezier(.45,0,.2,1)";
  menuMotion(
    node.querySelector("path"),
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    travel,
    () => {},
    1,
    { fill: "forwards", easing: curve },
  );
  menuMotion(
    node.querySelector("b"),
    [
      {
        transform: `translate(${start.x}px,${start.y}px) scale(.6)`,
        easing: curve,
      },
      {
        transform: `translate(${end.x}px,${end.y}px) scale(1)`,
        offset: 0.6,
      },
      { transform: `translate(${end.x}px,${end.y}px) scale(2.4)`, opacity: 0 },
    ],
    travel / 0.6,
  );
  menuMotion(
    node,
    [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
    560,
    () => node.remove(),
  );
}

/** S12 line draw, also used for the saved confirmation check. */
export function menuTrace(host: HTMLElement | null, check = false, delay = 0) {
  if (!host) return;
  const end = check ? textEnd(host) : null;
  // Repeated saves (a dragged slider) keep the check drawn instead of
  // restarting the stroke on every input.
  const drawn = check && !!host.querySelector(":scope > .menu-fx-check");
  const node = layer(host, check ? "check" : "trace");
  if (end) {
    // Beside the confirmed text rather than at a distant edge of the row;
    // right-aligned status text gets the check just before it.
    const at = local(host, end, 1, 0.5);
    const x =
      at.x + 26 <= host.clientWidth ? at.x + 4 : local(host, end, 0).x - 24;
    if (x >= 0)
      Object.assign(node.style, {
        left: `${x}px`,
        top: `${at.y - 10}px`,
        height: "20px",
        right: "auto",
        bottom: "auto",
      });
  }
  node.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path pathLength="1" d="${check ? "M22 52L42 72L80 30" : "M2 50V2H98V98H2V50"}"/></svg>`;
  const path = node.querySelector("path")!;
  // Hidden until its delay ends; fill keeps the drawn line during the hold.
  path.style.strokeDashoffset = drawn ? "0" : "1";
  if (!drawn)
    menuMotion(
      path,
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      check ? 300 : 380,
      () => {},
      1,
      { delay, fill: "forwards" },
    );
  menuMotion(
    node,
    [{ opacity: 1 }, { opacity: 1, offset: 0.72 }, { opacity: 0 }],
    check ? 1100 : 700,
    () => node.remove(),
    1,
    { delay },
  );
}

/**
 * T01: material light leaves the button that spent it and gathers on the new
 * item's grade badge, which then settles. The item text stays readable.
 */
export function menuAssemble(
  root: HTMLElement,
  item: HTMLElement | null,
  source?: Element | null,
) {
  if (!item) return;
  const badge = item.querySelector<HTMLElement>(".accessory-grade") ?? item;
  const end = local(root, badge);
  const start = source ? local(root, source) : { x: end.x + 70, y: end.y };
  const node = document.createElement("span");
  node.className = "menu-fx-layer menu-fx-particles";
  node.setAttribute("aria-hidden", "true");
  root.classList.add(
    getComputedStyle(root).position === "static"
      ? "menu-fx-host"
      : "menu-fx-isolate",
  );
  root.append(node);
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement("i");
    const angle = (i * Math.PI) / 6;
    const spread = 10 + (i % 3) * 6;
    const sx = start.x + Math.cos(angle) * spread,
      sy = start.y + Math.sin(angle) * spread * 0.6;
    // A loose stream that converges, rather than a straight beam.
    const mx = (sx + end.x) / 2 + Math.sin(angle) * 28,
      my = (sy + end.y) / 2 + Math.cos(angle) * 10;
    node.append(dot);
    menuMotion(
      dot,
      [
        {
          transform: `translate(${sx}px,${sy}px)`,
          opacity: 0,
          easing: "ease-out",
        },
        {
          transform: `translate(${mx}px,${my}px)`,
          opacity: 1,
          offset: 0.45,
          easing: "ease-in",
        },
        { transform: `translate(${end.x}px,${end.y}px)`, opacity: 1 },
      ],
      380,
      () => {},
      1,
      { delay: i * 14, fill: "backwards" },
    );
  }
  hold(node, 560);
  // Arrival: the badge settles and a single sheen crosses the new row.
  menuMotion(
    badge,
    [
      { transform: "scale(1)" },
      { transform: "scale(1.28)", offset: 0.35 },
      { transform: "scale(1)" },
    ],
    320,
    () => {},
    1,
    { delay: 470 },
  );
  const row = item.closest<HTMLElement>(".accessory-row") ?? item;
  const sheen = layer(row, "shine");
  sheen.append(document.createElement("i"));
  menuMotion(
    sheen.firstElementChild,
    [{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }],
    480,
    () => {},
    1,
    { delay: 470, fill: "backwards" },
  );
  menuMotion(sheen, [{ opacity: 1 }, { opacity: 1 }], 960, () =>
    sheen.remove(),
  );
}

/** P19 + S14: light flows from the claim to the wallet; values stay final. */
export function menuReward(host: HTMLElement | null, source?: Element | null) {
  if (!host) return;
  const stage = host.closest<HTMLElement>("dialog,#ui") ?? host;
  const node = layer(stage, "reward");
  const end = local(stage, host, 0.15);
  const start = source ? local(stage, source) : { x: end.x - 70, y: end.y };
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement("i");
    node.append(dot);
    menuMotion(
      dot,
      [
        {
          transform: `translate(${start.x + ((i % 3) - 1) * 8}px,${start.y + ((i % 2) * 2 - 1) * 5}px)`,
          opacity: 0,
        },
        { opacity: 1, offset: 0.2, easing: "ease-in" },
        { transform: `translate(${end.x}px,${end.y}px)`, opacity: 0.2 },
      ],
      420,
      () => {},
      1,
      { delay: i * 22, fill: "backwards" },
    );
  }
  hold(node, 620);
  // The value lands when the light arrives; it is the final value throughout.
  host.querySelectorAll("strong,b,.resource-value").forEach((value) =>
    menuMotion(
      value,
      [
        { transform: "translateY(-5px)", opacity: 0.65 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      300,
      () => {},
      1,
      { delay: 380, fill: "backwards" },
    ),
  );
  menuGlow(host, 380);
}

let terrainSeed: number | undefined;
/** S15: a mission-specific silhouette; parallax plays only when it changes. */
export function menuTerrain(host: HTMLElement | null, seed: number) {
  if (!host) return;
  const node = layer(host, "terrain");
  let state = Math.imul(seed + 1, 0x9e3779b1);
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), 0x85ebca6b);
    state ^= state >>> 13;
    return ((state >>> 0) % 1000) / 1000;
  };
  const ridge = (low: number, high: number) => {
    const points = [];
    for (let x = -20; x <= 260; x += 35 + Math.floor(random() * 20))
      points.push(`${x} ${Math.round(low + random() * (high - low))}`);
    return `M-20 100V${points[0]!.split(" ")[1]}L${points.join("L")}L260 ${Math.round(low + random() * (high - low))}V100Z`;
  };
  const far = ridge(18, 52),
    near = ridge(58, 84);
  node.innerHTML = `<svg viewBox="0 0 240 100" preserveAspectRatio="none"><path d="${far}"/><path d="${near}"/></svg>`;
  if (terrainSeed === seed) return;
  terrainSeed = seed;
  node.querySelectorAll("path").forEach((path, i) =>
    menuMotion(
      path,
      [
        { transform: `translateX(${(i + 1) * 9}px)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      520 + i * 180,
    ),
  );
}

/** G22: an analysis sweep uncovers the specimen column by column. */
export function menuAnalyze(host: HTMLElement) {
  const node = layer(host, "mosaic");
  for (let i = 0; i < 48; i++) {
    const tile = document.createElement("i");
    node.append(tile);
    const column = i % 8,
      row = Math.floor(i / 8);
    menuMotion(
      tile,
      [
        { opacity: 0.85, transform: "scale(1)" },
        { opacity: 0, transform: "scale(.4)" },
      ],
      200,
      () => {},
      1,
      { delay: column * 42 + ((row * 5) % 3) * 14, fill: "both" },
    );
  }
  const scan = document.createElement("b");
  node.append(scan);
  // Paced with the columns so the line leads the reveal instead of racing it.
  menuMotion(
    scan,
    [
      { left: "0%", opacity: 1 },
      { left: "100%", opacity: 0.4 },
    ],
    340,
    () => scan.remove(),
    1,
    { delay: 60, easing: "linear", fill: "backwards" },
  );
  hold(node, 600);
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
  // Only the newly selected tab is annotated; a previous circle never lingers.
  host.parentElement
    ?.querySelectorAll(":scope > * > .menu-fx-guide")
    .forEach((old) => old.remove());
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

/** S24 for a single-page guide: underline the heading's text being opened. */
export function menuUnderline(host: HTMLElement | null) {
  if (!host) return;
  const end = textEnd(host);
  const node = layer(host, "underline");
  const width = end ? local(host, end, 1).x : host.clientWidth;
  node.style.width = `${Math.max(24, width)}px`;
  node.innerHTML =
    '<svg viewBox="0 0 100 10" preserveAspectRatio="none"><path pathLength="1" d="M1 6Q30 3 60 6T99 5"/></svg>';
  menuMotion(
    node.querySelector("path"),
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    360,
    () => {},
    1,
    { fill: "forwards" },
  );
  menuMotion(
    node,
    [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
    900,
    () => node.remove(),
  );
}

/** Saved polygon settles into place; changed abilities ring once. */
export function menuGrowthSaved(radar: HTMLElement | null, changed: string[]) {
  const saved = radar?.querySelector<SVGPolygonElement>(".radar-saved");
  if (!radar || !saved) return;
  const outline = saved.cloneNode() as SVGPolygonElement;
  outline.setAttribute("class", "radar-fx-settle");
  outline.setAttribute("pathLength", "1");
  saved.after(outline);
  menuMotion(
    outline,
    [
      { strokeDashoffset: 1, opacity: 1 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.6 },
      { strokeDashoffset: 0, opacity: 0 },
    ],
    640,
    () => outline.remove(),
  );
  for (const key of changed) {
    const node = radar.querySelector<HTMLElement>(`.radar-${key}`);
    if (!node) continue;
    const ring = layer(node, "ring");
    menuMotion(
      ring,
      [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }],
      620,
      () => ring.remove(),
      1,
      { delay: 260, fill: "backwards" },
    );
  }
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
      const joined = !states.has(member.id),
        readied = !states.get(member.id) && member.ready;
      if (joined || readied) {
        const node = nodes.find(
          (n) => (n as HTMLElement).dataset.fxMember === member.id,
        ) as HTMLElement | undefined;
        // Joining draws the member frame; becoming ready draws a check beside
        // the member's status text, so the two signals are distinguishable.
        if (readied)
          menuTrace(
            node?.querySelector<HTMLElement>(".member-heading") ?? node ?? null,
            true,
          );
        else menuTrace(node ?? null);
        menuGlow(node ?? null);
      }
    }
    states = next;
  };
}
