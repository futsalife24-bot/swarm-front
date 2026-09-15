# PLEAT v3: 未適用の統合修正案

対象GLB: `81bbfe16449f9d7e3e954c0baaa10e56f9bbff433d5aed4522b2a6d685ecedbc`。
既存ゲームコードは未変更。ゲーム本採用・公開も未実施。

## 変更提案

- `game-fix.diff`: crawlerの溜め残時間が1e-9未満なら0へ正規化。0.45秒から0.05秒を9回減算した微小正値による発動遅延と、発動後の負値を解消。
- `render-fix.diff`: crawlerのLunge中は保存された照準方向を描画にも使う。予兆中の標的の左右移動で実攻撃方向と見た目がずれる問題への案。
- 攻撃性能・0.45秒という定義・GLBは変更しない。2ファイルの変更は当初の候補制作範囲を越えるため、本人へ承認を確認中。承認前に適用しない。

## 実行証拠

`node assets/blender/candidates/crawler/pleat-audit/check-integration-proposal.mjs`

Vite 5199を使用。実stepと実Rendererを動かし、GLBと提案コードを検証用ブラウザの応答内だけで差し替える。通常のソースは書き換えない。生成するproposed.txtも候補監査フォルダ内のコピー。

静止・左移動・右移動の3条件を現行/修正案で比較した。

| 検査 | 現行 | 修正案 |
|---|---|---|
| 予兆開始から最初のburst | 0.50秒 | 0.45秒 |
| 左右移動時の発動方向差 | 約90度 | 0度 |
| 発動時のLunge時刻 | 0.45秒 | 0.45秒 |
| 攻撃・復帰後に標的を離す | 3条件ともLocomotionに戻らない | 3条件ともLocomotionへ戻る |
| RendererによるWorld変更 | なし | なし |

`integration-proposal-results.json`に全時系列と検査結果。動画`integration-videos/current.webm`と`proposed.webm`は同じ固定カメラ・照明・縮尺。画面にside・シミュレーション秒・clip・wind・HPを表示する。

動画の壁時計時間は描画処理負荷を含み、等速でもFPS測定でもない。比較時は画面のシミュレーション秒を使う。`sampled-frames.png`は保存動画の代表フレームを復号し目視した証拠。全編連続目視、実スマホ性能、ソースへの本適用後の回帰は未確認。

## 残条件

本人の2ファイル変更承認、本適用後の必要な回帰検証、外部監査による修正案の評価。描画のLunge参照はGLB Controllerに依存するため、読込前/フォールバック経路の向きも適用時の確認対象。現在の3条件成功だけを全経路の保証にしない。
