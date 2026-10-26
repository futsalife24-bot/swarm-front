# 状態送信上限の証拠

`manifest.json` は基点・固定条件・バイト数と対象ソースのSHA-256。サイズは `node ../node_modules/vitest/vitest.mjs run --config scripts/vitest.state-wire.config.ts` で、Gitの基点版と作業版を同一fixtureで比較した。PLEATの姿勢とFOUNDRYの節は合成で、実戦の敵編成・頻度を表さない。バイト数はUTF-8で測定し、省略後の内訳を併記する。

`visual-before.png` / `visual-omitted.png` / `visual-removed.png` は隔離ローカルの実Rendererで撮影。敵1体の表示と内部オーブ数を確認した。オーブ自体は画面に描いておらず、実戦や実スマホの保証ではない。同等の画面は `scripts/state-wire-visual.html` をViteで開いて再現できる。

`audit-636dcd4.txt` は対象HEAD `636dcd48780fb25b20d74b79967e4edc85c8f4e6` の初回独立監査報告原本（SHA-256 `17b0ff124b88ee4bf75cc8648fef833ca6a54274ae4a74c5bbcd8549b99104de`）。判定は要修正。`manifest.json` はこの監査対象HEADの証拠であり、その後の修正のハッシュではない。

`revision-manifest.json` は監査指摘を修正したソース・テストと監査報告原本のSHA-256、および同じ合成条件の測定値を記録する。旧画面向けBASTION斉射方向のみの精度例外は本人が承認した。実スマホ確認は未実施。

`reaudit-4bbce83.txt` は修正後HEAD `4bbce832b2d87fed524949d4ac45a37a1944b395` の独立再監査原本（SHA-256 `0dc0455aa3fbe068f189d967d7b27009f9dffe7eb6ede13b84543094dc01cba3`）。基点の旧画面と修正後の新画面を対象に合格、必須指摘0件。未公開の初回監査版を開いた画面には再読込が必要。独立実行で完了できなかった素材・Git・build、および実スマホ等の限界は報告原本を参照。

テスト範囲・初回失敗と再実行・精度の懸念は [詳細記録](../../STATE-WIRE-LIMIT-20261027.md) を参照。
