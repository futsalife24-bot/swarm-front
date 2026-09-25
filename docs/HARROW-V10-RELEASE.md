# HARROW v10 ゲーム採用・公開

2026-09-25。ユーザー指定のドラゴン胴体とコア浮遊・左右独立の不規則翼動作を、ゲームのHARROWへ採用する。制作候補と独立監査の記録は [v10設計](../assets/blender/candidates/harrow/v10/DESIGN.md)・[候補監査](../assets/blender/candidates/harrow/v10/AUDIT.md)。公開工程の判定と配信結果は本書に追記する。

## 変更と互換性

- base main `78616fc83b345ed0a75ca924050d596f1d018a9c`、branch `codex/harrow-v10-release`、作業場所 `../share-image-fix`。別作業中の `game/` は変更しない。
- ゲーム用GLBを `public/assets/enemies/harrow_motion_v10.glb` に追加し、HARROWのloaderだけをv10へ切替。新URLでService Workerの旧キャッシュを避ける。元のv9素材は保持。
- Flightは16.8秒ループ。左7回・右5回の独立した変動周期を保存済みGLBに焼き込み、胴体は翼と独立して高度を保つ。図鑑のFlight区間も同じ16.8秒へ合わせる。毎回新しい乱数を引く動作ではない。
- 空中ミサイルの発射時刻3.5秒では、AirThreatの左右の翼を既存の発射姿勢へ滑らかに寄せる。前後は独立周期の模倣を残す。ミサイルの時刻・位置・威力、戦闘AI、判定、飛行高度は変更しない。
- 再生成した採用GLBとBlender原本を同じv10候補に保存。F1修正版の採用GLB SHA256 `460b71eb6840b25e2565fbcc23d4cdcfac5710643965fdd11fe83dd4c5ba7cf5`、9,007,852 bytes。旧単体候補・初回監査版とは異なる修正版を限定再監査した。

## 自己検証

- F1修正後、型チェック成功。HARROWモデル・攻撃・図鑑・描画状態など関連Vitest 7ファイル119件成功。特に地上/空中それぞれ10基の弾頭先端と権威側発射原点が一致。
- `verify_change.mjs`: 胴体以外183メッシュと、Flight/AirThreat以外10動作をv9から維持。Flight左右7/5周期・胴体固定を確認。
- Blender 5.2.1 LTSの別プロセスで保存原本と採用GLBを再読込し、全12動作が成功。AirThreatの発射補正係数は0〜7秒の701点で0〜1、窓外0、3.5秒で1を生成時に検査。Three.js再読込ではAirThreat全7秒の25ms隣接キーで左右上翼の最大回転2.430度、Launcher全頂点の最大移動0.773m（ゲーム倍率後）を確認。
- F1修正後のproduction build・Worker dry-run成功。配布ビルドのタイトルと図鑑の表示は初回版で確認。修正後のGLBをThree.jsレビュー画面でAirThreat連続再生し、ブラウザconsole error/warn 0。Blenderで発射前2.8秒・発射3.5秒・発射後4.5秒の追加3画像を目視。未遭遇図鑑のため実ゲーム中のHARROW実GPU再生は未確認。
- 既存の `npm run test:offline` はローカルpreview起動後も「ソロ出撃」ボタンを待ってタイムアウト。現UIでは「ソロで出撃準備」まで表示でき、次画面の旧ラベル前提による停止。HARROW描画・オフライン通信の成功と扱わない。
- [PR86](https://github.com/futsalife24-bot/swarm-front/pull/86) の初回実装対象は `b715df40dbf151ffeb622170ff9e11b326f75b7e`、baseは上記main。初回監査資料 `dist-validation/harrow-v10-release/HARROW-v10-release-b715df4-audit.zip` は28,245,718 bytes、SHA256 `0cfdf270dc2d849b2558aff7803f8159ce3203b5ae30bfb3156a2053b8919870`。
- ユーザー承認のZIPを送った[初回監査Chat](https://chatgpt.com/c/6ab5db72-3bdc-83ee-ba12-7e5322df4432) は **FAIL／F1 P1**。AirThreat発射姿勢の補正係数が範囲外で暴走し、採用GLBの上翼が25msで約179.5度回転した。3.5秒の静止発射原点は一致していたため従来テストでは見逃した。監査はmain反映・公開を止め、局所クランプ・原本/GLB再生成・全区間の角速度/翼端/中間描画・再監査を要求。
- F1を補正入力の局所クランプで修正し、原本・候補GLB・publicの採用GLBを再生成。新SHA、連続回転・全Launcher頂点の移動、11枚の描画、Three.js実再生で自己検証した。修正commit `c1cefef8955af03ef73c41922a2be0bba265feec` はPRへpush済み。限定再監査ZIP `dist-validation/harrow-v10-release/HARROW-v10-F1-reaudit-c1cefef.zip` は31,110,504 bytes、SHA256 `2ab087165cad323d131e123382627a2c859b7a4b2e6630ca8e2112bc0ae70fad`。送信の個別承認後、同じ監査Chatへ添付した。

## 独立再監査・公開

- [限定再監査](https://chatgpt.com/c/6ab5db72-3bdc-83ee-ba12-7e5322df4432) は修正実装 `c1cefef8955af03ef73c41922a2be0bba265feec` を **PASS**、P0/P1/P2各0件、main反映・既存Worker公開可と判定。ZIP/候補・配布GLBのSHA一致、AirThreat全7秒の翼・Launcher連続動作、GPU骨パレット中間補間の最大誤差約0.02116m、地上/空中各10発射原点、Flight左右7/5回、他10動作の維持を独立確認。GitHub PR全体、Vitest/型/ビルド、実ゲーム戦闘・実スマホ性能・Service Worker実更新は監査側の独立実行範囲外。
- [PR86](https://github.com/futsalife24-bot/swarm-front/pull/86) を通常merge。公開用ソースmain `4e707332ee3bbef6366fde5182fa38e50aea6561`。merge後mainからproduction buildと既存 `wrangler.production.jsonc` のdry-run成功。既存 `swarm-front` Workerへ公開し、Worker Version `278c9c63-2adb-4cd9-bf69-0659d0eac5b0`。
- `https://swarm-front.melosalife-24.workers.dev` の `/api/health` は200/`ok:true`。更新9配信ファイルすべてがmerge後ローカルdistとSHA256一致し、HARROW GLBの配信SHAも上記修正版と一致。検証結果は `dist-validation/harrow-v10-release/release-delivery.json`。公開画面をiabで開き、中断済みST1の再開案内を確認、console warn/error 0。既存保存は変更していない。
- ローカルproduction previewで新規進行の確定操作は、保存状態への影響を理由に自動承認審査が拒否。公開中のHARROW実戦・図鑑での実GPU再生は未確認であり、上記のGLB/Three.js連続再生・監査の数値確認とは区別する。

## 制約

左右のランダムな速さは16.8秒で繰り返す有限アニメーション。実スマホの初回読込性能と人操作の難度はこの検証からは断定しない。
