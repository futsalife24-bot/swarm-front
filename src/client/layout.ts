export const CONTROL_IDS = [
  "move",
  "fire",
  "dodge",
  "reload",
  "swap",
  "revive",
] as const;
export type ControlId = (typeof CONTROL_IDS)[number];
export const LABELS: Record<ControlId, string> = {
  move: "移動",
  fire: "射撃",
  dodge: "回避",
  reload: "装填",
  swap: "切替",
  revive: "蘇生",
};
export interface Placement {
  x: number;
  y: number;
  size: number;
}
export interface Layout {
  version: 1;
  opacity: number;
  buttons: Record<ControlId, Placement>;
}
export const LAYOUT_KEY = "swarm-front-controls-v1";
export const HUD_HEIGHT = 88;
export const defaultLayout = (): Layout => ({
  version: 1,
  opacity: 0.8,
  buttons: {
    move: { x: 0.12, y: 0.73, size: 1 },
    fire: { x: 0.9, y: 0.55, size: 1 },
    dodge: { x: 0.77, y: 0.86, size: 1 },
    reload: { x: 0.77, y: 0.43, size: 1 },
    swap: { x: 0.92, y: 0.13, size: 1 },
    revive: { x: 0.64, y: 0.84, size: 1 },
  },
});
export function parseLayout(raw: string | null): Layout {
  if (raw === null) return defaultLayout();
  const v = JSON.parse(raw) as Layout;
  if (
    !v ||
    v.version !== 1 ||
    !Number.isFinite(v.opacity) ||
    v.opacity < 0.4 ||
    v.opacity > 1 ||
    !v.buttons ||
    !CONTROL_IDS.every((id) => {
      const b = v.buttons[id];
      return (
        b &&
        [b.x, b.y, b.size].every(Number.isFinite) &&
        b.x >= 0 &&
        b.x <= 1 &&
        b.y >= 0 &&
        b.y <= 1 &&
        b.size >= 0.7 &&
        b.size <= 1.4
      );
    })
  )
    throw Error(
      "配置データを読めません。標準配置で表示します。保存済みの武器は保持されます。",
    );
  return v;
}
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
export function arena(width: number, height: number, insets = NO_INSETS) {
  return {
    left: insets.left + 8,
    top: insets.top + HUD_HEIGHT,
    width: Math.max(1, width - insets.left - insets.right - 16),
    height: Math.max(1, height - insets.top - insets.bottom - HUD_HEIGHT - 8),
  };
}
export function resolveLayout(
  layout: Layout,
  width: number,
  height: number,
  insets = NO_INSETS,
) {
  const a = arena(width, height, insets),
    scale = Math.max(0.85, Math.min(1.15, width / 900, height / 400));
  return CONTROL_IDS.map((id) => {
    const b = layout.buttons[id],
      base = id === "move" ? 112 : id === "fire" ? 84 : 56;
    const size = Math.min(
      a.height,
      a.width,
      Math.max(44, base * b.size * scale),
    );
    const x = Math.max(size / 2, Math.min(a.width - size / 2, b.x * a.width)),
      y = Math.max(size / 2, Math.min(a.height - size / 2, b.y * a.height));
    return { id, left: a.left + x - size / 2, top: a.top + y - size / 2, size };
  });
}
export function overlaps(rects: ReturnType<typeof resolveLayout>) {
  return rects.some((a, i) =>
    rects
      .slice(i + 1)
      .some(
        (b) =>
          a.left < b.left + b.size + 4 &&
          a.left + a.size + 4 > b.left &&
          a.top < b.top + b.size + 4 &&
          a.top + a.size + 4 > b.top,
      ),
  );
}
export function readInsets(): Insets {
  const style = getComputedStyle(document.documentElement),
    read = (key: string) =>
      parseFloat(style.getPropertyValue("--safe-" + key)) || 0;
  return {
    left: read("left"),
    right: read("right"),
    top: read("top"),
    bottom: read("bottom"),
  };
}
export function placeControls(layout: Layout) {
  let rects = resolveLayout(layout, innerWidth, innerHeight, readInsets());
  const fallback = overlaps(rects);
  if (fallback)
    rects = resolveLayout(
      defaultLayout(),
      innerWidth,
      innerHeight,
      readInsets(),
    );
  for (const r of rects) {
    const el = document.getElementById(r.id)!;
    Object.assign(el.style, {
      left: r.left + "px",
      top: r.top + "px",
      right: "auto",
      bottom: "auto",
      width: r.size + "px",
      height: r.size + "px",
      opacity: String(layout.opacity),
    });
  }
  return fallback;
}
