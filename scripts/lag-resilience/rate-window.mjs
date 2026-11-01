// サーバー(webSocketMessage)と同じ固定窓で、上りメッセージ数の最大値を中継記録から再計算する。
// 使い方: node scripts/lag-investigation/rate-window.mjs <trace.json>...
import { readFileSync } from "node:fs";

for (const path of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(path, "utf8"));
  for (const c of r.link.connections) {
    // 中継送出時刻(sent)と中継接続時刻による近似。実サーバー受信時刻ではない。
    const up = r.link.log
      .filter((e) => e.c === c.id && e.dir === "up" && e.sent)
      .sort((a, b) => a.sent - b.sent);
    let window = c.openedAt,
      count = 0,
      peak = { count: 0 };
    const types = [];
    for (const e of up) {
      if (e.sent - window >= 1000) {
        window = e.sent;
        count = 0;
        types.length = 0;
      }
      count++;
      types.push(e.type);
      if (count > peak.count) {
        const by = {};
        for (const t of types) by[t] = (by[t] ?? 0) + 1;
        peak = {
          count,
          atS:
            Math.round(
              (e.sent - (r.trace?.instrumentedAt ?? c.openedAt)) / 100,
            ) / 10,
          by,
        };
      }
    }
    console.log(
      `${r.condition}#${r.rep} 接続${c.id} 最大${peak.count}件/窓 (上限35) at=${peak.atS}s ${JSON.stringify(peak.by)} close=${c.upstreamClose ?? "-"}`,
    );
  }
}
