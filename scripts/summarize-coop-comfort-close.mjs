import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const rawRoot = join(root, "dist-validation", "coop-comfort-close-20261113");
const output = join(
  root,
  "docs",
  "evidence",
  "coop-comfort-close-20261113",
  "measurements.json",
);
const trials = [
  "mixed-render1-profile",
  "mixed-render4",
  "mixed-slow-up",
  "mixed-render1-control",
  "mixed-render4-aligned",
  "survival-render1",
];
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const round = (value) => (finite(value) ? Math.round(value * 10) / 10 : null);

function summary(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  return {
    samples: sorted.length,
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted.at(-1)),
  };
}

function active(event) {
  return (
    ["combat", "boss"].includes(event.phase) &&
    finite(event.serverNow) &&
    finite(event.resumeUntil) &&
    event.serverNow > event.resumeUntil + 1
  );
}

function client(index, data, releaseAfterSeconds) {
  const rawInput = Array.isArray(data.inputEvents) ? data.inputEvents : [];
  const input = rawInput.filter((event) => finite(event.ms) && event.ms >= 0);
  const gaps = [];
  for (let i = 1; i < input.length; i++) {
    const previous = input[i - 1],
      current = input[i];
    if (
      active(previous) &&
      active(current) &&
      previous.phase === current.phase &&
      previous.resumeUntil === current.resumeUntil &&
      finite(previous.ms) &&
      finite(current.ms) &&
      current.ms >= previous.ms
    )
      gaps.push(current.ms - previous.ms);
  }
  const rawApplication = Array.isArray(data.ackEvents) ? data.ackEvents : [];
  const application = rawApplication.filter(
    (event) =>
      finite(event.ms) &&
      event.ms >= 0 &&
      finite(event.sentMs) &&
      event.sentMs >= 0,
  );
  const rawFullFrameReceipt = Array.isArray(data.receiptAckEvents)
    ? data.receiptAckEvents
    : [];
  const fullFrameReceipt = rawFullFrameReceipt.filter(
    (event) =>
      finite(event.ms) &&
      event.ms >= 0 &&
      finite(event.sentMs) &&
      event.sentMs >= 0,
  );
  const sentBySeq = new Map(
    input
      .filter((event) => Number.isSafeInteger(event.seq) && finite(event.ms))
      .map((event) => [event.seq, event.ms]),
  );
  const rawWindow = Array.isArray(data.inputWindowEvents)
    ? data.inputWindowEvents
    : [];
  const windowEvents = rawWindow.filter(
    (event) => finite(event.ms) && event.ms >= 0,
  );
  const accepted = windowEvents
    .filter(
      (event) =>
        Number.isSafeInteger(event.seq) &&
        finite(event.ms) &&
        sentBySeq.has(event.seq) &&
        event.ms >= sentBySeq.get(event.seq),
    )
    .map((event) => ({
      seq: event.seq,
      ms: event.ms,
      rtt: event.ms - sentBySeq.get(event.seq),
    }));
  const neutral =
    releaseAfterSeconds > 0
      ? input.find(
          (event) =>
            event.ms >= releaseAfterSeconds * 1000 &&
            event.fire === false &&
            event.moving === false,
        )
      : undefined;
  const neutralReceipt = neutral
    ? accepted.find(
        (event) => event.seq >= neutral.seq && event.ms >= neutral.ms,
      )
    : undefined;
  const neutralFullFrameReceipt = neutral
    ? fullFrameReceipt.find(
        (event) => event.seq >= neutral.seq && event.ms >= neutral.ms,
      )
    : undefined;
  const samples = Array.isArray(data.samples) ? data.samples : [];
  const rawFrames = Array.isArray(data.frames) ? data.frames : [];
  const frames = rawFrames.slice(1);
  const rawLongFrames = Array.isArray(data.longFrames) ? data.longFrames : [];
  const longFrames = rawLongFrames.filter(
    (event) =>
      finite(event.ms) &&
      finite(event.durationMs) &&
      event.durationMs >= 0 &&
      event.ms >= event.durationMs,
  );
  const slowRenders = Array.isArray(data.diagnostic?.slowRenders)
    ? data.diagnostic.slowRenders
    : [];
  return {
    client: index,
    excluded: {
      firstRafInterval: rawFrames.length > 0 ? 1 : 0,
      longFrameStartedBeforeWindow: rawLongFrames.length - longFrames.length,
      invalidOrNegativeInputEvents: rawInput.length - input.length,
      invalidOrNegativeInputWindowEvents:
        rawWindow.length - windowEvents.length,
      invalidOrNegativeApplicationAckEvents:
        rawApplication.length - application.length,
      invalidOrNegativeFullFrameReceiptAckEvents:
        rawFullFrameReceipt.length - fullFrameReceipt.length,
    },
    wallSeconds: round(data.wallMs / 1000),
    inputGapMs: {
      ...summary(gaps),
      over250: gaps.filter((value) => value > 250).length,
    },
    outsideResumeGraceAckZero: samples.filter(
      (sample) => active(sample) && sample.ack === 0,
    ).length,
    receiptAckMs: summary(accepted.map((event) => event.rtt)),
    fullFrameOnlyReceiptAckMs: summary(
      fullFrameReceipt.map((event) => event.rtt),
    ),
    applicationAckMs: summary(application.map((event) => event.rtt)),
    rafMs: {
      ...summary(frames),
      over100: frames.filter((value) => finite(value) && value > 100).length,
    },
    renderCpuMs: summary(Array.isArray(data.renderCpu) ? data.renderCpu : []),
    longFrames: {
      count: longFrames.length,
      durationMs: summary(longFrames.map((event) => event.durationMs)),
    },
    longFrameRenderCpuMs: summary(longFrames.map((event) => event.renderCpuMs)),
    diagnosticSlowRenderCpuMs: summary(
      slowRenders.map((event) => event.durationMs),
    ),
    releaseNeutralToReceiptAckMs: neutralReceipt
      ? round(neutralReceipt.ms - neutral.ms)
      : null,
    releaseNeutralToFullFrameOnlyReceiptAckMs: neutralFullFrameReceipt
      ? round(neutralFullFrameReceipt.ms - neutral.ms)
      : null,
    releaseNeutralSent: !!neutral,
  };
}

