import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPlayback } from "../src/client/media-playback";
import { BackgroundMusic } from "../src/client/bgm";

class Media extends EventTarget {
  src = "";
  paused = true;
  currentTime = 12;
  volume = 0.35;
  muted = false;
  dataset: Record<string, string> = {};
  pause = vi.fn(() => {
    this.paused = true;
  });
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  load = vi.fn();
  removeAttribute() {
    this.src = "";
  }
}
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
let media: Media;
let doc: EventTarget & { hidden: boolean; body: { append: () => void } };
const cleanups: (() => void)[] = [];
beforeEach(() => {
  doc = Object.assign(new EventTarget(), {
    hidden: false,
    body: { append() {} },
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", new EventTarget());
  media = new Media();
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return media;
      }
    },
  );
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function preview() {
  const status = vi.fn();
  const p = new MediaPlayback(media as unknown as HTMLMediaElement, status);
  cleanups.push(() => p.dispose());
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { p, status, create, revoke };
}
const response = () => new Response(new Blob(["clip"]));

describe("media preview lifetime", () => {
  it("opens paused, plays on request and releases the clip on close", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const { p, revoke } = preview();
    await p.load("/pv.mp4");
    expect(media.play).not.toHaveBeenCalled();
    expect(media.src).toBe("blob:test");
    p.play();
    await tick();
    expect(media.paused).toBe(false);
    p.dispose();
    expect(media.paused).toBe(true);
    expect(media.src).toBe("");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:test");
  });
  it("discards an older download when a new track wins", async () => {
    let old!: (v: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            old = r;
          }),
      )
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetcher);
    const { p, create } = preview();
    const a = p.load("/a.mp3", true);
    await p.load("/b.mp3", true);
    old(response());
    await a;
    await tick();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(1);
  });
  it("closing during download cannot revive playback", async () => {
    let finish!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            finish = r;
          }),
      ),
    );
    const { p, create } = preview();
    const pending = p.load("/pv.mp4", true);
    p.dispose();
    finish(response());
    await pending;
    expect(create).not.toHaveBeenCalled();
    expect(media.play).not.toHaveBeenCalled();
  });
  it("pause during loading cancels deferred autoplay", async () => {
    let finish!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            finish = r;
          }),
      ),
    );
    const { p } = preview();
    const pending = p.load("/track.mp3", true);
    p.pause();
    finish(response());
    await pending;
    expect(media.src).toBe("blob:test");
    expect(media.play).not.toHaveBeenCalled();
  });
  it("pauses on hidden and does not autoplay after returning", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const { p } = preview();
    await p.load("/track.mp3", true);
    await tick();
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(media.paused).toBe(true);
    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(media.play).toHaveBeenCalledTimes(1);
  });
  it("reports fetch and playback failures and allows retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(response()),
    );
    const { p, status } = preview();
    await p.load("/track.mp3");
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("再読み込み"),
    );
    media.play.mockRejectedValueOnce(new Error("Blocked"));
    await p.load("/track.mp3", true);
    await tick();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("押し直し"),
    );
    p.play();
    await tick();
    expect(media.paused).toBe(false);
  });
});

describe("scene music while previewing", () => {
  it("preserves the scene source and position, respecting multiple owners", async () => {
    const bgm = new BackgroundMusic();
    bgm.setScreen("title");
    bgm.unlock();
    await tick();
    const source = media.src;
    const a = bgm.suspend(),
      b = bgm.suspend();
    bgm.unlock();
    expect(media.paused).toBe(true);
    a();
    a();
    expect(media.paused).toBe(true);
    b();
    await tick();
    expect(media.paused).toBe(false);
    expect(media.src).toBe(source);
    expect(media.currentTime).toBe(12);
  });
  it("returns to a scene changed while suspended and honors mute", async () => {
    const bgm = new BackgroundMusic();
    bgm.setScreen("title");
    bgm.unlock();
    await tick();
    const release = bgm.suspend();
    bgm.setScreen("gear");
    bgm.volume = 0;
    release();
    await tick();
    expect(media.dataset.track).toBe("prepare");
    expect(media.paused).toBe(true);
    bgm.volume = 0.35;
    await tick();
    expect(media.paused).toBe(false);
  });
  it("retries after a pending same-track play was paused then released", async () => {
    let reject!: (e: Error) => void;
    media.play.mockImplementationOnce(
      () =>
        new Promise<void>((_, r) => {
          reject = r;
        }),
    );
    const bgm = new BackgroundMusic();
    bgm.setScreen("title");
    bgm.unlock();
    const release = bgm.suspend();
    release();
    reject(new Error("AbortError"));
    await tick();
    expect(media.play).toHaveBeenCalledTimes(2);
    expect(media.paused).toBe(false);
  });
});
