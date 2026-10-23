import type { MockStore } from "./storage";
export type OrientationPreference = "auto" | "portrait" | "landscape";
type NativeOrientation = ScreenOrientation & {
  lock?: (direction: string) => Promise<void>;
};
export class MockOrientation {
  preference: OrientationPreference;
  status = "端末の回転設定に従います。";
  private generation = 0;
  private target: string | undefined;
  private listeners = new Set<() => void>();
  private requestId = 0;
  constructor(private store: MockStore) {
    const saved = store.read<{ preference?: unknown }>(
      "orientation",
      {},
    ).preference;
    this.preference =
      saved === "portrait" || saved === "landscape" ? saved : "auto";
    this.resolveTarget();
    document.addEventListener("fullscreenchange", () => void this.apply());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void this.apply();
    });
    window.addEventListener("pageshow", () => void this.apply());
    void this.apply();
  }
  private emit() {
    for (const f of this.listeners) f();
  }
  subscribe(f: () => void) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  set(value: OrientationPreference) {
    if (!this.store.write("orientation", { version: 1, preference: value })) {
      this.status = "保存できなかったため、変更前の設定を維持しています。";
      this.emit();
      return false;
    }
    this.preference = value;
    this.generation++;
    this.resolveTarget();
    void this.apply();
    return true;
  }
  private resolveTarget() {
    const actual = screen.orientation?.type;
    this.target =
      this.preference === "auto"
        ? "any"
        : actual?.startsWith(this.preference)
          ? actual
          : `${this.preference}-primary`;
  }
  async apply() {
    if (document.hidden || window.top !== window) return;
    const version = this.generation,
      requestId = ++this.requestId,
      direction = this.target!,
      native = screen.orientation as NativeOrientation | undefined;
    const current = () =>
      version === this.generation && requestId === this.requestId;
    if (!native?.lock) {
      this.status =
        this.preference === "auto"
          ? "端末の回転設定に従います。"
          : "この環境では固定できません。端末の回転ロックを利用してください。現在の向きで遊べます。";
      this.emit();
      return;
    }
    this.status = "向きを変更しています…";
    this.emit();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (this.preference === "auto") native.unlock();
      const locking = native.lock!(direction);
      // A late success may have physically applied an old native lock. Reapply
      // the latest preference, but never block a new choice on that old promise.
      void locking.then(
        () => {
          if (version !== this.generation) void this.apply();
        },
        () => {},
      );
      const completed = await Promise.race([
        locking.then(() => true),
        new Promise<false>((resolve) => {
          timeout = setTimeout(() => resolve(false), 3000);
        }),
      ]);
      if (current())
        this.status = !completed
          ? "設定は保存済みです。適用を確認できません。端末の回転設定をご確認ください。"
          : this.preference === "auto"
            ? "端末の回転設定に従います。"
            : `${this.preference === "portrait" ? "縦" : "横"}向きに固定しました。`;
    } catch (error) {
      if (
        current() &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        this.status =
          this.preference === "auto"
            ? "端末の回転設定に従います。"
            : document.fullscreenElement
              ? "この環境では固定できません。端末の回転ロックを利用してください。現在の向きで遊べます。"
              : "設定は保存済みです。全画面で再適用します。固定できない場合は端末の回転ロックを利用してください。";
    } finally {
      clearTimeout(timeout);
    }
    if (current()) this.emit();
  }
  async fullscreen() {
    if (
      !document.fullscreenElement &&
      !document.querySelector("dialog[open]")
    ) {
      try {
        await document.documentElement.requestFullscreen?.({
          navigationUI: "hide",
        });
      } catch {
        /* Windowed play remains available. */
      }
    }
    await this.apply();
  }
  mount(container: HTMLElement) {
    const row = document.createElement("div");
    row.className = "mock-orientation-setting";
    row.innerHTML =
      '<label>画面の向き<select aria-label="画面の向き"><option value="auto">自動</option><option value="portrait">縦固定</option><option value="landscape">横固定</option></select></label><p role="status"></p>';
    container.append(row);
    const select = row.querySelector("select")!,
      status = row.querySelector("p")!;
    const update = () => {
      select.value = this.preference;
      status.textContent = this.status;
    };
    select.onchange = () => this.set(select.value as OrientationPreference);
    update();
    return this.subscribe(update);
  }
}
