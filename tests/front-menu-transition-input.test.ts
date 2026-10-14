import { afterEach, describe, expect, it, vi } from "vitest";
import { guardMenuTransitionInput } from "../src/client/menu-transition-input";

function fixture() {
  const target = new EventTarget();
  const view = new EventTarget();
  Object.assign(target, { defaultView: view, hidden: false });
  vi.stubGlobal("document", target);
  let active = true;
  const dispose = guardMenuTransitionInput(() => active);
  const fire = (type: string, fields: Record<string, unknown> = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, fields);
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return {
    fire,
    loseFocus: (mode: string) => {
      if (mode === "blur") view.dispatchEvent(new Event("blur"));
      else {
        Object.assign(target, { hidden: true });
        target.dispatchEvent(new Event("visibilitychange"));
        Object.assign(target, { hidden: false });
        target.dispatchEvent(new Event("visibilitychange"));
      }
    },
    finish: () => {
      active = false;
      dispose();
    },
  };
}

describe("シャッターをまたぐ操作の終端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(["blur", "hidden"])(
    "%s後に画面外解放が欠落しても別キーとATクリックを許可する",
    (mode) => {
      const { fire, finish, loseFocus } = fixture();
      fire("keydown", { code: "Enter", repeat: false });
      fire("pointerdown", { pointerId: 10 });
      loseFocus(mode);
      finish();
      expect(fire("click", { detail: 0 })).toBe(false);
      expect(fire("keydown", { code: "Space", repeat: false })).toBe(false);
      expect(fire("keyup", { code: "Space" })).toBe(false);
      expect(fire("click", { detail: 0 })).toBe(false);
      expect(fire("pointerdown", { pointerId: 10 })).toBe(false);
      expect(fire("pointerup", { pointerId: 10 })).toBe(false);
      expect(fire("click", { pointerId: 10, detail: 1 })).toBe(false);
    },
  );

  it.each(["blur", "hidden"])(
    "%s後も保持中のrepeatとup由来クリックは遮断する",
    (mode) => {
      vi.useFakeTimers();
      const { fire, finish, loseFocus } = fixture();
      fire("keydown", { code: "Enter", repeat: false });
      fire("pointerdown", { pointerId: 10 });
      loseFocus(mode);
      finish();
      expect(fire("keydown", { code: "Enter", repeat: true })).toBe(true);
      expect(fire("keyup", { code: "Enter" })).toBe(true);
      expect(fire("click", { detail: 0 })).toBe(true);
      expect(fire("pointerup", { pointerId: 10 })).toBe(true);
      expect(fire("click", { pointerId: 10, detail: 1 })).toBe(true);
      vi.runOnlyPendingTimers();
      expect(fire("click", { detail: 0 })).toBe(false);
    },
  );

  it("遷移元Enterを保持し、最初のrepeatが演出終了後でも遮断する", () => {
    const target = new EventTarget();
    vi.stubGlobal("document", target);
    let active = false;
    const guard = guardMenuTransitionInput(() => active);
    const key = (repeat: boolean) => {
      const event = new Event("keydown", { cancelable: true });
      Object.assign(event, { code: "Enter", repeat });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(key(false)).toBe(false);
    active = true;
    guard.captureHeld();
    active = false;
    guard();
    expect(key(true)).toBe(true);
    expect(key(false)).toBe(false);
  });

  it("表示中の押下を終了・解除後のup/clickまで遮断し、次の新規タップは許可する", () => {
    vi.useFakeTimers();
    const { fire, finish } = fixture();
    expect(fire("pointerdown", { pointerId: 1 })).toBe(true);
    finish();
    expect(fire("pointerup", { pointerId: 1 })).toBe(true);
    expect(fire("click", { pointerId: 1, detail: 1 })).toBe(true);
    expect(fire("pointerdown", { pointerId: 1 })).toBe(false);
    expect(fire("pointerup", { pointerId: 1 })).toBe(false);
    expect(fire("click", { pointerId: 1, detail: 1 })).toBe(false);
  });

  it.each(["Enter", "Space"])(
    "%sの長押しrepeatとkeyup由来クリックを遮断する",
    (code) => {
      vi.useFakeTimers();
      const { fire, finish } = fixture();
      expect(fire("keydown", { code, repeat: false })).toBe(true);
      finish();
      expect(fire("keydown", { code, repeat: true })).toBe(true);
      expect(fire("click", { detail: 0 })).toBe(true);
      expect(fire("keyup", { code })).toBe(true);
      expect(fire("click", { detail: 0 })).toBe(true);
      vi.runOnlyPendingTimers();
      expect(fire("keydown", { code, repeat: false })).toBe(false);
      expect(fire("click", { detail: 0 })).toBe(false);
    },
  );

  it("release欠落やpointercancel後でも新規押下は復帰する", () => {
    const { fire, finish } = fixture();
    fire("pointerdown", { pointerId: 3 });
    fire("keydown", { code: "Enter", repeat: false });
    finish();
    expect(fire("pointercancel", { pointerId: 3 })).toBe(true);
    expect(fire("pointerdown", { pointerId: 3 })).toBe(false);
    expect(fire("keydown", { code: "Enter", repeat: false })).toBe(false);
    expect(fire("click", { detail: 0 })).toBe(false);
  });

  it("別のポインターの新規操作は長押し中でも許可する", () => {
    const { fire, finish } = fixture();
    fire("pointerdown", { pointerId: 1 });
    finish();
    expect(fire("pointerdown", { pointerId: 2 })).toBe(false);
    expect(fire("click", { pointerId: 2, detail: 1 })).toBe(false);
  });
});
