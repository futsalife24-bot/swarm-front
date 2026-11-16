import { describe, expect, it, vi } from "vitest";
import {
  ControlVoiceQueue,
  type ControlVoiceId,
} from "../src/client/control-voice";
import { reportIdentification } from "../src/client/report-identification";
import { ENEMY_REPORT_ORDER } from "../src/shared/enemy-report-order";

function fixture(
  voice: ControlVoiceId = "hiromi",
  ready = true,
  enabled = true,
) {
  const start = vi.fn((_path: string, _end: () => void) => vi.fn());
  const queue = new ControlVoiceQueue(
    { ready: () => ready, start },
    { voice, enabled },
  );
  const announce = vi.fn((id: string) => queue.request(id));
  return {
    start,
    queue,
    announce,
    report: reportIdentification({
      controlVoice: queue,
      announce,
      unlock: vi.fn(),
    }),
  };
}

describe("エネミーレポートの識別名", () => {
  it.each(["hiromi", "hiyori", "yoko"] as const)(
    "選択した%sのCALYXを一度だけ要求する",
    (voice) => {
      const { report, start, announce } = fixture(voice);
      report.select("calyx", "solo");
      report.select("calyx", "solo");
      expect(announce).toHaveBeenCalledTimes(1);
      expect(start.mock.calls[0][0]).toBe(
        `voice-control-${voice}-v1/anomaly-calyx`,
      );
      report.stop();
      expect(start.mock.results[0].value).toHaveBeenCalledTimes(1);
    },
  );
  it.each([undefined, "coop"] as const)(
    "未判明状態%sでは識別名を要求しない",
    (state) => {
      const { report, announce, start } = fixture();
      for (const key of ENEMY_REPORT_ORDER) report.select(key, state);
      expect(announce).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    },
  );
  it("未収録9種では無音となり前の発話を止める", () => {
    const { report, start, announce } = fixture();
    report.select("calyx", "solo");
    for (const key of ENEMY_REPORT_ORDER.filter((key) => key !== "calyx"))
      report.select(key, "solo");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(start.mock.results[0].value).toHaveBeenCalledTimes(1);
  });
  it.each([
    [false, true],
    [true, false],
  ])("パック未保存/ボイスなしでは再生しない", (ready, enabled) => {
    const { report, start } = fixture("hiromi", ready, enabled);
    report.select("calyx", "solo");
    expect(start).not.toHaveBeenCalled();
  });
  it.each(["select", "close"])(
    "%sで古い非同期準備を取り消す",
    async (action) => {
      let finish!: () => void;
      let ready = false;
      const start = vi.fn((_path: string, _end: () => void) => vi.fn());
      const queue = new ControlVoiceQueue({
        ready: () => ready,
        start,
        prepare: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      });
      const report = reportIdentification({
        controlVoice: queue,
        announce: (id) => queue.request(id),
        unlock: vi.fn(),
      });
      report.select("calyx", "solo");
      if (action === "select") report.select("harrow", "coop");
      else report.stop();
      ready = true;
      finish();
      await Promise.resolve();
      expect(start).not.toHaveBeenCalled();
    },
  );
});
