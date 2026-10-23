import {
  CONTROL_IDS,
  defaultLayout,
  resolveLayout,
  overlaps,
  type Layout,
  type ControlId,
  type Insets,
} from "../layout";

export type LayoutMode = "portrait" | "landscape";
export interface ViewportSnapshot {
  width: number;
  height: number;
  mode: LayoutMode;
  insets: Insets;
  screenAngle: number | null;
  revision: number;
}
export interface ControlRect {
  id: ControlId;
  left: number;
  top: number;
  size: number;
}
export const portraitBand = 244;
export function controlArea(id: ControlId, v: ViewportSnapshot) {
  if (v.mode === "landscape")
    return {
      left: v.insets.left + 8,
      top: v.insets.top + 88,
      width: Math.max(1, v.width - v.insets.left - v.insets.right - 16),
      height: Math.max(1, v.height - v.insets.top - v.insets.bottom - 96),
    };
  if (id === "pause")
    return {
      left: v.width - v.insets.right - 72,
      top: v.insets.top + 8,
      width: 64,
      height: 64,
    };
  return {
    left: v.insets.left + 8,
    top: v.height - v.insets.bottom - 8 - portraitBand,
    width: Math.max(1, v.width - v.insets.left - v.insets.right - 16),
    height: portraitBand,
  };
}
export function defaultMockLayout(v: ViewportSnapshot): Layout {
  const layout = defaultLayout();
  if (v.mode === "landscape") {
    const area = controlArea("move", v),
      w = area.width,
      h = area.height;
    if (h < 164) {
      const positions: Record<ControlId, [number, number]> = {
        move: [56, h - 56],
        fire: [w - 52, h - 36],
        scope: [w - 116, 24],
        reload: [w - 180, 24],
        jump: [w - 244, 24],
        swap: [w - 52, 24],
        dodge: [w - 180, h - 24],
        revive: [w - 244, h - 24],
        scope2: [180, 24],
        pause: [w / 2, h - 24],
      };
      for (const id of CONTROL_IDS) {
        const [x, y] = positions[id];
        layout.buttons[id] = {
          x: x / w,
          y: y / h,
          size: id === "pause" ? 0.7 : 1,
        };
      }
    }
    return layout;
  }
  const w = controlArea("move", v).width;
  const positions: Record<ControlId, [number, number]> = {
    move: [56, 172],
    fire: [w - 56, 172],
    scope: [w - 88, 40],
    reload: [w - 32, 40],
    jump: [w - 88, 96],
    swap: [w - 32, 96],
    dodge: [w - 128, 212],
    revive: [w - 160, 40],
    scope2: [56, 40],
    pause: [32, 32],
  };
  for (const id of CONTROL_IDS) {
    const area = controlArea(id, v),
      [x, y] = positions[id];
    layout.buttons[id] = { x: x / area.width, y: y / area.height, size: 1 };
  }
  return layout;
}
export function resolveMockLayout(
  layout: Layout,
  v: ViewportSnapshot,
): ControlRect[] {
  if (v.mode === "landscape")
    return resolveLayout(layout, v.width, v.height, v.insets);
  return CONTROL_IDS.filter((id) => id !== "scope2" || layout.secondScope).map(
    (id) => {
      const area = controlArea(id, v),
        p = layout.buttons[id];
      const size = Math.max(
        44,
        (id === "move" ? 96 : id === "fire" ? 72 : id === "pause" ? 44 : 48) *
          p.size,
      );
      return {
        id,
        size,
        left:
          area.left +
          Math.max(
            size / 2,
            Math.min(area.width - size / 2, p.x * area.width),
          ) -
          size / 2,
        top:
          area.top +
          Math.max(
            size / 2,
            Math.min(area.height - size / 2, p.y * area.height),
          ) -
          size / 2,
      };
    },
  );
}
export function layoutProblem(
  rects: ControlRect[],
  v: ViewportSnapshot,
): string {
  if (overlaps(rects)) return "ボタンが重なっています。間隔を空けてください。";
  if (
    rects.some(
      (r) =>
        r.size < 44 ||
        r.left < v.insets.left ||
        r.top < v.insets.top ||
        r.left + r.size > v.width - v.insets.right ||
        r.top + r.size > v.height - v.insets.bottom,
    )
  )
    return "安全領域に収まっていません。位置か大きさを調整してください。";
  const cx = v.width / 2,
    cy = v.height / 2;
  if (
    rects.some(
      (r) =>
        r.left < cx + 22 &&
        r.left + r.size > cx - 22 &&
        r.top < cy + 22 &&
        r.top + r.size > cy - 22,
    )
  )
    return "中央の照準に重なっています。位置を調整してください。";
  return "";
}
export function shortEdgeFov(fov: number, aspect: number): number {
  return aspect >= 1
    ? fov
    : (2 *
        Math.atan(Math.tan((fov * Math.PI) / 360) / Math.max(aspect, 0.001)) *
        180) /
        Math.PI;
}
