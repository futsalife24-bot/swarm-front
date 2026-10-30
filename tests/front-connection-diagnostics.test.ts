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
