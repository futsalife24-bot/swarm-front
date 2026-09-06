import { angle, neutral, type Input } from "../shared/game";
export class Controls {
  input = neutral();
  enabled = false;
  sensitivity = 1;
  keys = new Set<string>();
  queued = new Set<string>();
  touches = new Map<number, { role: string; x: number; y: number }>();
  constructor() {
    const controls = document.querySelector("#controls")!;
    const el = (id: string) => document.getElementById(id)!;
    const reset = () => {
      this.keys.clear();
      this.queued.clear();
      this.touches.clear();
      const yaw = this.input.yaw,
        pitch = this.input.pitch;
      this.input = { ...neutral(), yaw, pitch, seq: this.input.seq };
      el("move").querySelector("span")!.setAttribute("style", "");
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) reset();
    });
    window.addEventListener("pagehide", reset);
    window.addEventListener("orientationchange", reset);
    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (
        [
          "Space",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyR",
          "KeyQ",
          "KeyE",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        const action = (
          { KeyR: "reload", KeyQ: "swap", Space: "dodge" } as Record<
            string,
            string
          >
        )[e.code];
        if (action) this.queued.add(action);
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("pointerdown", (e) => {
      if (!this.enabled || e.pointerType !== "mouse") return;
      if (
        e.target === document.querySelector("#world") ||
        e.target === el("look")
      ) {
        this.input.fire = e.button === 0;
        if (e.button === 0) (e.target as HTMLElement).requestPointerLock?.();
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") this.input.fire = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (
        this.enabled &&
        e.pointerType === "mouse" &&
        (document.pointerLockElement || e.buttons === 2)
      ) {
        this.look(e.movementX, e.movementY);
      }
    });
    window.addEventListener("contextmenu", (e) => {
      if (this.enabled) e.preventDefault();
    });
    controls.addEventListener("pointerdown", (ev) => {
      const e = ev as PointerEvent;
      if (!this.enabled) return;
      const target = (e.target as HTMLElement).closest("[id]") as HTMLElement;
      const role = target.id;
      if (
        !["move", "look", "fire", "reload", "swap", "dodge", "revive"].includes(
          role,
        )
      )
        return;
      if (e.pointerType === "mouse" && role === "look") return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      this.touches.set(e.pointerId, { role, x: e.clientX, y: e.clientY });
      if (["reload", "swap", "dodge"].includes(role)) this.queued.add(role);
      this.refresh();
    });
    controls.addEventListener("pointermove", (ev) => {
      const e = ev as PointerEvent,
        t = this.touches.get(e.pointerId);
      if (!t) return;
      e.preventDefault();
      if (t.role === "look") {
        this.look(e.clientX - t.x, e.clientY - t.y);
        t.x = e.clientX;
        t.y = e.clientY;
      } else if (t.role === "move") {
        const dx = Math.max(-50, Math.min(50, e.clientX - t.x)),
          dy = Math.max(-50, Math.min(50, e.clientY - t.y));
        this.input.mx = dx / 50;
        this.input.mz = -dy / 50;
        el("move")
          .querySelector("span")!
          .setAttribute("style", `transform:translate(${dx}px,${dy}px)`);
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      controls.addEventListener(type, (ev) => {
        const e = ev as PointerEvent,
          t = this.touches.get(e.pointerId);
        if (t?.role === "move") {
          this.input.mx = this.input.mz = 0;
          el("move").querySelector("span")!.setAttribute("style", "");
        }
        this.touches.delete(e.pointerId);
        this.refresh();
      });
    this.reset = reset;
  }
  reset: () => void;
  look(dx: number, dy: number) {
    this.input.yaw = angle(this.input.yaw + dx * 0.003 * this.sensitivity);
    this.input.pitch = Math.max(
      -0.65,
      Math.min(0.65, this.input.pitch - dy * 0.0025 * this.sensitivity),
    );
  }
  refresh() {
    for (const key of ["fire", "reload", "swap", "dodge", "revive"] as const)
      this.input[key] = [...this.touches.values()].some((t) => t.role === key);
  }
  read(): Input {
    const i = { ...this.input };
    if (
      this.keys.has("KeyW") ||
      this.keys.has("KeyS") ||
      this.keys.has("KeyA") ||
      this.keys.has("KeyD")
    ) {
      i.mx = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      i.mz = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    }
    i.reload = this.queued.has("reload");
    i.swap = this.queued.has("swap");
    i.dodge = this.queued.has("dodge");
    this.queued.clear();
    i.revive ||= this.keys.has("KeyE");
    i.seq = ++this.input.seq;
    return i;
  }
}
