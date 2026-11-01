/** Summarize a local numeric-only export without reading game storage or contacting a server. */
import { readFileSync, statSync } from "node:fs";
const path = process.argv[2];
if (!path || statSync(path).size > 5_000_000)
  throw Error("診断JSONのパス（5MB以下）が必要です");
const doc = JSON.parse(readFileSync(path, "utf8"));
const data = doc.observations ?? doc;
const finite = Number.isFinite;
const validRow = (x) =>
  x && finite(x.at) && typeof x.kind === "string" && finite(x.value);
const timeline = (data.timeline ?? []).filter(validRow);
const incidents = (data.incidents ?? []).slice(-6);
const histories = data.serverTraceHistories ?? [];
const all = [
  ...new Map(
    [...timeline, ...incidents.flatMap((x) => x.timeline ?? [])]
      .filter(validRow)
      .map((x) => [`${x.at}/${x.kind}/${x.value}`, x]),
  ).values(),
].sort((a, b) => a.at - b.at);
const count = (rows) =>
  Object.fromEntries(
    [...new Set(rows.map((x) => x.kind))].map((k) => [
      k,
      rows.filter((x) => x.kind === k).length,
    ]),
  );
const summaries = incidents.map((incident) => {
  const end = incident.at,
    start = end - incident.gapMs;
  const during = all.filter((x) => x.at > start + 1 && x.at < end - 1);
  const near = all.filter(
    (x) =>
      x.at >= start - 200 && x.at <= end + 200 && x.kind.startsWith("cloud"),
  );
  // Each incident stores a consecutive tail. Combining separate archives can hide a reconnect.
  const local = (incident.timeline ?? []).filter(validRow);
  const lastConnect =
    local.filter((x) => x.kind === "connect" && x.at <= end).at(-1)?.at ??
    -Infinity;
  const connectedStates = local.filter(
    (x) => x.kind === "state" && x.at >= lastConnect && x.at <= end,
  );
  const baseline = Math.min(...connectedStates.map((x) => x.at - x.value));
  const lastState = connectedStates.at(-1);
  // A discontinuous archive is never used to invent gaps; only app-recorded incidents are reported.
  const candidates = histories
    .filter((x) => finite(x.at) && x.at >= end - 1 && x.at <= end + 1500)
    .sort((a, b) => a.at - b.at);
  return {
    startMs: start,
    endMs: end,
    gapMs: incident.gapMs,
    clientDuring: count(during),
    maxRecordedRafGapOverlappingMs: Math.max(
      0,
      ...all
        .filter(
          (x) => x.kind === "frame" && x.at > start && x.at - x.value < end,
        )
        .map((x) => x.value),
    ),
    cloudNear: near.map(({ at, kind, value }) => ({
      relativeMs: at - start,
      kind,
      value,
    })),
    relativeStateLagWithinIncidentMs:
      lastState && finite(baseline)
        ? lastState.at - lastState.value - baseline
        : null,
    relativeBaselineStateCount: connectedStates.length,
    relativeBaselineStartMs: connectedStates[0]?.at ?? null,
    candidateServerHistories: candidates.map((after) => {
      const history = after.data?.history ?? [];
      return {
        receivedAtMs: after.at,
        receivedAfterIncidentMs: after.at - end,
        epoch: after.data.epoch,
        sequence: after.data.sequence,
        pendingWrites: after.data.pendingWrites,
        droppedMs: after.data.droppedMs,
        tick: after.data.tick,
        historyRows: history.length,
        serverSpanMs: history.length ? history.at(-1)[3] - history[0][3] : 0,
        kinds: Object.fromEntries(
          [...new Set(history.map((x) => x[1]))].map((k) => [
            k,
            history.filter((x) => x[1] === k).length,
          ]),
        ),
      };
    }),
  };
});
console.log(
  JSON.stringify(
    {
      build: doc.build,
      capturedAt: doc.capturedAt,
      timelineRows: timeline.length,
      overwritten: data.overwritten,
      caveats: [
        "server ws.sendは呼出成功であり実配送完了ではない",
        "stateIdは正確な送出時刻ではなく相対遅延も補助指標",
        "相対遅延の基準は各incident内の連続記録だけで、接続全体の最小値ではない",
        "candidateServerHistoriesは受信時刻が近い候補であり停止との対応は未確定",
        "server historyは現在のpacketのencode/sendを含まず、末尾send不在だけでは停止と判定しない",
        "incidentは状態受理の空白であり、結果画面・再出撃・選択画面等と照合が必要",
        "cloudNearが空でも以前に始まったHTTP待ちを否定できずcloudEventsも照合する",
        "描画間隔は記録されたものだけであり、記録不在を描画継続と扱わない",
        "保存履歴は有限でありイベント不在を常に未発生と扱わない",
        "同期CPU中のserver Date.nowはCPU時間を示さない",
      ],
      cloudEvents: all.filter((x) => x.kind.startsWith("cloud")),
      incidents: summaries,
    },
    null,
    2,
  ),
);
