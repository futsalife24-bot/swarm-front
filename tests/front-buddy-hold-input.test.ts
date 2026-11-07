import { afterEach, expect, it, vi } from "vitest";
import { bindBuddySkillInput } from "../src/client/buddy-skill-input";

function fixture() {
  vi.useFakeTimers();
  const button = new EventTarget();
  const view = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const captured = new Set<number>();
  Object.assign(button, {
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  });
  vi.stubGlobal("window", view);
  vi.stubGlobal("document", doc);
  let available = true;
  const onActivate = vi.fn();
  const onHoldStart = vi.fn();
  const onHoldEnd = vi.fn();
  const binding = bindBuddySkillInput(
    button as HTMLButtonElement,
    () => available,
    { onActivate, onHoldStart, onHoldEnd },
  );
  const fire = (type: string, fields = {}, target = button) => {
    const event = Object.assign(new Event(type, { cancelable: true }), fields);
    target.dispatchEvent(event);
    return event;
  };
  return {
    binding,
    button,
    view,
    doc,
    fire,
    captured,
    onActivate,
    onHoldStart,
    onHoldEnd,
    disable: () => {
      available = false;
      binding.cancel();
    },
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(["mouse", "touch", "pen"])(
  "%sの押下は保持し、解放で一度発動してclickでは重複しない",
  (pointerType) => {
    const f = fixture();
    const pointer = { pointerType, pointerId: 2, button: 0 };
    f.fire("pointerdown", pointer);
    expect(f.onHoldStart).toHaveBeenCalledTimes(1);
    expect(f.onHoldEnd).not.toHaveBeenCalled();
    expect(f.captured.has(2)).toBe(true);
    f.fire("pointerup", { ...pointer, pointerId: 3 });
    expect(f.onHoldEnd).not.toHaveBeenCalled();
    f.fire("pointerup", pointer);
    f.fire("lostpointercapture", pointer);
    f.fire("click", { detail: 1 });
    expect(f.onHoldEnd.mock.calls).toEqual([[true]]);
    expect(f.onActivate).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
  },
);

it.each([
  "pointercancel",
  "lostpointercapture",
  "blur",
  "pagehide",
  "hidden",
  "disabled",
  "destroy",
])("%sによる中断は取り消しになり、後着のup/clickで発動しない", (mode) => {
  const f = fixture();
  const pointer = { pointerType: "touch", pointerId: 4 };
  f.fire("pointerdown", pointer);
  if (mode === "disabled") f.disable();
  else if (mode === "destroy") f.binding.destroy();
  else if (mode === "hidden") {
    f.doc.hidden = true;
    f.fire("visibilitychange", {}, f.doc);
  } else f.fire(mode, pointer, mode === "pagehide" ? f.view : f.button);
  f.fire("pointerup", pointer);
  f.fire("click", { detail: 1 });
  expect(f.onHoldEnd.mock.calls).toEqual([[false]]);
  expect(f.onActivate).not.toHaveBeenCalled();
});

it.each(["Enter", " "])(
  "%sはrepeatで発動せず、キー解放と疑似clickを重複処理しない",
  (key) => {
    const f = fixture();
    expect(f.fire("keydown", { key, repeat: false }).defaultPrevented).toBe(
      true,
    );
    f.fire("keydown", { key, repeat: true });
    f.fire("click", { detail: 0 });
    expect(f.onHoldStart).toHaveBeenCalledTimes(1);
    expect(f.onHoldEnd).not.toHaveBeenCalled();
    f.fire("keyup", { key });
    f.fire("click", { detail: 0 });
    expect(f.onHoldEnd.mock.calls).toEqual([[true]]);
    expect(f.onActivate).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    f.fire("click", { detail: 0 });
    expect(f.onActivate).toHaveBeenCalledTimes(1); // Assistive technology without key events.
  },
);

it("右クリック、押せないボタン、破棄後の操作は発動しない", () => {
  const f = fixture();
  f.fire("pointerdown", { pointerType: "mouse", button: 2, pointerId: 1 });
  expect(f.onHoldStart).not.toHaveBeenCalled();
  f.disable();
  f.fire("pointerdown", { pointerType: "touch", pointerId: 2 });
  f.fire("keydown", { key: "Enter" });
  f.fire("click", { detail: 0 });
  f.binding.destroy();
  f.fire("pointerdown", { pointerType: "touch", pointerId: 3 });
  expect(f.onHoldStart).not.toHaveBeenCalled();
  expect(f.onActivate).not.toHaveBeenCalled();
});

it("マウスの右を保持したまま左だけ離すと、その時点で発動する", () => {
  const f = fixture();
  const pointer = { pointerType: "mouse", button: 0, pointerId: 7 };
  f.fire("pointerdown", pointer);
  f.fire("pointermove", { ...pointer, buttons: 3 });
  expect(f.onHoldEnd).not.toHaveBeenCalled();
  f.fire("pointermove", { ...pointer, buttons: 2 });
  f.fire("pointerup", { ...pointer, button: 2 });
  expect(f.onHoldEnd.mock.calls).toEqual([[true]]);
});
