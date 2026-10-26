# 状態送信上限の証拠

`manifest.json` は基点・固定条件・バイト数と対象ソースのSHA-256。サイズは `node ../node_modules/vitest/vitest.mjs run --config scripts/vitest.state-wire.config.ts` で、Gitの基点版と作業版を同一fixtureで比較した。PLEATの姿勢とFOUNDRYの節は合成で、実戦の敵編成・頻度を表さない。バイト数はUTF-8で測定し、省略後の内訳を併記する。

`visual-before.png` / `visual-omitted.png` / `visual-removed.png` は隔離ローカルの実Rendererで撮影。敵1体の表示と内部オーブ数を確認した。オーブ自体は画面に描いておらず、実戦や実スマホの保証ではない。同等の画面は `scripts/state-wire-visual.html` をViteで開いて再現できる。

テスト範囲・初回失敗と再実行・精度の懸念は [詳細記録](../../STATE-WIRE-LIMIT-20261027.md) を参照。
