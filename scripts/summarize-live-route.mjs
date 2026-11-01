import { readFileSync } from "node:fs";
const trace = JSON.parse(readFileSync(process.argv[2], "utf8"));
const routes = JSON.parse(
  readFileSync(process.argv[3], "utf8").replace(/^\uFEFF/, ""),
);
const source = [
  ...trace.samples.map((x) => x.diagnostics),
  trace.diagnostics,
].filter(Boolean);
const incidents = [
  ...new Map(
    source.flatMap((x) => x.incidents ?? []).map((x) => [x.at, x]),
  ).values(),
].sort((a, b) => a.at - b.at);
const stats = (rows) => ({
  count: rows.length,
  maxMs: rows.length ? Math.max(...rows.map((x) => x.ms)) : null,
  failed: rows.filter((x) => x.status !== "Success" && x.status !== 200).length,
});
const frames = trace.client?.frames ?? [];
const health = trace.client?.health ?? [];
const epoch = trace.client?.timeOrigin;
const output = {
  source: process.argv[2],
  routeSource: process.argv[3],
  build: trace.clientBuild,
  startedAt: trace.startedAt,
  wallSeconds: trace.wallSeconds,
  errors: trace.errors?.length,
  method:
    "障害注入なしの本番PC Wi-Fi。別HTTPS/ICMPを同時記録。PC結果でスマホの改善を証明しない。",
  health: stats(health),
  gateway: stats(routes.filter((x) => x.role === "gateway")),
  internet: stats(routes.filter((x) => x.role === "internet")),
  incidents: incidents.map((x) => {
    const start = x.at - x.gapMs,
      end = x.at;
    const h = health.filter((r) => r.at <= end && r.at + r.ms >= start);
    // 初回probeは完了時刻を持たない。timeout500msを実測継続時間とみなさない。
    const near = routes.filter(
      (r) => r.at <= epoch + end && (r.endAt ?? r.at) >= epoch + start,
    );
    const f = frames.filter((r) => r.at >= start && r.at - r.ms <= end);
    return {
      at: new Date(epoch + end).toISOString(),
      startMs: start,
      endMs: end,
      gapMs: x.gapMs,
      frameMaxMs: f.length ? Math.max(...f.map((r) => r.ms)) : null,
      health: h,
      gateway: stats(near.filter((r) => r.role === "gateway")),
      internet: stats(near.filter((r) => r.role === "internet")),
    };
  }),
  caveats: [
    "healthは1秒ごと、ICMPは250ms間隔以上。無標本は正常の証明ではない。",
    "初回ICMPは完了時刻未保存のため開始点だけを窓内照合する。timeout設定500msを実測待機時間に置換しない。",
    "ICMPとWebSocketはプロトコルと経路が一致しない。healthもゲームRoomは通らない。",
    "状態空白は強化選択/再開なども含み得る。大きな描画停止と区別して判断する。",
  ],
};
console.log(JSON.stringify(output, null, 2));
