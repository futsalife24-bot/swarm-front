import * as T from "three";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const rad = Math.PI / 180;
export const DRONE_DEFAULTS = { height: 32, radius: 24, yaw: 0, speed: 8 };
export type DroneSettings = typeof DRONE_DEFAULTS;
export function droneSettings(search: string): DroneSettings | null {
  const params = new URLSearchParams(search);
  if (params.get("drone") !== "1") return null;
  const number = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    const value = raw === null || raw.trim() === "" ? fallback : Number(raw);
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  };
  return {
    height: number("droneHeight", 32, 8, 120),
    radius: number("droneRadius", 24, 0, 100),
    yaw: number("droneYaw", 0, -180, 180),
    speed: number("droneSpeed", 8, -30, 30),
  };
}

/** Presentation only. The focus is copied; no World, Input or saved preferences mutate. */
export class DroneCamera {
  enabled = true;
  active = false;
  readonly keys = new Set<string>();
  private previousRadius = 24;
  constructor(public settings: DroneSettings = { ...DRONE_DEFAULTS }) {}
  static fromLocation(
    search = typeof location === "undefined" ? "" : location.search,
  ) {
    const settings = droneSettings(search);
    if (!settings) return null;
    const drone = new DroneCamera(settings);
    drone.bind();
    return drone;
  }
  private bind() {
    const codes = [
      "KeyI",
      "KeyK",
      "KeyJ",
      "KeyL",
      "KeyU",
      "KeyO",
      "KeyB",
      "KeyV",
    ];
    window.addEventListener("keydown", (event) => {
      if (
        !this.active ||
        !this.enabled ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(
            "input,select,textarea,[contenteditable=true]",
          )) ||
        !codes.includes(event.code)
      )
        return;
      event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat && event.code === "KeyB")
        this.settings.speed = this.settings.speed ? 0 : 8;
      if (!event.repeat && event.code === "KeyV") this.topDown();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.keys.clear());
    document.addEventListener("visibilitychange", () => this.keys.clear());
  }
  topDown() {
    if (this.settings.radius > 0) {
      this.previousRadius = this.settings.radius;
      this.settings.radius = 0;
    } else this.settings.radius = this.previousRadius;
  }
  apply(
    camera: T.PerspectiveCamera,
    focus: { x: number; y?: number; z: number },
    dt: number,
    animate: boolean,
  ) {
    if (!this.enabled) return;
    const s = this.settings;
    const delta = animate && Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (!animate) this.keys.clear();
    const axis = (positive: string, negative: string) =>
      Number(this.keys.has(positive)) - Number(this.keys.has(negative));
    const rotation = axis("KeyL", "KeyJ");
    s.yaw =
      ((((s.yaw + (rotation ? rotation * 35 : s.speed) * delta + 180) % 360) +
        360) %
        360) -
      180;
    s.height = clamp(s.height + axis("KeyI", "KeyK") * 20 * delta, 8, 120);
    s.radius = clamp(s.radius + axis("KeyO", "KeyU") * 20 * delta, 0, 100);
    const yaw = s.yaw * rad;
    camera.position.set(
      focus.x + Math.sin(yaw) * s.radius,
      (focus.y ?? 0) + s.height,
      focus.z + Math.cos(yaw) * s.radius,
    );
    // A horizontal up vector makes a true top-down shot stable (no pole singularity).
    if (s.radius < 0.001) camera.up.set(Math.sin(yaw), 0, -Math.cos(yaw));
    else camera.up.set(0, 1, 0);
    camera.lookAt(focus.x, (focus.y ?? 0) + 1, focus.z);
  }
  mount(root: HTMLElement) {
    const panel = document.createElement("details");
    panel.className = "drone-tools";
    panel.innerHTML = `<summary>ドローン撮影</summary><div class="drone-actions"><label><input type="checkbox" data-drone-enabled>上空カメラを使う</label><button type="button" data-drone-top>真上／斜め上空</button></div><div class="drone-ranges"></div><p>I/K 高さ · J/L 周回角度 · U/O 距離 · B 自動周回 · V 真上<br>兵士の操作は通常どおり。設定は保存しません。</p>`;
    const enabled = panel.querySelector<HTMLInputElement>(
      "[data-drone-enabled]",
    )!;
    enabled.checked = this.enabled;
    enabled.onchange = () => {
      this.enabled = enabled.checked;
      this.keys.clear();
    };
    for (const [key, label, min, max, unit] of [
      ["height", "高さ", 8, 120, "m"],
      ["radius", "水平距離", 0, 100, "m"],
      ["yaw", "向き", -180, 180, "°"],
      ["speed", "自動周回", -30, 30, "°/秒"],
    ] as const) {
      const row = document.createElement("label");
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="1" aria-label="撮影カメラ ${label}"><output></output>`;
      const input = row.querySelector("input")!;
      const output = row.querySelector("output")!;
      input.value = String(this.settings[key]);
      output.value = `${Math.round(this.settings[key])}${unit}`;
      input.oninput = () => {
        this.settings[key] = Number(input.value);
        output.value = `${input.value}${unit}`;
      };
      panel.querySelector(".drone-ranges")!.append(row);
    }
    panel.querySelector<HTMLButtonElement>("[data-drone-top]")!.onclick =
      () => {
        this.topDown();
        const input = panel.querySelector<HTMLInputElement>(
          '[aria-label="撮影カメラ 水平距離"]',
        )!;
        input.value = String(this.settings.radius);
        input.dispatchEvent(new Event("input"));
      };
    root.append(panel);
  }
}
