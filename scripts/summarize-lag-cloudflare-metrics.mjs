import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2] ?? "dist-validation/lag-live-20261101/cloudflare";
const video = JSON.parse(readFileSync(join(root, "video-window.json"), "utf8"));
const gate = JSON.parse(readFileSync(join(root, "gate-window.json"), "utf8"));
const data = video.viewer.accounts[0],
  gates = gate.viewer.accounts[0];
const total = (rows, field) =>
  rows.reduce((n, row) => n + (row.sum[field] ?? 0), 0);
const started = Date.parse("2026-11-01T11:39:43Z");
const incoming = data.invocations.filter(
  (x) => x.dimensions.type === "hibernation",
);
const inVideo = incoming.filter(
  (x) =>
    Date.parse(x.dimensions.datetime) >= started &&
    Date.parse(x.dimensions.datetime) < started + 82000,
);
console.log(
  JSON.stringify(
    {
      source: "Cloudflare GraphQL read-only, swarm-front Room/Gate namespaces",
      queriedWindow: ["2026-11-01T11:39:00Z", "2026-11-01T11:42:00Z"],
      assumedVideoStart: "2026-11-01T11:39:43Z",
      caveats: [
        "動画名の開始時刻を仮定。端末時計の差と厳密なRoom同定は未確認",
        "周期集計は約1分。約1秒の停止やws.send後の端末到着は証明しない",
        "invocationの秒bucketに件数があっても、その秒内の空白を否定しない",
        "wallTimeはI/O待ちを含む複数呼出の合計で、CPUや停止時間ではない",
        "サーバー版は確認できるが、スマホ側クライアントの版は未確認",
        "cloudAdmissionの記録不在は未連携の証明ではなく、到達したHTTP保存要求が観測されなかったという意味",
      ],
      periodicObjects: new Set(data.periodic.map((x) => x.dimensions.objectId))
        .size,
      invocationObjects: new Set(
        data.invocations.map((x) => x.dimensions.objectId),
      ).size,
      serverVersions: [
        ...new Set(data.invocations.map((x) => x.dimensions.scriptVersion)),
      ],
      statuses: [...new Set(data.invocations.map((x) => x.dimensions.status))],
      invocationRequests: total(data.invocations, "requests"),
      invocationErrors: total(data.invocations, "errors"),
      cpuSeconds: total(data.periodic, "cpuTime") / 1e6,
      activeSeconds: total(data.periodic, "activeTime") / 1e6,
      periodic: data.periodic.map((x) => ({
        at: x.dimensions.datetime,
        colo: x.dimensions.coloCode,
        sampleInterval: x.avg.sampleInterval,
        count: x.count,
        cpuSeconds: x.sum.cpuTime / 1e6,
        activeSeconds: x.sum.activeTime / 1e6,
        outboundMessages: x.sum.outboundWebsocketMsgCount,
        inboundMessages: x.sum.inboundWebsocketMsgCount,
        cpuErrors: x.sum.exceededCpuErrors,
        memoryErrors: x.sum.exceededMemoryErrors,
        fatalErrors: x.sum.fatalInternalErrors,
        rowsWritten: x.sum.rowsWritten,
        maxConnections: x.max.activeWebsocketConnections,
        maxMemoryBytes: x.max.memoryUsageBytes,
      })),
      videoBuckets: inVideo.length,
      minimumRecordedRequestsPerVideoSecond: Math.min(
        ...inVideo.map((x) => x.sum.requests),
      ),
      candidateWindows: [17.2, 32.4, 47, 62.2, 77].map((offset) => {
        const center = Math.floor((started + offset * 1000) / 1000) * 1000;
        return {
          videoSeconds: offset,
          at: new Date(center).toISOString(),
          buckets: incoming
            .filter(
              (x) =>
                Math.abs(Date.parse(x.dimensions.datetime) - center) <= 1000,
            )
            .map((x) => ({
              at: x.dimensions.datetime,
              requests: x.sum.requests,
              errors: x.sum.errors,
              wallTimeUs: x.sum.wallTime,
            })),
        };
      }),
      cloudAdmissionRows: gates.cloudAdmission.length,
      cloudAdmissionRequests: total(gates.cloudAdmission, "requests"),
      directory: gates.directory.map((x) => ({
        at: x.dimensions.datetime,
        requests: x.sum.requests,
        errors: x.sum.errors,
        sampleInterval: x.avg.sampleInterval,
        wallTimeUs: x.sum.wallTime,
      })),
    },
    null,
    2,
  ),
);
