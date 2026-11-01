import { expect, it } from "vitest";
import {
  ConnectionDiagnostics,
  connectionLabel,
} from "../src/client/connection-diagnostics";

it("サーバー時計ではなくping/pongの実経過を測り、接続変更で捨てる", () => {
  const d = new ConnectionDiagnostics();
  expect(d.read(0).roundTripMs).toBeUndefined();
  d.ping(100);
  d.pong(420);
  expect(d.read(420).roundTripMs).toBe(320);
  expect(d.read(16000).roundTripMs).toBeUndefined();
  d.reset();
  d.pong(17000);
  expect(d.read(17000).roundTripMs).toBeUndefined();
});

it("遅れた複数pongを直近pingへ誤対応させない", () => {
  const d = new ConnectionDiagnostics();
  d.ping(0);
  d.ping(5000);
  d.pong(10000);
  expect(d.read(10000).roundTripMs).toBe(10000);
  d.ping(10000);
  d.pong(10100);
  expect(d.read(10100).roundTripMs).toBe(5100);
});

it("戦況更新を描画回数から独立して数え、停止を0回と表示する", () => {
  const d = new ConnectionDiagnostics();
  for (let at = 0; at <= 1000; at += 100) d.state(at);
  expect(d.read(1000)).toMatchObject({ updatesPerSecond: 10, stateAgeMs: 0 });
  expect(d.read(2100)).toMatchObject({ updatesPerSecond: 0, stateAgeMs: 1100 });
  expect(connectionLabel(d.read(2100))).toBe(" · 往復 —ms · 更新待ち 1100ms");
});

it("一度に届いた戦況を極端なHzへ換算せず、直近1秒の実数にする", () => {
  const d = new ConnectionDiagnostics();
  d.state(0);
  d.state(1000);
  d.state(1000);
  expect(d.read(1000).updatesPerSecond).toBe(2);
});

it("未応答が上限を超えたら未測定に戻し、メモリを増やさない", () => {
  const d = new ConnectionDiagnostics();
  for (let at = 0; at < 100; at++) d.ping(at);
  d.pong(300);
  expect(d.read(300).roundTripMs).toBeUndefined();
  d.reset();
  d.ping(400);
  d.pong(500);
  expect(d.read(500).roundTripMs).toBe(100);
});

it("受信・適用・描画提出を区別し、時計差なしで上限付きに集計する", () => {
  const d = new ConnectionDiagnostics();
  d.sampled(1, 100);
  d.sent(1, 3, 120);
  d.receipt(1, 180);
  d.receipt(1, 190);
  d.applied(1, 300);
  d.rendered(320);
  d.rendered(340);
  const s = d.details().samples;
  expect(s.sampleToSendMs.max).toBe(20);
  expect(s.sendToReceiptMs).toEqual({ count: 1, p95: 60, max: 60 });
  expect(s.sendToAppliedStateMs.max).toBe(180);
  expect(s.sendToRenderSubmissionMs.max).toBe(200);
  for (let i = 0; i < 1000; i++) d.scheduling(i);
  expect(d.details().samples.inputTimerLagMs.count).toBe(128);
  d.reset();
  expect(d.details().samples).toEqual({});
});

it("時系列は4096件で有界、取得結果から内部を変更できず再接続も区別する", () => {
  const d = new ConnectionDiagnostics();
  for (let n = 0; n < 5000; n++) d.event("input", n, n);
  const result = d.details();
  expect(result.timeline).toHaveLength(4096);
  expect(result.overwritten).toBe(904);
  expect(result.timeline[0].value).toBe(904);
  result.timeline[0].value = -1;
  expect(d.details().timeline[0].value).toBe(904);
  d.reset();
  expect(d.details().timeline.at(-1)?.kind).toBe("connect");
  d.state(6000, 1700000000000);
  expect(d.details().timeline.at(-1)).toEqual({
    at: 6000,
    kind: "state",
    value: 1700000000000,
  });
});
it("描画の間引き記録でも長い空白とvisibility変化を残す", () => {
  const d = new ConnectionDiagnostics();
  for (let n = 0; n < 60; n++) d.frame(n * 16, false);
  d.frame(2200, true);
  const rows = d.details().timeline;
  expect(rows.filter((r) => r.kind === "frame").length).toBeLessThan(8);
  expect(rows.at(-1)).toEqual({ at: 2200, kind: "frame", value: 1256 });
  expect(rows.some((r) => r.kind === "visibility" && r.value === 1)).toBe(true);
});

it("RAFが止まってもvisibilityイベントを記録する", () => {
  const d = new ConnectionDiagnostics();
  d.frame(0, false);
  d.visibility(true, 10);
  d.visibility(false, 5000);
  expect(
    d
      .details()
      .timeline.filter((r) => r.kind === "visibility")
      .map((r) => [r.at, r.value]),
  ).toEqual([
    [0, 0],
    [10, 1],
    [5000, 0],
  ]);
});
