// trace-coop.mjsの記録を、同じOS時計(epoch ms)上で突き合わせて更新空白を分類する。
// 使い方: node scripts/lag-investigation/analyze.mjs <trace.jsonのパス>... [--json 出力先]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : undefined;
const RESUME_MS = 3000; // 強化選択を閉じた後の再開待ちを戦闘中の空白から除く上限

const pct = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
    : null;
const round = (v) =>
  v === null || v === undefined ? v : Math.round(v * 10) / 10;
function stats(values) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    n: s.length,
    p50: round(pct(s, 0.5)),
    p95: round(pct(s, 0.95)),
    p99: round(pct(s, 0.99)),
    max: round(s.at(-1) ?? null),
  };
}

function analyze(path) {
  const r = JSON.parse(readFileSync(path, "utf8"));
  const t = r.trace;
  if (!t) return { path, failure: r.failure ?? "no trace" };
  const start = t.instrumentedAt;
  const end = Math.max(t.frames.at(-1) ?? 0, t.receipts.at(-1)?.at ?? 0);
  // 強化選択中と再開待ちは意図した停止。戦闘中の空白と分ける。
  const paused = [];
  for (let i = 0; i < t.choices.length; i++)
    if (t.choices[i].open)
      paused.push([t.choices[i].at, (t.choices[i + 1]?.at ?? end) + RESUME_MS]);
  const inPause = (a, b) => paused.some(([s, e]) => a < e && b > s);
  const pausedMs = paused.reduce(
    (n, [s, e]) => n + Math.max(0, Math.min(e, end) - Math.max(s, start)),
    0,
  );

  const down = r.link.log.filter(
    (e) => e.dir === "down" && Number.isSafeInteger(e.stateId),
  );
  const emitById = new Map(down.map((e) => [e.stateId, e]));
  const acks = r.link.log.filter(
    (e) => e.dir === "up" && Number.isSafeInteger(e.stateAck),
  );
  const inputs = r.link.log.filter((e) => e.dir === "up" && e.type === "input");
  const accepts = t.receipts.filter((x) => x.at >= start);
  const timingAt = (at) => t.timing.filter((x) => x.at <= at + 1).at(-1);

  const gaps = [];
  const combatGaps = [];
  for (let i = 1; i < accepts.length; i++) {
    const a = accepts[i - 1],
      b = accepts[i];
    const gap = b.at - a.at;
    const pausedGap = inPause(a.at, b.at);
    if (!pausedGap) combatGaps.push(gap);
    if (gap <= 250) continue;
    const ea = emitById.get(a.id),
      eb = emitById.get(b.id);
    const frames = t.frames.filter((f) => f > a.at && f < b.at);
    let maxFrame = 0;
    for (let j = 1; j < frames.length; j++)
      maxFrame = Math.max(maxFrame, frames[j] - frames[j - 1]);
    if (frames.length)
      maxFrame = Math.max(maxFrame, frames[0] - a.at, b.at - frames.at(-1));
    else maxFrame = gap;
    // aを受けた後に端末が出した最初のstateAckと、その中継到着(=サーバー受信の近似)
    const ack = acks.find((x) => x.recv >= a.at && x.stateAck >= a.id);
    const timing = timingAt(a.at);
    const emittedBetween = down.filter(
      (e) => e.recv > (ea?.recv ?? a.at) && e.recv < (eb?.recv ?? b.at),
    ).length;
    const row = {
      startOffsetS: round((a.at - start) / 1000),
      gapMs: round(gap),
      paused: pausedGap,
      serverEmitGapMs: ea && eb ? round(eb.recv - ea.recv) : null,
      nextDeliveryMs: eb ? round(b.at - eb.recv) : null,
      relayHoldMs: eb ? round(eb.sent - eb.recv) : null,
      emittedBetween,
      inFlightAtPrev: timing?.stateInFlight ?? null,
      ackSendAfterPrevMs: ack ? round(ack.recv - a.at) : null,
      ackRelayHoldMs: ack?.sent ? round(ack.sent - ack.recv) : null,
      serverEmitAfterAckMs: ack?.sent && eb ? round(eb.recv - ack.sent) : null,
      maxFrameMs: round(maxFrame),
      frames: frames.length,
      inputsSent: inputs.filter((x) => x.recv > a.at && x.recv < b.at).length,
      // サーバーへ実際に届いた入力。250ms以上途切れるとサーバーは無操作として扱う。
      inputsDelivered: inputs.filter((x) => x.sent > a.at && x.sent < b.at)
        .length,
      longestInputSilenceMs: (() => {
        const at = [
          a.at,
          ...inputs
            .filter((x) => x.sent > a.at && x.sent < b.at)
            .map((x) => x.sent),
          b.at,
        ];
        return round(Math.max(...at.slice(1).map((v, i) => v - at[i])));
      })(),
      ammoBefore: t.world.filter((w) => w.at <= a.at).at(-1)?.ammo ?? null,
      ammoAfter: t.world.find((w) => w.at >= b.at + 50)?.ammo ?? null,
      longtaskMs: round(
        t.longtasks
          .filter((x) => x.at < b.at && x.at + x.ms > a.at)
          .reduce((n, x) => n + x.ms, 0),
      ),
      droppedMsDelta: (() => {
        const before = timingAt(a.at)?.clockDroppedMs,
          after = timingAt(b.at)?.clockDroppedMs;
        return before !== undefined && after !== undefined
          ? round(after - before)
          : null;
      })(),
    };
    row.cause =
      row.maxFrameMs >= gap * 0.6
        ? "端末停止（描画も止まった）"
        : row.serverEmitGapMs !== null && row.serverEmitGapMs >= gap * 0.6
          ? row.serverEmitAfterAckMs !== null &&
            row.serverEmitAfterAckMs < 60 &&
            row.inFlightAtPrev >= 1
            ? "送信枠待ち（ACK到着で即送信）"
            : "サーバー送出の空白"
          : row.nextDeliveryMs !== null && row.nextDeliveryMs >= gap * 0.5
            ? "下り配送の遅れ"
            : "混在/判定不能";
    gaps.push(row);
  }
  const frameIntervals = [];
  for (let i = 1; i < t.frames.length; i++)
    if (t.frames[i] >= start && !inPause(t.frames[i - 1], t.frames[i]))
      frameIntervals.push(t.frames[i] - t.frames[i - 1]);
  const emitGaps = [];
  for (let i = 1; i < down.length; i++)
    if (down[i].recv >= start && !inPause(down[i - 1].recv, down[i].recv))
      emitGaps.push(down[i].recv - down[i - 1].recv);
  const delivery = accepts.map((x) =>
    emitById.has(x.id) ? x.at - emitById.get(x.id).recv : NaN,
  );
  const combat = gaps.filter((g) => !g.paused);
  const over = (ms) => combat.filter((g) => g.gapMs > ms).length;
  return {
    path,
    condition: r.condition,
    rep: r.rep,
    spec: r.spec,
    head: r.head,
    failure: r.failure ?? null,
    endedEarly: r.endedEarly,
    pageErrors: r.errors.length,
    wallSeconds: r.wallSeconds,
    measuredSeconds: round((end - start) / 1000),
    pausedSeconds: round(pausedMs / 1000),
    effectiveCombatSeconds: round((end - start - pausedMs) / 1000),
    reconnects: t.events.filter((e) => e.type === "ws-open").length - 1,
    finalWorld: t.world.at(-1),
    acceptedStates: accepts.length,
    combatAcceptGapMs: stats(combatGaps),
    combatGapsOver: { 250: over(250), 500: over(500), 1000: over(1000) },
    serverEmitGapMs: stats(emitGaps),
    emitToAcceptMs: stats(delivery),
    frameIntervalMs: stats(frameIntervals),
    framesOver: {
      50: frameIntervals.filter((x) => x > 50).length,
      100: frameIntervals.filter((x) => x > 100).length,
      250: frameIntervals.filter((x) => x > 250).length,
    },
    stateInFlight: stats(t.timing.map((x) => x.stateInFlight)),
    serverTickMs: stats(t.timing.map((x) => x.tickMs)),
    serverEncodeMs: stats(t.timing.map((x) => x.previousEncodeMs)),
    clockDroppedMsFinal: t.timing.at(-1)?.clockDroppedMs ?? null,
    waitLabels: t.labels
      .filter((l) => l.text.includes("更新待ち"))
      .map((l) => ({ offsetS: round((l.at - start) / 1000), text: l.text })),
    injected: t.events
      .filter((e) => e.type === "injected-stall")
      .map((e) => ({ offsetS: round((e.at - start) / 1000), ms: e.ms })),
    gaps,
  };
}

