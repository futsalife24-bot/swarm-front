import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ControlCaptions,
  captionVisible,
  loadCaptionMode,
  loadVoiceEnabled,
  CONTROL_CAPTIONS_KEY,
  CONTROL_VOICE_ENABLED_KEY,
} from "../src/client/control-captions";
import { ControlVoiceQueue } from "../src/client/control-voice";

const setup = (ready = true) => {
  let end = () => {};
  const start = vi.fn((_path: string, ended: () => void) => {
    end = ended;
    return vi.fn();
  });
  const captions: [string, boolean][] = [];
  const q = new ControlVoiceQueue(
    { ready: () => ready, start },
    { caption: (line, audible) => captions.push([line.id, audible]) },
  );
  return { q, start, captions, end: () => end() };
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("管制AI字幕とボイスなし", () => {
  it("音声の有無と3つの表示設定を独立して扱う", () => {
    expect([true, false].map((v) => captionVisible("always", v))).toEqual([
      true,
      true,
    ]);
    expect([true, false].map((v) => captionVisible("missing", v))).toEqual([
      false,
      true,
    ]);
    expect([true, false].map((v) => captionVisible("never", v))).toEqual([
      false,
      false,
    ]);
  });
  it("未保存は従来の台詞字幕なし・ボイスありを維持する", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(loadCaptionMode()).toBe("never");
    expect(loadVoiceEnabled()).toBe(true);
  });
  it("新しいキーで字幕と音声を復元し、破損した字幕値を既定へ戻す", () => {
    const values = new Map([
      [CONTROL_CAPTIONS_KEY, "missing"],
      [CONTROL_VOICE_ENABLED_KEY, "false"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key),
    });
    expect(loadCaptionMode()).toBe("missing");
    expect(loadVoiceEnabled()).toBe(false);
    values.set(CONTROL_CAPTIONS_KEY, "broken");
    expect(loadCaptionMode()).toBe("never");
  });
  it("保存先が使えなくても動作を続ける", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
    });
    expect(loadCaptionMode()).toBe("never");
    expect(loadVoiceEnabled()).toBe(true);
  });
  it("音声パックがあってもボイスなしなら再生せず字幕へ通知する", () => {
    const { q, start, captions } = setup();
    q.enabled = false;
    expect(q.request("title")).toBe("unavailable");
    expect(start).not.toHaveBeenCalled();
    expect(captions).toEqual([["title", false]]);
  });
  it("未DL・音量0・読み込み失敗でも採用台詞を字幕へ渡す", () => {
    const { q, captions } = setup(false);
    expect(q.request("title")).toBe("unavailable");
    expect(captions).toEqual([["title", false]]);
  });
  it("音声ありでは発話開始時に字幕へ通知し、同じ再生要求を重ねない", () => {
    const { q, captions } = setup();
    expect(q.request("title")).toBe("playing");
    expect(q.request("title")).toBe("duplicate");
    expect(captions).toEqual([["title", true]]);
  });
  it("準備のタイムアウトは音声を始めず字幕へ渡す", () => {
    const { q, start, captions } = setup();
    expect(q.request("title", false)).toBe("unavailable");
    expect(start).not.toHaveBeenCalled();
    expect(captions).toEqual([["title", false]]);
  });
  it("待機する基礎訓練の字幕は実際の再生開始と同期する", () => {
    const { q, captions, end } = setup();
    q.request("title");
    expect(q.request("tut-offer")).toBe("queued");
    expect(captions).toHaveLength(1);
    end();
    expect(captions).toEqual([
      ["title", true],
      ["tut-offer", true],
    ]);
  });
  it("禁止台詞や人数の違う台詞は字幕にも出さない", () => {
    const { q, captions } = setup(false);
    expect(q.request("ally-down")).toBe("filtered");
    expect(q.request("brief-01")).toBe("disabled");
    expect(captions).toEqual([]);
  });
});

for (const unavailable of ["missing", "throws"]) {
  it(`Popover APIが${unavailable}でも字幕でゲーム処理を止めない`, () => {
    vi.useFakeTimers();
    const node = {
      dataset: {},
      isConnected: false,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      remove: vi.fn(),
      ...(unavailable === "throws"
        ? {
            showPopover: () => {
              throw Error("inactive document");
            },
          }
        : {}),
    };
    vi.stubGlobal("localStorage", { getItem: () => "always" });
    vi.stubGlobal("document", {
      createElement: () => node,
      body: { append: vi.fn() },
    });
    const captions = new ControlCaptions();
    const line = { id: "title", text: "スウォーム・フロント。" } as Parameters<
      ControlCaptions["show"]
    >[0];
    expect(() => captions.show(line, true)).not.toThrow();
    expect(node.removeAttribute).toHaveBeenCalledWith("popover");
    vi.advanceTimersByTime(13000);
    expect(node.remove).toHaveBeenCalled();
  });
}
