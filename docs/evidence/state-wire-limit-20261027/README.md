# 状態送信上限の証拠

`manifest.json` は基点・固定条件・バイト数と対象ソースのSHA-256。サイズは `node ../node_modules/vitest/vitest.mjs run --config scripts/vitest.state-wire.config.ts` で、Gitの基点版と作業版を同一fixtureで比較した。PLEATの姿勢とFOUNDRYの節は合成で、実戦の敵編成・頻度を表さない。バイト数はUTF-8で測定し、省略後の内訳を併記する。

`visual-before.png` / `visual-omitted.png` / `visual-removed.png` は隔離ローカルの実Rendererで撮影。敵1体の表示と内部オーブ数を確認した。オーブ自体は画面に描いておらず、実戦や実スマホの保証ではない。同等の画面は `scripts/state-wire-visual.html` をViteで開いて再現できる。

`audit-636dcd4.txt` は対象HEAD `636dcd48780fb25b20d74b79967e4edc85c8f4e6` の独立監査報告原本（SHA-256 `17b0ff124b88ee4bf75cc8648fef833ca6a54274ae4a74c5bbcd8549b99104de`）。判定は要修正で、修正後の独立再監査はまだ行っていない。`manifest.json` はこの監査対象HEADの証拠であり、その後の修正のハッシュではない。

`revision-manifest.json` は監査指摘を修正したソース・テストと監査報告原本のSHA-256、および同じ合成条件の測定値を記録する。旧画面向けBASTION斉射方向のみの精度例外は本人が承認した。修正後の同じChatでの再監査と実スマホ確認は未実施。

テスト範囲・初回失敗と再実行・精度の懸念は [詳細記録](../../STATE-WIRE-LIMIT-20261027.md) を参照。
