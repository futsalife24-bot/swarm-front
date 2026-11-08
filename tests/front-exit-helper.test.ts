import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import type { Dialog, Page } from "@playwright/test";
import { confirmDeparture } from "../e2e/confirm-departure";

it("P2-03: ダイアログより先の操作失敗を元の原因で返しリスナーを回収", async () => {
  const events = new EventEmitter();
  const error = new Error("operation failed first");
  await expect(
    confirmDeparture(
      events as unknown as Page,
      async () => {
        throw error;
      },
      false,
      30,
    ),
  ).rejects.toBe(error);
  expect(events.listenerCount("dialog")).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 40));
});
it("P2-03: 想定外ダイアログをdismissし後続rejectも回収", async () => {
  const events = new EventEmitter();
  let rejectAction!: (error: Error) => void;
  const dialog = {
    type: () => "alert",
    dismiss: vi.fn(async () => {
      rejectAction(new Error("later rejection"));
    }),
  };
  await expect(
    confirmDeparture(
      events as unknown as Page,
      () =>
        new Promise((_, reject) => {
          rejectAction = reject;
          events.emit("dialog", dialog);
        }),
      false,
      30,
    ),
  ).rejects.toThrow("想定外のダイアログ");
  expect(dialog.dismiss).toHaveBeenCalledOnce();
  expect(events.listenerCount("dialog")).toBe(0);
});
it("P2-03: ダイアログ未到着でも待機とリスナーを回収", async () => {
  const events = new EventEmitter();
  await expect(
    confirmDeparture(events as unknown as Page, async () => {}, false, 5),
  ).rejects.toThrow("到着しません");
  expect(events.listenerCount("dialog")).toBe(0);
});
it("P2-03: 取消に伴うnavigationエラーは確認処理後だけ許容", async () => {
  const events = new EventEmitter();
  let rejectAction!: (error: Error) => void;
  const dialog = {
    type: () => "beforeunload",
    dismiss: vi.fn(async () => {
      rejectAction(new Error("net::ERR_ABORTED"));
    }),
  };
  await confirmDeparture(
    events as unknown as Page,
    () =>
      new Promise((_, reject) => {
        rejectAction = reject;
        events.emit("dialog", dialog as unknown as Dialog);
      }),
    false,
    30,
  );
  expect(dialog.dismiss).toHaveBeenCalledOnce();
  expect(events.listenerCount("dialog")).toBe(0);
});
