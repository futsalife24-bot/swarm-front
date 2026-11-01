# 本人の部屋での初回本番PC計測

この文書は初回計測時点の切り分け。後続の同時HTTPS/ICMP計測と本人の同SSID回答は[現在の照合記録](README.md)を参照。

## 対象と資料

- 対象の公開ソースSHA: `b645183c1d60d3eeb351b8e142d206f08f05683a`。この文書作成時の作業基点: `852906439faf895796adef1cd7efe1a24f6819de`。
- 本人が提供した検証用の部屋へ、空のPC Chromeから通常UIで参加した。障害注入なし。計測は25.41秒で、スクリプトが強化選択待ちを誤認して接続を閉じた。**ゲームや通信の自然切断ではない**。
- 生データはGit管理外の `dist-validation/lag-live-20261101/1793538631405/` にある `trace.json`、`diagnostic-export.json`、`analysis.json`。診断timelineは1586行、上書き0。公開版に備わる有限server履歴が2件添付された。
- PCの接続はWi-Fi、アダプターはIntel AX211。表示されたリンク速度907Mbpsは無線の接続速度であり、実効帯域・遅延・損失率を示さない。本人のOPPO端末と同じLANだったかは未確認。

client時刻は同一ページ内の `performance.now()` ミリ秒で、計測開始より前から進んでいる。したがって後述の43～59秒台のclient時刻は25.41秒の計測と矛盾しない。server時刻はepochミリ秒。両者の絶対値は直接引き算しない。以下のstateIdはサーバーで送信前に採番されるため、対応するserver履歴の `sendEnd=1` と照合した。`sendEnd=1` は `ws.send` 呼出成功であり端末への配送完了ではない。

## 918.1msの状態空白

clientはstate `1793538675290` を43617.6msに受理し、次のstate `1793538675510` を44535.7msに受理した。server履歴には両stateの1 chunk送信呼出成功がそれぞれepoch `1793538675290`msと`1793538675510`msで記録される。server側の送信間隔220msに対しclient側の受理間隔は918.1msで、**間隔差は698.1ms**。これは同じstate列の差分であり、端末とserverの時計合わせを要しない。

| 順序 | server履歴 | client timeline |
| --- | --- | --- |
| 空白直前 | state `…5290` の `sendEnd=1`、tick198 | raw4879byte→state `…5290` を43617.6msに受理 |
| 途中 | `…5290` のACKをepoch `…5510`msに受理。同時刻にstate `…5510` を1 chunk送信呼出成功 | 43617.8msに70byteのcontrolと入力receipt。以後、44533.6msまでraw受信なし |
| 終端 | state `…5590` もepoch `…5590`msに1 chunk送信呼出成功 | 44533.6msに70byte control、44534.2msにstate `…5510` のraw5639byte、44535.7msに受理 |
| 直後 | `…5590` のACKはepoch `…6438`msに受理。server履歴末尾は次stateのencode開始まで | state `…5590` を44537.0msに受理。複数の70byte controlも44537ms台に密集 |

「空白中にraw message 2件、receipt 1件」という解析値は、controlが期間中ずっと通過した意味ではない。control受信は空白の開始直後と終了直前で、その間は約916msのraw受信空白である。終了stateのraw受信から受理までは約1.5ms。client入力送信は43635.3～44339.1msに14件、ほぼ50ms周期で続いた。

## 1127.2msの状態空白

clientはstate `1793538690102` を58354.5msに受理し、次のstate `1793538690190` を59481.7msに受理した。server履歴の両state送信呼出はそれぞれepoch `1793538690102`msと`1793538690190`msで、間隔88ms。client受理間隔との差は**1039.2ms**である。

| 順序 | server履歴 | client timeline |
| --- | --- | --- |
| 空白直前 | state `…0102` を1 chunk送信呼出成功、tick494 | raw6067byte→state `…0102` を58354.5msに受理 |
| 途中 | epoch `…0190`msにstate `…0190`、`…0290`msにstate `…0290` を各1 chunk送信呼出成功。epoch `…0201`msに `…0102` のACKを受理 | 58353.8msのrawの次は59480.9msまでraw受信なし。入力送信は58365.5～59087.5msに15件続く |
| 終端 | `…0290` のACKをepoch `…1354`msに受理。server履歴末尾は次stateのencode開始まで | 59480.9msにstate `…0190` のraw、59481.7msに受理。state `…0290` も59482.8msに受理し、controlが続けて届く |

