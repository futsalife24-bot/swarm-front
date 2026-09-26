/** One requested clip, with cancellable loading and bounded Blob lifetime. */
export class MediaPlayback {
  private request?: AbortController;
  private objectUrl?: string;
  private source = "";
  private disposed = false;
  private revision = 0;
  private hide = () => {
    if (document.hidden) this.pause();
  };
  private pageHide = () => this.pause();
  private failed = () =>
    this.status("読み込めませんでした。「再読み込み」をお試しください。");
  constructor(
    private media: HTMLMediaElement,
    private status: (message: string) => void,
  ) {
    document.addEventListener("visibilitychange", this.hide);
    window.addEventListener("pagehide", this.pageHide);
    media.addEventListener("error", this.failed);
  }
  async load(source: string, autoplay = false) {
    if (this.disposed) return;
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.source = source;
    this.clear();
    const revision = this.revision;
    this.status("読み込み中…");
    try {
      const response = await fetch(source, { signal: request.signal });
      if (!response.ok) throw new Error("Media unavailable");
      const blob = await response.blob();
      if (this.disposed || request.signal.aborted) return;
      // Existing static hosting returns complete files; Blob enables seeking.
      this.objectUrl = URL.createObjectURL(blob);
      this.media.src = this.objectUrl;
      this.status("再生ボタンで開始できます。");
      if (autoplay && revision === this.revision) this.play();
    } catch {
      if (!this.disposed && !request.signal.aborted) this.failed();
    }
  }
  play() {
    if (this.disposed || document.hidden) return;
    if (!this.objectUrl) {
      void this.load(this.source, true);
      return;
    }
    const revision = ++this.revision;
    void this.media.play().then(
      () => {
        if (!this.disposed && revision === this.revision) this.status("");
      },
      () => {
        if (!this.disposed && revision === this.revision)
          this.status("再生できませんでした。再生ボタンを押し直してください。");
      },
    );
  }
  pause() {
    this.revision++;
    this.media.pause();
  }
  private clear() {
    this.pause();
    this.media.removeAttribute("src");
    this.media.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.request?.abort();
    document.removeEventListener("visibilitychange", this.hide);
    window.removeEventListener("pagehide", this.pageHide);
    this.media.removeEventListener("error", this.failed);
    this.clear();
  }
}
