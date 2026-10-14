import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { titleEntryInputGate } from "../src/client/title-entry-input";

describe("title entry input boundary", () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
  );
  afterEach(() => vi.useRealTimers());
  const setup = () => {
    const target = new EventTarget();
    const released = vi.fn();
    const gate = titleEntryInputGate(target as unknown as Window, released);
    const emit = (type: string, props = {}) => {
      const event = Object.assign(new Event(type, { cancelable: true }), props);
      target.dispatchEvent(event);
      return event;
    };
    return { gate, emit, released };
  };

  it.each(["Enter", " ", "Escape"])(
    "holds %s until keyup and consumes its final event",
    (key) => {
      const { gate, emit, released } = setup();
      emit("keydown", { key });
      gate.settle();
      vi.advanceTimersByTime(2000);
      expect(released).not.toHaveBeenCalled();
      expect(emit("keydown", { key, repeat: true }).defaultPrevented).toBe(
        true,
      );
      expect(emit("keyup", { key }).defaultPrevented).toBe(true);
      expect(released).toHaveBeenCalledTimes(1);
      expect(emit("keydown", { key }).defaultPrevented).toBe(false);
    },
  );

  it("absorbs the second pointer gesture before releasing a reduced-motion entry", () => {
    const { gate, emit, released } = setup();
    emit("pointerdown", { pointerId: 1 });
    emit("pointerup", { pointerId: 1 });
    gate.settle();
    vi.advanceTimersByTime(200);
    emit("pointerdown", { pointerId: 1 });
    emit("pointerup", { pointerId: 1 });
    vi.advanceTimersByTime(399);
    expect(released).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("does not release a second pointer that is still held", () => {
    const { gate, emit, released } = setup();
    emit("pointerdown", { pointerId: 1 });
    gate.settle();
    vi.advanceTimersByTime(1000);
    expect(released).not.toHaveBeenCalled();
    emit("pointercancel", { pointerId: 1 });
    vi.advanceTimersByTime(400);
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("releases without extra delay when the normal animation outlasts the gesture", () => {
    const { gate, emit, released } = setup();
    emit("pointerdown", { pointerId: 1 });
    emit("pointerup", { pointerId: 1 });
    vi.advanceTimersByTime(920);
    gate.settle();
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("clears lost input on blur", () => {
    const { gate, emit, released } = setup();
    emit("keydown", { key: "Enter" });
    emit("pointerdown", { pointerId: 1 });
    gate.settle();
    emit("blur");
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("can recover on document hiding before or after visual completion", () => {
    for (const settling of [false, true]) {
      const { gate, emit, released } = setup();
      emit("keydown", { key: "Enter" });
      if (settling) gate.settle();
      gate.interrupt();
      gate.settle();
      vi.advanceTimersByTime(2000);
      expect(released).toHaveBeenCalledTimes(1);
    }
  });
});