const report = {
  schema: 1,
  method: {
    rafWindow: "raw.framesの先頭1件はbegin()前から続く間隔なので常に除外",
    longFrameWindow:
      "raw.longFramesはms>=durationMsかつ有限・非負の記録のみ採用（frame開始も計測窓内）",
    negativeRelativeTimes:
      "inputEvents、inputWindowEvents、application ACK、full-frame-only ACKの相対ms/sentMsが負または非有限なら除外。件数はclient.excluded",
    inputGaps:
      "隣接inputEventsの両方がcombat/boss、同じphaseとresumeUntil、serverNow>resumeUntil+1秒",
    outsideResumeGraceAckZero: "samplesのうち同じ猶予外条件でack===0の件数",
    releaseNeutralToReceiptAckMs:
      "releaseAfter以降の最初のfire=falseかつmoving=falseから、同seq以上で入力採取時刻と照合できる最初のinputWindow.acknowledgeまで",
    receiptAckMs:
      "inputWindowEventsのseqをinputEventsの同seq送信msへ厳密対応させた受理RTT。対応不能は除外",
    fullFrameOnlyReceiptAckMs:
      "旧receiptAckEventsはtype=stateだけを見る参考値。delta/inputReceiptは含まない",
    wireBytes:
      "計測中の受信JSON payloadのみ。WebSocket等のプロトコルoverheadは含まない",
    aggregateDownlinkBytesPerSecond:
      "4人のwire.bytes合計 / client.wallMsの最大値",
    comparison: "trial間は同一スマホ比較ではない",
    terrainAlignment:
      "旧mixed-render1-profile/mixed-render4はserver側だけ草原へ換装しclient側と不一致。主比較から除く",
  },
  freeTierFormulaOnly: {
    players: 4,
    inputHzEach: 20,
    pingSecondsEach: 5,
    wallSeconds: 3600,
    ratio: 20,
    inputMessages: 4 * 20 * 3600,
    pingMessages: (4 * 3600) / 5,
    messageUnits: (4 * 20 * 3600 + (4 * 3600) / 5) / 20,
    durationGbSecondsPerHour: 460.8,
  },
  trials: {},
};

for (const name of trials) {
  const dir = join(rawRoot, name);
  const resultFile = join(dir, "results.json");
  if (!existsSync(resultFile)) continue;
  const result = JSON.parse(readFileSync(resultFile, "utf8"));
  const clients = [];
  for (let index = 0; index < 4; index++) {
    const file = join(dir, `client-${index}-samples.json`);
    if (existsSync(file))
      clients.push(
        client(
          index,
          JSON.parse(readFileSync(file, "utf8")),
          result.releaseAfterSeconds ?? 0,
        ),
      );
  }
  const wire = Array.isArray(result.wire) ? result.wire : [];
  const wireBytes = wire.reduce(
    (sum, item) => sum + (finite(item.bytes) ? item.bytes : 0),
    0,
  );
  const wallSeconds = Math.max(
    0,
    ...(result.clients ?? []).map((item) =>
      finite(item.wallMs) ? item.wallMs / 1000 : 0,
    ),
  );
  report.trials[name] = {
    terrainAligned: !["mixed-render1-profile", "mixed-render4"].includes(name),
    mainComparisonEligible: [
      "mixed-render1-control",
      "mixed-render4-aligned",
    ].includes(name),
    observationCompleted: result.observationCompleted === true,
    pass: result.passed === true,
    errors: {
      run: result.errors?.length ?? 0,
      clients: (result.clients ?? []).reduce(
        (sum, item) => sum + (item.errors?.length ?? 0),
        0,
      ),
      gl: (result.clients ?? []).reduce(
        (sum, item) => sum + (item.glErrors?.length ?? 0),
        0,
      ),
    },
    sourceStable: result.sourcesStable === true,
    fixture: result.fixture
      ? {
          seed: finite(result.fixture.seed) ? result.fixture.seed : null,
          kind: result.fixture.kind ?? null,
          enemies: result.fixture.enemies ?? null,
          projectiles: result.fixture.projectiles ?? null,
        }
      : null,
    releaseAfterSeconds: result.releaseAfterSeconds ?? 0,
    clients,
    wire: {
      totalBytes: wireBytes,
      wallSeconds: round(wallSeconds),
      aggregateDownlinkBytesPerSecond:
        wallSeconds > 0 ? round(wireBytes / wallSeconds) : null,
    },
    workerTicksMs: result.workerTicks
      ? {
          samples: result.workerTicks.samples,
          p50: result.workerTicks.p50,
          p95: result.workerTicks.p95,
          max: result.workerTicks.max,
        }
      : null,
  };
}

writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`集計した試行: ${Object.keys(report.trials).join(", ") || "なし"}`);
