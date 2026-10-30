import { afterEach, describe, expect, it, vi } from "vitest";
import { Controls } from "../src/client/input";

vi.mock("../src/client/layout", () => ({ ensureScopeControls: () => {} }));

function fixture() {
  const view = new EventTarget();
  const doc = new EventTarget();
  const nodes = new Map<string, EventTarget>();
  const node = (id: string) => {
    if (!nodes.has(id)) {
      const element = new EventTarget();
      Object.assign(element, {
        id,
        closest: () => element,
        setPointerCapture: () => {},
        querySelector: () => ({ setAttribute: () => {} }),
      });
      nodes.set(id, element);
    }
    return nodes.get(id)!;
  };
  Object.assign(doc, {
    hidden: false,
    hasFocus: () => true,
    querySelector: (selector: string) => node(selector.slice(1)),
    getElementById: node,
  });
  vi.stubGlobal("window", view);
  vi.stubGlobal("document", doc);
  const controls = new Controls();
  controls.enabled = true;
  const fire = (target: EventTarget, type: string, fields = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, fields);
    target.dispatchEvent(event);
  };
  const mouse = (type: string, button = 0) => {
    const event = new Event(type);
    Object.defineProperty(event, "target", { value: node("world") });
    Object.assign(event, { pointerType: "mouse", button });
    view.dispatchEvent(event);
  };
  const touch = (type: string, role: string, pointerId: number, x = 0) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "target", { value: node(role) });
    Object.assign(event, {
      pointerType: "touch",
      pointerId,
      clientX: x,
      clientY: 0,
    });
    node("controls").dispatchEvent(event);
  };
  return { controls, view, doc, fire, mouse, touch };
}

afterEach(() => vi.unstubAllGlobals());

describe("戦闘入力の独立した解放と中断", () => {
  it("表示用の歩行読取は送信番号と一度だけの操作を消費しない", () => {
    const { controls, view, fire, touch } = fixture();
    touch("pointerdown", "move", 1);
    touch("pointermove", "move", 1, 50);
    touch("pointerdown", "jump", 2);
    const seq = controls.input.seq;
    const touchMove = controls.previewMovement();
    expect(touchMove.mx).not.toBe(0);
    fire(view, "keydown", { code: "KeyW", repeat: false });
    expect(controls.previewMovement()).toMatchObject({ mx: 0, mz: 1 });
    expect(controls.previewMovement()).toMatchObject({ mx: 0, mz: 1 });
    expect(controls.input.seq).toBe(seq);
    expect(controls.read()).toMatchObject({
      mx: 0,
      mz: 1,
      jump: true,
      seq: seq + 1,
    });
    expect(controls.read().jump).toBe(false);
    fire(view, "keyup", { code: "KeyW" });
    expect(controls.previewMovement()).toEqual(touchMove);
  });
  it.each(["focus", "hidden"])(
    "%sの通知が届かなくても読取時に解除する",
    (mode) => {
      const { controls, touch, mouse, view, doc, fire } = fixture();
      touch("pointerdown", "move", 1);
      touch("pointermove", "move", 1, 50);
      touch("pointerdown", "jump", 2);
      mouse("pointerdown");
      fire(view, "keydown", { code: "KeyW", repeat: false });
      controls.input.yaw = 0.8;
      controls.input.pitch = -0.2;
      if (mode === "focus") Object.assign(doc, { hasFocus: () => false });
      else Object.assign(doc, { hidden: true });
      expect(controls.read()).toMatchObject({
        mx: 0,
        mz: 0,
        fire: false,
        jump: false,
        yaw: 0.8,
        pitch: -0.2,
      });
      expect(controls.touches.size).toBe(0);
      expect(controls.keys.size).toBe(0);
      Object.assign(doc, { hidden: false, hasFocus: () => true });
      expect(controls.read().fire).toBe(false);
      touch("pointerdown", "fire", 3);
      expect(controls.read().fire).toBe(true);
    },
  );

  it("左ボタンを保持した射撃は右ボタンの押下・解放で止まらない", () => {
    const { controls, mouse } = fixture();
    mouse("pointerdown");
    mouse("pointerdown", 2);
    expect(controls.read().fire).toBe(true);
    mouse("pointerup", 2);
    expect(controls.read().fire).toBe(true);
    mouse("pointerup");
    expect(controls.read().fire).toBe(false);
  });

  it("マウスの取消で射撃と照準を解放する", () => {
    const { controls, mouse } = fixture();
    mouse("pointerdown", 2);
    mouse("pointerdown");
    mouse("pointercancel");
    expect(controls.read().fire).toBe(false);
    expect(controls.aiming).toBe(false);
  });

  it("同時押しの左だけ解放するpointermoveでも射撃を終える", () => {
    const { controls, mouse, view, fire } = fixture();
    mouse("pointerdown");
    fire(view, "pointermove", {
      pointerType: "mouse",
      buttons: 2,
      movementX: 0,
      movementY: 0,
    });
    expect(controls.read().fire).toBe(false);
  });

  it("移動とスキルと射撃の指は個別に解放できる", () => {
    const { controls, touch } = fixture();
    touch("pointerdown", "move", 1);
    touch("pointermove", "move", 1, 30);
    touch("pointerdown", "fire", 2);
    touch("pointerdown", "dodge", 3);
    expect(controls.read()).toMatchObject({ mx: 0.6, fire: true, dodge: true });
    touch("pointerup", "dodge", 3);
    touch("lostpointercapture", "move", 1);
    expect(controls.read()).toMatchObject({ mx: 0, fire: true, dodge: false });
    touch("pointercancel", "fire", 2);
    expect(controls.read().fire).toBe(false);
  });

  it.each(["blur", "pagehide", "orientationchange", "hidden"])(
    "%sで入力と未消費スキルを消し復帰へ持ち越さない",
    (mode) => {
      const { controls, touch, mouse, view, doc, fire } = fixture();
      touch("pointerdown", "move", 1);
      touch("pointermove", "move", 1, 50);
      touch("pointerdown", "dodge", 2);
      mouse("pointerdown");
      fire(view, "keydown", { code: "KeyW", repeat: false });
      if (mode === "hidden") {
        Object.assign(doc, { hidden: true });
        fire(doc, "visibilitychange");
        Object.assign(doc, { hidden: false });
        fire(doc, "visibilitychange");
      } else fire(view, mode);
      expect(controls.read()).toMatchObject({
        mx: 0,
        mz: 0,
        fire: false,
        dodge: false,
      });
      expect(controls.touches.size).toBe(0);
      touch("pointerdown", "fire", 3);
      expect(controls.read().fire).toBe(true);
    },
  );
});
