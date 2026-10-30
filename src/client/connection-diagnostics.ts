export interface ConnectionSample {
  roundTripMs?: number;
  updatesPerSecond?: number;
  stateAgeMs?: number;
}

/** 既存通信だけを測る。サーバー時計や描画FPSから遅延を推測しない。 */
export class ConnectionDiagnostics {
  private pings: number[] = [];
  private states: number[] = [];
  private firstState: number | undefined;
  private lastState: number | undefined;
  private roundTrip: number | undefined;
  private pongAt: number | undefined;
  private pingOverflow = false;

  reset() {
    this.pings = [];
    this.states = [];
    this.firstState = this.lastState = undefined;
    this.roundTrip = this.pongAt = undefined;
    this.pingOverflow = false;
  }

  ping(now = performance.now()) {
    if (!Number.isFinite(now) || this.pingOverflow) return;
    if (this.pings.length >= 8) {
      // 応答との対応を失ったら、小さい遅延を捏造せず次の接続まで未測定にする。
      this.pings = [];
      this.roundTrip = this.pongAt = undefined;
      this.pingOverflow = true;
      return;
    }
    this.pings.push(now);
  }

  pong(now = performance.now()) {
    // 同じWS上で順に送る既存ping/pongをFIFO対応させる。別接続でresetする。
    const sent = this.pings.shift();
    if (sent === undefined || !Number.isFinite(now) || now < sent) return;
    this.roundTrip = now - sent;
    this.pongAt = now;
  }

  state(now = performance.now()) {
    if (!Number.isFinite(now)) return;
    this.firstState ??= now;
    this.lastState = now;
    this.states.push(now);
    this.trim(now);
  }

  read(now = performance.now()): ConnectionSample {
    this.trim(now);
    return {
      roundTripMs:
        this.pongAt !== undefined && now - this.pongAt <= 15000
          ? this.roundTrip
          : undefined,
      updatesPerSecond:
        this.firstState !== undefined && now - this.firstState >= 1000
          ? this.states.length
          : undefined,
      stateAgeMs:
        this.lastState === undefined
          ? undefined
          : Math.max(0, now - this.lastState),
    };
  }

  private trim(now: number) {
    this.states = this.states.filter((at) => at > now - 1000).slice(-64);
  }
}

export function connectionLabel(sample: ConnectionSample) {
  const latency =
    sample.roundTripMs === undefined ? "—" : Math.round(sample.roundTripMs);
  const updates =
    (sample.stateAgeMs ?? 0) > 1000
      ? `更新待ち ${Math.round(sample.stateAgeMs!)}ms`
      : `更新 ${sample.updatesPerSecond ?? "—"}/s`;
  return ` · 往復 ${latency}ms · ${updates}`;
}
