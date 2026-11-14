import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadVoiceEnabled,
  CONTROL_VOICE_ENABLED_KEY,
} from "../src/client/control-voice-enabled";
import { ControlVoiceQueue } from "../src/client/control-voice";
afterEach(() => vi.unstubAllGlobals());
describe("管制AIのボイスあり／なし", () => {
  it("既存の無効値を復元し、旧字幕値を読み書きしない", () => {
    const getItem = vi.fn((key: string) =>
      key === CONTROL_VOICE_ENABLED_KEY ? "false" : "always",
    );
    vi.stubGlobal("localStorage", { getItem });
    expect(loadVoiceEnabled()).toBe(false);
    expect(getItem.mock.calls).toEqual([[CONTROL_VOICE_ENABLED_KEY]]);
  });
  it("未保存と保存先が使えない場合は従来の有効状態", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(loadVoiceEnabled()).toBe(true);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
    });
    expect(loadVoiceEnabled()).toBe(true);
  });
  it.each(["disabled", "missing", "timeout"])(
    "%s時は再生も代替表示もせず進行を続ける",
    (state) => {
      const start = vi.fn();
      const createElement = vi.fn();
      vi.stubGlobal("document", { createElement });
      const q = new ControlVoiceQueue(
        { ready: () => state !== "missing", start },
        { enabled: state !== "disabled" },
      );
      expect(q.request("title", state !== "timeout")).toBe("unavailable");
      expect(start).not.toHaveBeenCalled();
      expect(createElement).not.toHaveBeenCalled();
    },
  );
});
