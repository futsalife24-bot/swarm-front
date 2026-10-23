import { readInsets } from "../layout";
import type { ViewportSnapshot } from "./geometry";

export class MockViewport {
  snapshot: ViewportSnapshot;
  private listeners = new Set<
    (next: ViewportSnapshot, previous: ViewportSnapshot) => void
  >();
  private pending = 0;
  constructor() {
    this.snapshot = this.measure();
    for (const name of ["resize", "orientationchange", "pageshow"])
      window.addEventListener(name, this.schedule);
    document.addEventListener("fullscreenchange", this.schedule);
    screen.orientation?.addEventListener("change", this.schedule);
    window.visualViewport?.addEventListener("resize", this.schedule);
    window.visualViewport?.addEventListener("scroll", this.schedule);
    document.addEventListener("focusout", this.schedule);
    this.apply();
  }
  private measure(): ViewportSnapshot {
    const width = innerWidth,
      height = innerHeight;
    const screenAngle = screen.orientation?.angle ?? null;
    const editing =
      document.activeElement?.matches(
        "input,textarea,[contenteditable=true]",
      ) ?? false;
    const keyboardOnly =
      this.snapshot &&
      editing &&
      this.snapshot.width === width &&
      this.snapshot.screenAngle === screenAngle;
    return {
      width,
      height,
      screenAngle,
      insets: readInsets(),
      mode: keyboardOnly
        ? this.snapshot.mode
        : width < height
          ? "portrait"
          : "landscape",
      revision: (this.snapshot?.revision ?? 0) + 1,
    };
  }
  schedule = () => {
    if (!this.pending)
      this.pending = requestAnimationFrame(() => {
        this.pending = 0;
        this.refresh();
      });
  };
  refresh() {
    const previous = this.snapshot;
    this.snapshot = this.measure();
    this.apply();
    for (const listener of this.listeners) listener(this.snapshot, previous);
  }
  private apply() {
    const v = this.snapshot,
      root = document.documentElement;
    root.dataset.mockOrientation = v.mode;
    root.style.setProperty("--mock-width", `${v.width}px`);
    root.style.setProperty("--mock-height", `${v.height}px`);
    root.style.setProperty("--view-center-x", `${v.width / 2}px`);
    root.style.setProperty("--view-center-y", `${v.height / 2}px`);
    const vv = visualViewport;
    root.style.setProperty(
      "--mock-visible-height",
      `${vv?.height ?? v.height}px`,
    );
    root.style.setProperty("--mock-visible-top", `${vv?.offsetTop ?? 0}px`);
  }
  subscribe(
    listener: (next: ViewportSnapshot, previous: ViewportSnapshot) => void,
  ) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
