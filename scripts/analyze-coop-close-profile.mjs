import fs from "node:fs";
const directory =
  process.argv[2] ??
  "dist-validation/coop-comfort-close-20261113/mixed-render1-profile";
const profile = JSON.parse(
  fs.readFileSync(`${directory}/client-0.cpuprofile`, "utf8"),
);
const data = JSON.parse(
  fs.readFileSync(`${directory}/client-0-samples.json`, "utf8"),
);
const result = JSON.parse(fs.readFileSync(`${directory}/results.json`, "utf8"));
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const parents = new Map();
for (const n of profile.nodes)
  for (const id of n.children ?? []) parents.set(id, n.id);
const ancestry = (id) => {
  const stack = [];
  while (id) {
    stack.push(nodes.get(id).callFrame.functionName);
    id = parents.get(id);
  }
  return stack.reverse();
};
let time = 0,
  inside = false;
const samples = [],
  markers = [];
for (let i = 0; i < profile.samples.length; i++) {
  const start = time;
  time += profile.timeDeltas[i] / 1000;
  const id = profile.samples[i],
    stack = ancestry(id),
    name = nodes.get(id).callFrame.functionName;
  samples.push({ start, end: time, id, name, stack });
  const yes = stack.includes("net.onWorld");
  if (yes && !inside) markers.push(time);
  inside = yes;
}
const observed = data.samples.map((s) => s.ms);
function nearest(values, value) {
  let lo = 0,
    hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return [values[lo], values[lo - 1]]
    .filter(Number.isFinite)
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0];
}
const durationMs = (profile.endTime - profile.startTime) / 1000;
const extraMs = durationMs - data.wallMs;
const fits = [];
for (let offset = 0; offset <= extraMs; offset += 0.5) {
  const residuals = markers
    .map((t) => t - offset - nearest(observed, t - offset))
    .filter((e) => Math.abs(e) <= 8);
  fits.push({
    offset,
    matches: residuals.length,
    error: residuals.reduce((n, e) => n + Math.abs(e), 0),
  });
}
fits.sort((a, b) => b.matches - a.matches || a.error - b.error);
const best = fits[0];
const matched = markers
  .map((t) => ({
    profileMs: t,
    measurementMs: nearest(observed, t - best.offset),
  }))
  .filter((x) => Math.abs(x.profileMs - best.offset - x.measurementMs) <= 8);
const offsets = matched
  .map((x) => x.profileMs - x.measurementMs)
  .sort((a, b) => a - b);
const offset = offsets[Math.floor(offsets.length / 2)];
for (const x of matched) x.residualMs = x.profileMs - offset - x.measurementMs;
function group(x) {
  if (x.name === "(idle)") return "idle";
  if (x.name === "(garbage collector)") return "gc";
  if (x.name === "getError") return "harness-getError";
  if (x.name === "getProgramInfoLog") return "getProgramInfoLog";
  if (x.stack.includes("ws.onmessage") || x.stack.includes("net.onWorld"))
    return "receive";
  if (x.stack.includes("pilot")) return "pilot";
  if (x.stack.includes("frame") && x.stack.includes("render"))
    return "product-render";
  if (x.stack.includes("frame")) return "harness-frame-other";
  return "other-native-or-program";
}
function interval(measurementStart, measurementEnd) {
  const start = measurementStart + offset,
    end = measurementEnd + offset,
    weights = {},
    functions = {};
  for (const x of samples) {
    const weight = Math.max(0, Math.min(x.end, end) - Math.max(x.start, start));
    if (!weight) continue;
    const category = group(x);
    weights[category] = (weights[category] ?? 0) + weight;
    functions[x.name] = (functions[x.name] ?? 0) + weight;
  }
  return {
    measurementMs: [measurementStart, measurementEnd],
    profileRelativeMs: [start, end],
    sampleWeightedCategoryMs: weights,
    sampleWeightedCategoryPercent: Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [
        k,
        (100 * v) / (measurementEnd - measurementStart),
      ]),
    ),
    topFunctionsMs: Object.entries(functions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
  };
}
const runs = [];
let run;
for (const x of samples) {
  if (run?.id === x.id) {
    run.end = x.end;
    run.ms += x.end - x.start;
    run.samples++;
  } else {
    run = {
      id: x.id,
      name: x.name,
      start: x.start,
      end: x.end,
      ms: x.end - x.start,
      samples: 1,
    };
    runs.push(run);
  }
}
const long = data.longFrames
    .filter((f) => f.ms >= f.durationMs)
    .sort((a, b) => b.durationMs - a.durationMs)[0],
  start = long.ms - long.durationMs;
const index = data.frames.findIndex((t) => t > 100);
const summary = {
  profileDurationMs: durationMs,
  measurementDurationMs: data.wallMs,
  alignment: {
    method:
      "profileのnet.onWorld連続区間の先頭と、既存samples.msの受信時刻を独立照合",
    boundWithoutAlignmentMs: [0, extraMs],
    markerCount: markers.length,
    matchedCount: matched.length,
    profileMinusMeasurementMs: offset,
    observedResidualMs: [
      Math.min(...matched.map((x) => x.residualMs)),
      Math.max(...matched.map((x) => x.residualMs)),
    ],
    precisionNote:
      "残差は本結果を参照。CPU sampling約1〜2msの位置ずれを見込む推定。直接のProfiler/live.begin共有timestampではない。",
    matched,
  },
  longFrame: {
    measurementEndMs: long.ms,
    durationMs: long.durationMs,
    gameTime: long.gameTime,
  },
  frameIntervalsAroundMs: data.frames.slice(index - 4, index + 6),
  longInterval: interval(start, long.ms),
  surroundingWindow: interval(Math.max(0, start - 100), long.ms + 100),
  longestGetErrorRuns: runs
    .filter((x) => x.name === "getError")
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .map((x) => ({
      ...x,
      measurementStartMs: x.start - offset,
      measurementEndMs: x.end - offset,
    })),
  longestGcRuns: runs
    .filter((x) => x.name === "(garbage collector)")
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3),
  receiveDuringRafGap: data.samples
    .filter((s) => s.ms >= start && s.ms <= long.ms)
    .map(({ ms, time }) => ({ ms, gameTime: time })),
  receiptDuringRafGap: data.receiptAckEvents
    .filter((s) => s.ms >= start && s.ms <= long.ms)
    .map(({ ms }) => ({ ms })),
  inputSendsDuringRafGap: data.inputEvents.filter(
    (s) => s.ms >= start && s.ms <= long.ms,
  ).length,
  shaderTransitionsNear: data.diagnostic.programTransitions
    .filter((s) => s.ms >= start - 100 && s.ms <= long.ms + 100)
    .map(({ ms, gameTime, durationMs, beforeCount, afterCount }) => ({
      ms,
      gameTime,
      durationMs,
      beforeCount,
      afterCount,
    })),
  otherClientRafMaxMs: result.clients.slice(1).map((c) => c.frames.max),
  conclusion: [
    "CPU標本と受信時刻の推定照合。idleだけでGPU/OSの原因を確定しない。",
  ],
};
fs.writeFileSync(
  `${directory}/cpu-profile-analysis.json`,
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    {
      offset: summary.alignment.profileMinusMeasurementMs,
      matched: summary.alignment.matchedCount,
      long: summary.longInterval,
      window: summary.surroundingWindow,
      largestGetError: summary.longestGetErrorRuns[0],
      receiveCount: summary.receiveDuringRafGap.length,
    },
    null,
    2,
  ),
);
