import fs from "node:fs";
import path from "node:path";

// 連射診断（FireCadenceTrace.details()）を段ごとの間隔へ集計する。
// 使い方:
//   node scripts/summarize-fire-cadence.mjs <計測ディレクトリ> <出力JSON> [条件名,条件名...]
//   node scripts/summarize-fire-cadence.mjs --device <保存した診断JSON> [出力JSON]
const FLAG = {
  held: 1,
  expired: 2,
  missing: 4,
  reloading: 8,
  down: 16,
  swapping: 32,
  paused: 64,
};
const round = (value) => +value.toFixed(1);
function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0 };
  const at = (p) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    count: sorted.length,
    min: round(sorted[0]),
    median: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted.at(-1)),
    mean: round(mean),
    // ばらつきの大きさ：標準偏差÷平均（%）。0に近いほど均一。
    cvPercent: round(
      (Math.sqrt(
        sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length,
      ) /
        mean) *
        100,
    ),
  };
}
/** 公称間隔から±15%を超えて外れた間隔の割合。 */
const uneven = (values, nominal) =>
  values.length
    ? round(
        (values.filter((v) => Math.abs(v - nominal) > nominal * 0.15).length /
          values.length) *
          100,
      )
    : null;

export function summarizeTrace(trace, nominalMs) {
  const ticks = trace.ticks,
    byEvent = new Map(trace.shots.map((row) => [row[1], row]));
  const lastGeneration = Math.max(0, ...trace.shots.map((row) => row[0]));
  const ids = trace.shots
    .filter((row) => row[0] === lastGeneration)
    .map((row) => row[1])
    .sort((a, b) => a - b);
  // 権威側の行の射出数を、受信したイベントIDへ順に割り当てる。
  const shots = [];
  let cursor = 0,
    unmatched = 0;
  for (let index = 0; index < ticks.length; index++) {
    const row = ticks[index];
    if (!row[4]) continue;
    while (cursor < ids.length && ids[cursor] < row[5]) cursor++;
    if (ids[cursor] !== row[5]) {
      unmatched += row[4];
      continue;
    }
    for (let n = 0; n < row[4] && cursor < ids.length; n++, cursor++) {
      const shot = byEvent.get(ids[cursor]);
      shots.push({
        event: ids[cursor],
        tickIndex: index,
        tick: row[0],
        authorityAt: row[1],
        appliedSeq: row[2],
        receivedAt: shot[2],
        stateId: shot[3],
        displayedAt: shot[4] || null,
        soundAt: shot[5] || null,
        sound: shot[6],
      });
    }
  }
  const interval = { authority: [], received: [], displayed: [], sound: [] };
  const tickGaps = {};
  let reloadGaps = 0,
    inputBreaks = 0,
    lastSound = null;
  for (let n = 1; n < shots.length; n++) {
    const a = shots[n - 1],
      b = shots[n];
    const between = ticks.slice(a.tickIndex + 1, b.tickIndex + 1);
    const stopped = between.some(
      (row) =>
        row[3] & (FLAG.reloading | FLAG.down | FLAG.swapping | FLAG.paused),
    );
    if (stopped) {
      reloadGaps++;
      lastSound = null;
      continue;
    }
    // 弾切れの直前は射出後に装填へ入るため、次の射撃までの行で判定済み。
    if (between.some((row) => !(row[3] & FLAG.held))) inputBreaks++;
    interval.authority.push(b.authorityAt - a.authorityAt);
    const gap = b.tick - a.tick;
    tickGaps[gap] = (tickGaps[gap] ?? 0) + 1;
    interval.received.push(b.receivedAt - a.receivedAt);
    if (a.displayedAt && b.displayedAt)
      interval.displayed.push(b.displayedAt - a.displayedAt);
    if (a.sound === 1) lastSound = a.soundAt;
    if (b.sound === 1 && lastSound !== null)
      interval.sound.push(b.soundAt - lastSound);
  }
  // 射撃を押している間の入力：採取・送信の間隔と、権威側で射撃が無効だったtick。
  const pressed = trace.presses.filter((row) => row[1] === 1).map((r) => r[0]),
    released = trace.presses.filter((row) => row[1] === 0).map((r) => r[0]);
  const holding = (at) =>
    pressed.some((start, i) => at >= start && at <= (released[i] ?? Infinity));
  const firing = trace.inputs.filter((row) => row[2] === 1 && holding(row[1]));
  const sampleGaps = [],
    sendGaps = [];
  for (let n = 1; n < firing.length; n++) {
    if (firing[n][0] !== firing[n - 1][0] + 1) continue;
    sampleGaps.push(firing[n][1] - firing[n - 1][1]);
  }
  const sent = firing.filter((row) => row[3]);
  for (let n = 1; n < sent.length; n++)
    sendGaps.push(sent[n][3] - sent[n - 1][3]);
  const heldWindow = ticks.filter(
    (row) => holding(row[9]) && !(row[3] & (FLAG.paused | FLAG.down)),
  );
  const serverTickGaps = [];
  for (let n = 1; n < ticks.length; n++)
    if (ticks[n][0] === ticks[n - 1][0] + 1)
      serverTickGaps.push(ticks[n][1] - ticks[n - 1][1]);
  const stateGaps = [];
  const states = trace.states.filter((row) => row[0]);
  for (let n = 1; n < states.length; n++)
    stateGaps.push(states[n][1] - states[n - 1][1]);
  // 1回の受信・1回の描画に何発まとまったか。
  const perState = {},
    perFrame = {};
  const group = (key, table) => {
    const counts = new Map();
    for (const shot of shots)
      if (shot[key]) counts.set(shot[key], (counts.get(shot[key]) ?? 0) + 1);
    for (const count of counts.values()) table[count] = (table[count] ?? 0) + 1;
  };
  group("receivedAt", perState);
  group("displayedAt", perFrame);
  const sounds = { played: 0, merged: 0, throttled: 0, inactive: 0, none: 0 };
  for (const shot of shots)
    sounds[
      ["none", "played", "merged", "throttled", "inactive"][shot.sound] ??
        "none"
    ]++;
  return {
    nominalMs: nominalMs ?? null,
    shots: shots.length,
    unmatchedAuthorityShots: unmatched,
    reloadGaps,
    inputBreaks,
    interval: Object.fromEntries(
      Object.entries(interval).map(([key, values]) => [
        key,
        {
          ...distribution(values),
          ...(nominalMs ? { unevenPercent: uneven(values, nominalMs) } : {}),
        },
      ]),
    ),
    authorityTickGaps: tickGaps,
    notDisplayed: shots.filter((shot) => !shot.displayedAt).length,
    shotsPerState: perState,
    shotsPerFrame: perFrame,
    sounds,
    receiveToDisplayMs: distribution(
      shots
        .filter((shot) => shot.displayedAt)
        .map((shot) => shot.displayedAt - shot.receivedAt),
    ),
    input: {
      sampleGapMs: distribution(sampleGaps),
      sendGapMs: distribution(sendGaps),
      unsent: firing.length - sent.length,
      sampled: firing.length,
      heldTicks: heldWindow.length,
      notHeldTicks: heldWindow.filter((row) => !(row[3] & FLAG.held)).length,
      expiredTicks: heldWindow.filter((row) => row[3] & FLAG.expired).length,
      missingTicks: heldWindow.filter((row) => row[3] & FLAG.missing).length,
      appliedAgeMs: distribution(
        heldWindow.filter((row) => row[8] >= 0).map((row) => row[8]),
      ),
    },
    authorityTickMs: distribution(serverTickGaps),
    stateGapMs: distribution(stateGaps),
    frames: {
      count: trace.frameCount,
      over25ms: trace.frames.length,
      gapMs: distribution(trace.frames.map((row) => row[1])),
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  if (process.argv[2] === "--device") {
    const report = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    const trace = report.observations?.fireCadence ?? report.fireCadence;
    if (!trace) throw Error("この診断には連射の記録がありません");
    const summary = {
      build: report.build,
      capturedAt: report.capturedAt,
      environment: report.environment,
      summary: summarizeTrace(trace),
    };
    if (process.argv[4])
      fs.writeFileSync(process.argv[4], JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const [input, output, names] = process.argv.slice(2);
    const selected = names
      ? names.split(",")
      : fs
          .readdirSync(input)
          .filter((name) =>
            fs.existsSync(path.join(input, name, "results.json")),
          );
    const runs = selected.map((name) => {
      const result = JSON.parse(
        fs.readFileSync(path.join(input, name, "results.json"), "utf8"),
      );
      return {
        name,
        passed: result.passed,
        sourcesStable: result.sourcesStable,
        head: result.headBefore,
        condition: result.condition,
        fixture: result.fixture,
        link: result.link
          ? {
              latencyMs: result.link.latencyMs,
              jitterMs: result.link.jitterMs,
            }
          : null,
        errors: result.errors.length,
        clients: (result.clients ?? []).map((client) => ({
          client: client.client,
          audio: client.audio,
          ...summarizeTrace(
            JSON.parse(
              fs.readFileSync(
                path.join(input, name, `client-${client.client}.json`),
                "utf8",
              ),
            ).trace,
            result.fixture?.intervalMs,
          ),
        })),
      };
    });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ runs }, null, 2) + "\n");
    for (const run of runs)
      for (const c of run.clients) {
        const cell = (d) => (d.count ? `${d.median}/${d.p95}/${d.max}` : "—");
        console.log(
          [
            run.name,
            c.client,
            c.shots,
            cell(c.interval.authority),
            cell(c.interval.received),
            cell(c.interval.displayed),
            cell(c.interval.sound),
            c.notDisplayed,
            JSON.stringify(c.sounds),
            c.input.notHeldTicks,
          ].join(" | "),
        );
      }
  }
}