const results = args.map(analyze);
for (const x of results) {
  if (x.failure && !x.acceptedStates) {
    console.log(`${x.path}: failure ${x.failure.split("\n")[0]}`);
    continue;
  }
  console.log(
    `${x.condition}#${x.rep} 有効戦闘${x.effectiveCombatSeconds}s(計${x.measuredSeconds}s,選択${x.pausedSeconds}s) 受理${x.acceptedStates} 再接続${x.reconnects} ` +
      `受理間隔${JSON.stringify(x.combatAcceptGapMs)} >250/500/1000=${x.combatGapsOver[250]}/${x.combatGapsOver[500]}/${x.combatGapsOver[1000]} ` +
      `送出間隔${JSON.stringify(x.serverEmitGapMs)} 送出→受理${JSON.stringify(x.emitToAcceptMs)} 描画間隔${JSON.stringify(x.frameIntervalMs)} 描画>100ms=${x.framesOver[100]} ` +
      `tick${JSON.stringify(x.serverTickMs)} encode${JSON.stringify(x.serverEncodeMs)} dropped=${x.clockDroppedMsFinal} 終了=${x.endedEarly ? "早期" : "時間"} 例外${x.pageErrors}`,
  );
  for (const g of x.gaps.filter((g) => !g.paused))
    console.log("  gap", JSON.stringify(g));
}
if (jsonOut)
  writeFileSync(
    jsonOut,
    JSON.stringify(
      results.map(({ gaps, ...rest }) => ({ ...rest, gaps })),
      null,
      2,
    ),
  );
