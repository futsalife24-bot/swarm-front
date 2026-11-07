import { afterEach, expect, it, vi } from "vitest";
import {
  bindRewardWeaponDetails,
  REWARD_DETAIL_HOLD_MS,
} from "../src/client/reward-weapon-details";

function fixture() {
  vi.useFakeTimers();
  const view = new EventTarget();
  const owner = Object.assign(new EventTarget(), {
    defaultView: view,
    hidden: false,
    querySelector: () => null as unknown,
  });
  const button = Object.assign(new EventTarget(), {
    dataset: { detail: "reward-weapon" },
    disabled: false,
    isConnected: true,
    focus: vi.fn(),
    setAttribute: vi.fn(),
    closest: () => button,
  });
  const other = { closest: () => null };
  const root = Object.assign(new EventTarget(), {
    ownerDocument: owner,
    querySelectorAll: () => [button],
  });
  const open = vi.fn();
  const dispose = bindRewardWeaponDetails(root as unknown as HTMLElement, open);
  const fire = (
    type: string,
    target: EventTarget = root,
    fields = {},
    element: unknown = button,
  ) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(
      e,
      {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 40,
        clientY: 40,
        detail: 1,
      },
      fields,
    );
    Object.defineProperty(e, "target", { value: element });
    target.dispatchEvent(e);
    return e;
  };
  return { button, root, view, owner, other, open, fire, dispose };
}
afterEach(() => vi.useRealTimers());

it("500msで既存詳細を一度開き、指を離した後のクリックを二重処理しない", () => {
  const f = fixture();
  f.fire("pointerdown");
  vi.advanceTimersByTime(REWARD_DETAIL_HOLD_MS - 1);
  expect(f.open).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(f.open).toHaveBeenCalledExactlyOnceWith("reward-weapon");
  expect(f.button.focus).toHaveBeenCalledWith({ preventScroll: true });
  f.fire("pointerup", f.view);
  expect(f.fire("click").defaultPrevented).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(f.open).toHaveBeenCalledTimes(1);
  f.dispose();
});

it("短押しとキーボード・補助技術クリックは既存ボタン処理へ渡す", () => {
  const f = fixture();
  f.fire("pointerdown");
  vi.advanceTimersByTime(100);
  f.fire("pointerup", f.view);
  expect(f.fire("click").defaultPrevented).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(f.open).not.toHaveBeenCalled();
  f.fire("pointerdown");
  vi.advanceTimersByTime(500);
  expect(f.fire("click", f.root, { detail: 0 }).defaultPrevented).toBe(false);
  f.dispose();
});

it.each(["pointercancel", "blur", "pagehide", "resize", "keydown"])(
  "%sで長押しを中断する",
  (type) => {
    const f = fixture();
    f.fire("pointerdown");
    f.fire(type, f.view);
    vi.advanceTimersByTime(1000);
    expect(f.open).not.toHaveBeenCalled();
    expect(f.fire("click").defaultPrevented).toBe(true);
    f.dispose();
  },
);

it.each(["scroll", "visibilitychange"])("%sで長押しを中断する", (type) => {
  const f = fixture();
  f.fire("pointerdown");
  f.fire(type, f.owner);
  vi.advanceTimersByTime(1000);
  expect(f.open).not.toHaveBeenCalled();
  f.dispose();
});

it("8pxより動いたら、元の位置へ戻っても開かない。通常スクロールを妨げない", () => {
  const f = fixture();
  expect(f.fire("pointerdown").defaultPrevented).toBe(false);
  expect(f.fire("pointermove", f.view, { clientX: 50 }).defaultPrevented).toBe(
    false,
  );
  f.fire("pointermove", f.view);
  vi.advanceTimersByTime(1000);
  expect(f.open).not.toHaveBeenCalled();
  expect(f.fire("click").defaultPrevented).toBe(true);
  f.dispose();
});

it("指の小さな揺れは許容し、別の指が触れると取消する", () => {
  const f = fixture();
  f.fire("pointerdown");
  f.fire("pointermove", f.view, { clientX: 44, clientY: 44 });
  vi.advanceTimersByTime(500);
  expect(f.open).toHaveBeenCalledTimes(1);
  f.fire("pointerdown");
  f.fire("pointerdown", f.view, { pointerId: 2, isPrimary: false }, f.other);
  vi.advanceTimersByTime(500);
  expect(f.open).toHaveBeenCalledTimes(1);
  f.dispose();
});

it("範囲外へ出たら取消し、ロック/効果/右クリック/非主指では開始しない", () => {
  const f = fixture();
  f.fire("pointerdown");
  f.fire("pointerleave", f.button);
  f.fire("pointerdown", f.root, {}, f.other);
  f.fire("pointerdown", f.root, { button: 2 });
  f.fire("pointerdown", f.root, { isPrimary: false });
  vi.advanceTimersByTime(1000);
  expect(f.open).not.toHaveBeenCalled();
  expect(f.fire("click", f.root, {}, f.other).defaultPrevented).toBe(false);
  expect(f.fire("contextmenu", f.root, {}, f.other).defaultPrevented).toBe(
    false,
  );
  expect(f.fire("contextmenu").defaultPrevented).toBe(true);
  f.dispose();
});

it("画面破棄・無効化・別モーダルの表示中は後から開かない", () => {
  const f = fixture();
  f.fire("pointerdown");
  f.button.isConnected = false;
  vi.advanceTimersByTime(500);
  f.button.isConnected = true;
  f.fire("pointerdown");
  f.button.disabled = true;
  vi.advanceTimersByTime(500);
  f.button.disabled = false;
  f.fire("pointerdown");
  f.owner.querySelector = () => ({});
  vi.advanceTimersByTime(500);
  f.owner.querySelector = () => null;
  f.fire("pointerdown");
  f.dispose();
  vi.advanceTimersByTime(500);
  f.fire("pointerdown");
  vi.advanceTimersByTime(500);
  expect(f.open).not.toHaveBeenCalled();
});

it("取消後も次の長押しを受け付け、別のpointerupでは解除しない", () => {
  const f = fixture();
  f.fire("pointerdown");
  f.fire("scroll", f.owner);
  f.fire("pointerdown");
  f.fire("pointerup", f.view, { pointerId: 2 });
  vi.advanceTimersByTime(500);
  expect(f.open).toHaveBeenCalledTimes(1);
  expect(f.button.setAttribute).toHaveBeenCalledWith("aria-haspopup", "dialog");
  f.dispose();
});
