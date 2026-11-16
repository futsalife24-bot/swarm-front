import { describe, expect, it, vi } from "vitest";
import {
  ControlVoiceQueue,
  type ControlVoiceId,
} from "../src/client/control-voice";
import {
  reportIdentification,
  REPORT_IDENTIFICATION_CLIPS,
} from "../src/client/report-identification";
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
    "%sの導入は遷移ごとに一度だけ、選択で停止して識別名へ切り替える",
    (voice) => {
      const { report, start, announce } = fixture(voice);
      report.enter();
      report.enter();
      expect(start.mock.calls[0][0]).toBe(
        `voice-control-${voice}-v1/enemy-report-intro`,
      );
      expect(announce).toHaveBeenCalledTimes(1);
      report.select("calyx", "solo");
      expect(start.mock.results[0].value).toHaveBeenCalledTimes(1);
      report.enter();
      expect(announce.mock.calls.map(([id]) => id)).toEqual([
        "enemy-report-intro",
        "anomaly-calyx",
      ]);
    },
  );
  it.each([
    [false, true],
    [true, false],
  ])("導入も未保存/無効では無音", (ready, enabled) => {
    const { report, start } = fixture("hiromi", ready, enabled);
    report.enter();
    expect(start).not.toHaveBeenCalled();
  });
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
  it.each(["hiromi", "hiyori", "yoko"] as const)(
    "%sで全10種の識別名を選択ごとに一度再生し、前の発話を止める",
    (voice) => {
      const { report, start, announce } = fixture(voice);
      expect(Object.keys(REPORT_IDENTIFICATION_CLIPS).sort()).toEqual(
        [...ENEMY_REPORT_ORDER].sort(),
      );
      for (const key of ENEMY_REPORT_ORDER) {
        report.select(key, "solo");
        report.select(key, "solo");
      }
      expect(announce.mock.calls.map(([id]) => id)).toEqual(
        ENEMY_REPORT_ORDER.map((key) => REPORT_IDENTIFICATION_CLIPS[key]),
      );
      expect(start.mock.calls.map(([path]) => path)).toEqual(
        ENEMY_REPORT_ORDER.map(
          (key) =>
            `voice-control-${voice}-v1/${REPORT_IDENTIFICATION_CLIPS[key]}`,
        ),
      );
      for (const result of start.mock.results.slice(0, -1))
        expect(result.value).toHaveBeenCalledTimes(1);
      report.stop();
      expect(start.mock.results.at(-1)!.value).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [false, true],
    [true, false],
  ])("パック未保存/ボイスなしでは再生しない", (ready, enabled) => {
    const { report, start } = fixture("hiromi", ready, enabled);
    for (const key of ENEMY_REPORT_ORDER) report.select(key, "solo");
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
      report.enter();
      if (action === "select") report.select("harrow", "coop");
      else report.stop();
      ready = true;
      finish();
      await Promise.resolve();
      expect(start).not.toHaveBeenCalled();
    },
  );
});
