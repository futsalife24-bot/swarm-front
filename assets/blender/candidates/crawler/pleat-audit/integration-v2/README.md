# v3統合案・第2版（未適用）

造形v3 GLB `81bbfe16449f9d7e3e954c0baaa10e56f9bbff433d5aed4522b2a6d685ecedbc` は固定。今回の変更は既存game.ts/render.tsに対する提案コピーと検査のみ。本体適用・モデル採用・公開はしていない。

前案の「前回GLB clip」を方向選択に使う条件を廃し、描画側でcrawlerごとのcool変化・現在wind・復帰終了時刻を記録する。前回coolからの上昇で発動を検出し、保存済みtx/tzへ向く。GLBの存在・読込成否・Controllerの更新順序に依存しない。初回観測のcoolは発動とみなさない。非active・復帰終了・敵消失・Worldなしで保持を解除する。

値0.45/1.2/復帰0.75は現行STRUCTURE_TIMING.crawlerに対応。HP・攻撃範囲・威力・クールダウン定義を変更しない。wind正値の判定へ直すのもcrawlerのみ。

## 検査

`node assets/blender/candidates/crawler/pleat-audit/check-proposal-v2.mjs`

実step・実RendererをVite応答内だけで提案へ置換。読込済み/読込保留/読込失敗 × 予兆描画あり/予兆描画スキップ × 静止/左/右 = 18条件で成功。

- 初期cool=1.2を誤認せず標的へ向く。
- wind描画を全て省略しても、初回burstで保存済み照準との方向差1e-5rad未満。
- 0.05秒9更新、0.45秒でburstが1回。静止ではHP150、左右回避で160。
- 復帰後は標的方向へ戻る。GLB読込済み時はLocomotionへ復帰。
- 非activeによる中断で向きを解除。WorldはRendererから変更されない。

results.jsonに18条件の全時系列。初回観測から発動まで一度も描画していない新規個体は、初期coolと発動済みcoolをこの情報だけで区別できない。今回のスキップ検査は攻撃前の個体状態を一度観測した後に予兆だけを省略した条件。未検査を保証しない。

録画はrecord-proposal-v2.mjsで現行と第2案を比較。固定カメラ・画面にシミュレーション秒/clip/wind/HPを表示。壁時計での録画速度はCPU負荷に左右されるため、等速動画・実機FPS測定ではない。

必要な元実装・依存情報は既提出pleat-v3-review.zipのaudit-workspaceを併用。この追加ZIP単体を完全な起動環境とは扱わない。本適用後のtypecheck/回帰と実スマホ性能は未確認。本人への2ファイル変更承認は未回答のため適用しない。