終端stateのraw受信から受理までは約0.8ms。serverでは途中もtickが約50msで進み、controlの送信呼出も繰り返された。clientではrawが約1127ms途絶えた後にstateとcontrolがまとまって届く。

## 切り分けと限界

- 両空白中、記録された描画間隔の最大値は16.8/16.9ms。画面の描画停止や状態復元処理だけで約1秒の空白を説明しにくい。ただし記録は250msごとのframe標本と長いframeの通知であり、全frameの連続ログではない。
- server履歴は各128行で対象の空白を覆う。tickは概ね50ms、`clockDroppedMs=0`、`pendingWrites=0`で、`persistStart/End`がない。今回2件のRoom保存output gate・定常tick停止を支持しない。ただし同期CPU中はserverの`Date.now()`/`performance.now()`がCPU所要時間を正確に示さず、短い処理負荷を完全排除しない。
- cloud確認の開始/終了は記録されたが、HTTP要求イベントはなく、2空白ともcloud確認時刻と重ならない。このPC試行ではクラウド通信が直接の引き金とは言えない。
- 未ACKのstateが2件になるとserverのstate flowは新しいstateを保留し、入力receipt等のcontrolは送信し続ける。server送信間隔にはこのACK枠待ちが混ざる。一方、すでに `ws.send` 呼出成功したstateの受信が698.1/1039.2ms相対的に遅れたため、**ACK枠待ちだけを一次原因とはできない**。ACK長期停止は下り到着遅延に続いた結果とも整合する。
- clientは未確認入力が上限に達すると以後の入力送信を抑える。空白の終盤に入力送信が止まったことだけで、上り回線が先に止まったとは判定できない。
- controlがstateを追い越したという記録はない。送信時刻が離れたフレームが受信側では密集しており、TCP順序を保つ下りの滞留・まとめ配送と整合する。ただし個々のcontrolにserver側IDはなく、厳密な1対1対応は未確認。
- `ws.send`後のどこで遅れたか（Cloudflare内部キュー、エッジからPC、PCのWi-Fi/OS/ChromeのWebSocket受信処理など）は特定できない。本人のスマホ診断JSONも未取得で、PCとの同一LAN・同一経路も未確認。PCで再現した事実をスマホの根因確定と扱わない。

## 最小再集計

リポジトリルートで、PowerShellから次を実行する。秘密・部屋情報を出力せず、state時刻、ACK、送信呼出、対象窓のraw受信時刻だけを表示する。server行のcode `5` はencode終了（値はchunk数）、`7` は送信呼出終了（値1=state、2=control）、`8` はACK、`9/10` は保存開始/終了、tickIntervalsはcode `1` の間隔である。

```powershell
$p = 'dist-validation/lag-live-20261101/1793538631405/diagnostic-export.json'
node -e '
const d = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).observations;
for (const x of [
  { lo: 43617, hi: 44537.1, serverLo: 1793538675290, serverHi: 1793538676438 },
  { lo: 58354, hi: 59482.9, serverLo: 1793538690102, serverHi: 1793538691354 },
]) {
  console.log("window", x.lo, x.hi);
  const client = d.timeline.filter(e => e.at >= x.lo && e.at <= x.hi);
  console.log("client", client.filter(e => ["message", "receipt", "state"].includes(e.kind)).map(e => [Math.round(e.at * 10) / 10, e.kind, e.value]));
  console.log("inputs", client.filter(e => e.kind === "input").length, "maxFrameMs", Math.max(...client.filter(e => e.kind === "frame").map(e => e.value)), "cloudHttp", client.filter(e => ["cloudRequest", "cloudResponse"].includes(e.kind)).length);
  const h = d.serverTraceHistories.find(e => e.at > x.hi && e.at < x.hi + 500);
  const server = h.data.history.filter(r => r[3] >= x.serverLo && r[3] <= x.serverHi);
  console.log("server", server.filter(r => [5, 7, 8, 9, 10].includes(r[1])).map(r => [r[1], r[2], r[3], r[4]]));
  console.log("tickIntervals", server.filter(r => r[1] === 1).map(r => r[4]), "pendingWrites", h.data.pendingWrites, "droppedMs", h.data.droppedMs);
}
' $p
```

`serverTraceHistories` の履歴は添付state自身の送信イベントを含まないため、終端の `encodeStart` より先は別の受信stateで照合する。
