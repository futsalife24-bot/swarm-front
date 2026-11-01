export interface ConnectionSample {
  roundTripMs?: number;
  updatesPerSecond?: number;
  stateAgeMs?: number;
}

/** 既存通信だけを測る。サーバー時計や描画FPSから遅延を推測しない。 */
export class ConnectionDiagnostics {
  private timeline: { at: number; kind: string; value: number }[] = [];
  private trace: unknown[] = [];
  private traceHistories: unknown[] = [];
  private incidents: {
    at: number;
    gapMs: number;
    timeline: { at: number; kind: string; value: number }[];
  }[] = [];
  serverTrace(value: unknown) {
    // Accept numeric observations only; never retain arbitrary server payloads.
    if (!value || typeof value !== "object") return;
    const clean = (v: unknown, depth = 0): unknown => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (depth < 3 && Array.isArray(v))
        return v.slice(0, 128).map((x) => clean(x, depth + 1));
      if (depth < 3 && v && typeof v === "object")
        return Object.fromEntries(
          Object.entries(v)
            .filter(([k]) => /^[a-zA-Z][a-zA-Z0-9]{0,30}$/.test(k))
            .slice(0, 20)
            .map(([k, x]) => [k, clean(x, depth + 1)]),
        );
      return null;
    };
    const observation = { at: performance.now(), data: clean(value) };
    this.trace.push(observation);
    if (Array.isArray((value as { history?: unknown }).history)) {
      this.traceHistories.push(observation);
      if (this.traceHistories.length > 6) this.traceHistories.shift();
    }
    if (this.trace.length > 16) this.trace.shift();
  }
  private cursor = 0;
  private overwritten = 0;
  private lastFrame: number | undefined;
  private frameSample = -Infinity;
  private hidden: boolean | undefined;
  /** Numeric, bounded and local-only. No commands, identity or tokens. */
  event(
    kind:
      | "message"
      | "decodeReject"
      | "cloudRequest"
      | "cloudResponse"
      | "cloudStart"
      | "cloudEnd"
      | "connect"
      | "close"
      | "state"
      | "input"
      | "receipt"
      | "pong"
      | "frame"
      | "visibility",
    value: number,
    at = performance.now(),
  ) {
    if (!Number.isFinite(at) || !Number.isFinite(value)) return;
    const row = { at, kind, value };
    if (this.timeline.length < 4096) this.timeline.push(row);
    else {
      this.timeline[this.cursor] = row;
      this.cursor = (this.cursor + 1) % 4096;
      this.overwritten++;
    }
  }
  visibility(hidden: boolean, now = performance.now()) {
    if (hidden !== this.hidden) {
      this.event("visibility", hidden ? 1 : 0, now);
      this.hidden = hidden;
    }
  }
  frame(now: number, hidden: boolean) {
    this.visibility(hidden, now);
    if (
      this.lastFrame !== undefined &&
      (now - this.lastFrame > 50 || now - this.frameSample >= 250)
    ) {
      this.event("frame", now - this.lastFrame, now);
      this.frameSample = now;
    }
    this.lastFrame = now;
  }

  private inputs = new Map<
    number,
    { sampled: number; sent?: number; received?: boolean }
  >();
  private samples: Record<string, number[]> = {};
  private serverTiming: Record<string, number> = {};
  private awaitingRender: number | undefined;

  /** Bounded, local-only observations; no identity, input contents or wall-clock offsets. */
  private observe(key: string, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    const values = (this.samples[key] ??= []);
    values.push(value);
    if (values.length > 128) values.shift();
  }
  sampled(seq: number, now = performance.now()) {
    if (!Number.isSafeInteger(seq) || this.inputs.has(seq)) return;
    this.inputs.set(seq, { sampled: now });
    while (this.inputs.size > 64)
      this.inputs.delete(this.inputs.keys().next().value!);
  }
  sent(seq: number, inFlight: number, now = performance.now()) {
    this.event("input", seq, now);
    const input = this.inputs.get(seq);
    if (input) {
      input.sent = now;
      this.observe("sampleToSendMs", now - input.sampled);
    }
    this.observe("inputInFlight", inFlight);
  }
  receipt(seq: number, now = performance.now()) {
    this.event("receipt", seq, now);
    const input = this.inputs.get(seq);
    if (input?.sent !== undefined && !input.received) {
      this.observe("sendToReceiptMs", now - input.sent);
      input.received = true;
    }
  }
  applied(seq: number, now = performance.now()) {
    const input = this.inputs.get(seq);
    if (input?.sent !== undefined) {
      this.observe("sendToAppliedStateMs", now - input.sent);
      this.awaitingRender = input.sent;
    }
    for (const key of this.inputs.keys())
      if (key <= seq) this.inputs.delete(key);
  }
  rendered(now = performance.now()) {
    if (this.awaitingRender === undefined) return;
    this.observe("sendToRenderSubmissionMs", now - this.awaitingRender);
    this.awaitingRender = undefined;
  }
  processed(ms: number) {
    this.observe("receiveProcessingMs", ms);
  }
  scheduling(ms: number) {
    this.observe("inputTimerLagMs", ms);
  }
  server(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of [
      "tickMs",
      "previousEncodeMs",
      "clockDroppedMs",
      "stateInFlight",
    ]) {
      const n = (value as Record<string, unknown>)[key];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
        this.serverTiming[key] = n;
        this.observe(`server.${key}`, n);
      }
    }
  }
  details() {
    return {
      timeline: [
        ...this.timeline.slice(this.cursor),
        ...this.timeline.slice(0, this.cursor),
      ].map((row) => ({ ...row })),
      overwritten: this.overwritten,
      incidents: structuredClone(this.incidents),
      serverTrace: structuredClone(this.trace),
      serverTraceHistories: structuredClone(this.traceHistories),
      server: { ...this.serverTiming },
      samples: Object.fromEntries(
        Object.entries(this.samples).map(([key, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return [
            key,
            {
              count: sorted.length,
              p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
              max: sorted.at(-1),
            },
          ];
        }),
      ),
    };
  }
  private pings: number[] = [];
  private states: number[] = [];
  private firstState: number | undefined;
  private lastState: number | undefined;
  private roundTrip: number | undefined;
  private pongAt: number | undefined;
  private pingOverflow = false;

  reset() {
    this.event("connect", 0);
    this.inputs.clear();
    this.samples = {};
    this.serverTiming = {};
    this.awaitingRender = undefined;
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
    this.event("pong", this.roundTrip, now);
    this.pongAt = now;
  }

  state(now = performance.now(), stateId?: number) {
    if (Number.isSafeInteger(stateId)) this.event("state", stateId!, now);
    if (!Number.isFinite(now)) return;
    if (this.lastState !== undefined) {
      const gapMs = now - this.lastState;
      this.observe("stateGapMs", gapMs);
      if (gapMs > 400) {
        const timeline = [
          ...this.timeline.slice(this.cursor),
          ...this.timeline.slice(0, this.cursor),
        ]
          .slice(-256)
          .map((row) => ({ ...row }));
        this.incidents.push({ at: now, gapMs, timeline });
        if (this.incidents.length > 6) this.incidents.shift();
      }
    }
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
