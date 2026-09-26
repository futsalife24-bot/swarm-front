import { describe, expect, it, vi } from "vitest";
import { closeMenuDialog } from "../src/client/menu-ui";

/** Native close() is a no-op before showModal(); close events are async. */
class Dialog extends EventTarget {
  open = false;
  isConnected = true;
  cleanup = vi.fn(() => {
    this.isConnected = false;
  });
  constructor() {
    super();
    this.addEventListener("close", this.cleanup, { once: true });
  }
  close = vi.fn(() => {
    if (!this.open) return;
    this.open = false;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  });
  showAfterFullscreen() {
    if (this.isConnected && !this.open) this.open = true;
  }
}

describe("media dialog cancellation while fullscreen is pending", () => {
  it.each(["sound", "pv"])(
    "cancels an unopened %s dialog and runs its resource cleanup",
    () => {
      const d = new Dialog();
      const releaseBgm = vi.fn();
      const disposePreview = vi.fn();
      d.addEventListener(
        "close",
        () => {
          disposePreview();
          releaseBgm();
        },
        { once: true },
      );
      closeMenuDialog(d as unknown as HTMLDialogElement);
      d.showAfterFullscreen();
      expect(d.open).toBe(false);
      expect(d.isConnected).toBe(false);
      expect(disposePreview).toHaveBeenCalledTimes(1);
      expect(releaseBgm).toHaveBeenCalledTimes(1);
      closeMenuDialog(d as unknown as HTMLDialogElement);
      expect(releaseBgm).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves native close behavior for an already open dialog", async () => {
    const d = new Dialog();
    d.open = true;
    closeMenuDialog(d as unknown as HTMLDialogElement);
    await Promise.resolve();
    expect(d.close).toHaveBeenCalledTimes(1);
    expect(d.cleanup).toHaveBeenCalledTimes(1);
    d.showAfterFullscreen();
    expect(d.open).toBe(false);
  });
});
