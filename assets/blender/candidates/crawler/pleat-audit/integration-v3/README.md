# 統合第3案：戦闘切替で状態を消去（未適用）

固定モデルはPLEAT v3、GLB SHA256 `81bbfe16449f9d7e3e954c0baaa10e56f9bbff433d5aed4522b2a6d685ecedbc`。造形・GLBは変更していない。

第2案への監査の途中指摘「Renderer再利用で前個体の記録が混在」を実Rendererで再現。既存の`w.run`変更/World解除時の`visual.clear()`と同時に、新規crawlerAimとcrawler Controllerのstatesを消去する。元のゲーム/renderソースは未変更。2ファイルへの適用は本人の承認待ち。

## 差分検証

- `check-proposal-reset.mjs`: 第2案の新run・同じ敵ID・時刻が前run以上の条件で90度ずれを再現。第3案では0度かつ前runのLungeを引き継がない。
- 同検査でWorld=null、敵消滅、時刻巻き戻り、非activeも検査。第3案は6条件すべて方向差1e-5rad未満。
- `check-proposal-v3.mjs`: 第3案でGLB読込済み/遅延/失敗、予兆スキップ有無、静止/左右の18条件を再実行。0.45秒発動・burst1回・方向・初期cool・復帰を確認。
- `typecheck-proposal-v3.ps1`: 元src/serverを検査専用コピーに保存し、提案2ファイルだけ反映。現行tsc CLIでclient/workerの両設定が成功。元のソースは上書きしない。

この版の新しい証拠はリセット回帰と18条件の数値/実Renderer検査。新動画は作成していない。第2案の比較録画を、第3案の新録画や戦闘切替の目視済み証拠として扱わない。造形・基本動作の実物証拠は外部PASSのv3 ZIPから参照。

初回観測から既に攻撃が済んでいる新個体を、初期coolと区別する情報は現行の入力にはない。呼出元を調査した結果、攻撃前観測の保証はなかった（FIRST_OBSERVATION_CONTRACT.md）。この限界は第2案から維持。既存の描画開始契約で追加仕様が必要かは監査へ評価を依頼済み。本人の見た目承認・モデル本採用・公開・本適用後の回帰・実スマホ性能は未実施。

