import fs from "node:fs";
import path from "node:path";

const root = "dist-validation/coop-comfort-20261030";
const names = [
  "live-input-loop",
  "live-window-diagnostic",
  "live-window-end-probe",
  "live-window-slow-up-diagnostic",
];
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const stats = (values) => {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return {
    count: a.length,
    p50: a[Math.floor(a.length * 0.5)] ?? null,
    p95: a[Math.floor(a.length * 0.95)] ?? null,
    max: a.at(-1) ?? null,
  };
};
const active = (s) =>
  (s.phase === "combat" || s.phase === "boss") &&
  s.serverNow > s.resumeUntil + 1;
const result = {
  method:
    "Real local Worker, four isolated Chrome processes and ordinary pilot input. Different room seeds and host load: not a matched performance comparison. Functional pass does not prove input continuity or phone performance. Applied-ACK unacked counts are distinct from receipt-ACK inFlight.",
  activeDefinition:
    "For World samples: alive, combat/boss and serverNow > resumeUntil + 1. For send gaps: both ends in that phase/grace with unchanged resumeUntil. Synthetic release uses the first outbound neutral and its receipt ACK; it is not visible character response.",
  trials: names.map((name) => {
    const r = read(name + "/results.json");
    return {
      name,
      functionalPass: r.passed,
      sourceHashes: r.sourceBefore,
      sourcesStable: r.sourcesStable,
      seconds: r.secondsRequested,
      renderClients: r.renderClients,
      glProbeMode: r.glProbeMode ?? "interval-uninstrumented",
      linkConfig: r.linkConfig,
      errors: r.errors,
      clients: r.clients.map((c) => {
        const raw = read(`${name}/client-${c.client}-samples.json`);
        const gaps = raw.inputEvents.slice(1).flatMap((s, i) => {
          const previous = raw.inputEvents[i];
          return active(s) &&
            active(previous) &&
            s.resumeUntil === previous.resumeUntil
            ? [
                {
                  fromMs: previous.ms,
                  toMs: s.ms,
                  durationMs: s.ms - previous.ms,
                  window: s.inputWindow,
                },
              ]
            : [];
        });
        const zeros = raw.samples
          .filter((s) => active(s) && s.hp > 0 && s.ack === 0)
          .map((s) => ({
            ms: s.ms,
            gameTime: s.time,
            window: s.inputWindow,
            appliedAckUnacked: s.unacked,
          }));
        const release =
          r.releaseAfterSeconds > 0
            ? raw.inputEvents.find(
                (s) =>
                  s.ms >= r.releaseAfterSeconds * 1000 && !s.fire && !s.moving,
              )
            : undefined;
        const receipt =
          release && raw.receiptAckEvents.find((s) => s.seq >= release.seq);
        return {
          client: c.client,
          gameSeconds: c.gameSeconds,
          frames: c.frames,
          renderCpu: c.renderCpu,
          receiptAckRtt: c.receiptAckRtt,
          inputContinuityPass:
            zeros.length === 0 && gaps.every((g) => g.durationMs <= 250),
          zeroAckOutsideResume: zeros,
          inputGaps: stats(gaps.map((g) => g.durationMs)),
          inputGapsOver250: gaps.filter((g) => g.durationMs > 250),
          receiptExcess: stats(
            (raw.inputWindowEvents ?? []).map((s) => s.excessMs),
          ),
          windowTransitions: (raw.inputWindowEvents ?? [])
            .filter((s) => s.before !== s.after)
            .map((s) => ({
              ms: s.ms,
              seq: s.seq,
              excessMs: s.excessMs,
              before: s.before,
              after: s.after,
              receiptInFlightAfterAck: raw.inputEvents.filter(
                (i) => i.ms <= s.ms && i.seq > s.seq,
              ).length,
            })),
          glProbeCosts: stats(
            (raw.glProbes ?? [])
              .filter((s) => s.label === "interval")
              .map((s) => s.durationMs),
          ),
          glProbes: raw.glProbes ?? null,
          longFrames: raw.longFrames,
          releaseReceiptSinceIntentMs: receipt
            ? receipt.ms - r.releaseAfterSeconds * 1000
            : null,
          errors: c.errors,
          glErrors: c.glErrors,
        };
      }),
    };
  }),
};
fs.writeFileSync(
  "docs/evidence/coop-comfort-20261030/input-window-pressure-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    result.trials.map((r) => ({
      name: r.name,
      functionalPass: r.functionalPass,
      sourcesStable: r.sourcesStable,
      clients: r.clients.map((c) => ({
        client: c.client,
        continuity: c.inputContinuityPass,
        zeroAck: c.zeroAckOutsideResume.length,
        maxGap: c.inputGaps.max,
        excessP95: c.receiptExcess.p95,
        excessMax: c.receiptExcess.max,
        probeMax: c.glProbeCosts.max,
        releaseMs: c.releaseReceiptSinceIntentMs,
      })),
    })),
    null,
    2,
  ),
);
