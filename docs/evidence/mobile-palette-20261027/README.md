# PLEAT姿勢転送の集約（2026-10-27）

本人のOPPO Find X8で協力ソロが重いとの動画報告への第一段階の修正。ホーム画面起動は本人推定（PWA未確認）。基点main 518c97261fdff13e4f70b7f11ef970a8e9af43c7、branch codex/mobile-palette-20261027、作業場所は既存dist-h。元rootの別差分は保持。本人の動画・セーブは公開しない。

## 変更

hound-motion.tsのみ製品変更。PLEATの接地姿勢パレットを1個体1物理行から最大16個体1物理行へ横並びにし、Threeが隣接範囲をまとめてGPU転送できるようにした。骨行列・個体数・モーション計算・敵の見た目・判定・通信・報酬は変更なし。既存クリップと現行姿勢の論理アドレスを保持し、シェーダーで物理座標へ変換する。最大幅2048以内、実PLEATは1280。末尾行のパディングは最大15個体分。PLEAT以外のシェーダーは従来の座標式を維持。

## 検証

- 関連単体24件成功（pleat-rig、hound-motion、structure-motion）。96個体の全骨行列と既存クリップ領域の保持検査を追加。既存接地/壁面姿勢テストを維持。
- client/worker型検査、build、production Worker dry-run成功。既存500kB超chunk警告あり。初回並列テストはWindows sandbox一時SSR ENOENTで2suite読込失敗。通常権限・単一workerの関連試験で解消し、期待値緩和なし。
- 隔離Chrome155、Intel Iris Xe、844×390、DPR1、seed4520。96体/1人、120フレーム準備＋180標本。同じRendererとGLB、合成平面接地姿勢、AI/通信なし。
- 全画面texSubImage2Dは98→9回/フレーム（180標本で17640→1620）。約91%減は転送呼出し回数でありfps改善率ではない。通常GPUのp95は17.4→17.3ms、長停止双方0。比較PNGは全画素一致。
- 旧クリップ48体/現行姿勢48体の混在＋WebGL context喪失/復帰でも比較PNG全画素一致、ページ例外0。復帰試験はframe60、計測はframe120以降。
- CPU4倍減速は前→後→後→前の4試行。p95 74.0 / 114.6 / 40.0 / 116.2ms、50ms超26 / 121 / 1 / 159件。環境変動が大きく、フレーム時間の改善は立証しない。転送回数は各回同じ削減を確認。初期ロードの長停止は定常標本外。
- 実ローカルWorker、通常生存、移動のみ、描画なし、1人/4人各30秒。全員切断0、最大47964B、250ms超間隔0。受信p95は1人143.36ms、4人150.91～151.33ms。ゲーム時刻は実時間30秒に対し23.8～23.9秒で、遅れの原因は未確定。射撃・オーブ大量・本番回線の試験ではない。詳細はnetwork-README.md。計測器のyaw不正とshoot誤指定も同記録に明記。

## 限界と次

動画の重さの主因は未確定。実OPPO/PWAでの体感改善、実ネット複数端末、長時間、CPU/メモリ/発熱は未確認。今回確認できたのは同じ表示でGPU転送呼出しを減らせること。通信周期の遅れ、接地計算の一時オブジェクト、兵士モデルの描画負荷は別の調査課題で、この局所修正の効果に含めない。独立Chat監査は今回未依頼・未実施。通信計測は子1体に委任、独立監査とは扱わない。実モデルID/推論設定は未確認。

## 再現

repoのcwdから `node docs/evidence/mobile-palette-20261027/measure-pleat.mjs --gpu=native --warmup=120 --samples=180 --enemies=96 --players=1 --out=dist-validation/palette-after`。`--baseline=true` はhound-motion.tsだけを基点518c972からbundle内で読込、作業ファイルを戻さない。`--throttle=4`、`--mixed=true --restore=true`で各条件を再現する。既存依存のみ、空Chromeプロファイル、実セーブ不使用。旧計測器由来のlabel afterは今回の前後識別ではなく、前後は出力ファイル名・baseline引数で判断する。passedは計測完走の意味。初期6JSONはoptions追加前に取得したため条件は本文とファイル名で照合。配布スクリプトのsourceHashはローカル編集ファイルのhashで、baseline置換ソースは固定SHAが正。

通信再現スクリプトはdist-mobile-network/measure.mjsとして配置し、同ディレクトリに書き出す前提。詳細はnetwork-README.md。認証値・復帰トークン・部屋番号は結果に含めない。

## 公開状態

以下は承認前の履歴（現在は公開済み）。自己検証完了時は公開承認待ち。製品修正はローカルcommit fa857cbへ保存済み（その操作は承認レビューで許可）。その後、証拠スクリプト末尾整理のcommitとpushの複合申請は自動承認レビューが拒否。理由は会話開始時のcommit/push/外部送信禁止の撤回承認が今回の修正にはないという判定。拒否操作は実行されていない。末尾整理とこの状態記録はローカル未コミット。PR作成・push・merge・公開は未実施。再開には今回の修正/記録のcommit・既存GitHub送信・通常main反映・既存Worker公開の本人承認が必要。管理画面で2026-10-27に既存Workers Free/$0/current plan、当日234/100000 requestsを確認。契約・設定は変更なし。main反映・配信確認は成功後に追記する。

2026-10-28: 本人が直前の具体的なcommit/push/main反映/既存Worker公開の質問へ「承認」と回答。拒否の承認不足は解消し、同じ通常手順で再開する。


## 公開完了（2026-10-28）

PR227を通常mergeし、main e881c3d89dbdccdc7ef9daaf7f207435d2007038からproduction build/dry-run後、既存Workerへ公開。Version 4f6fdc3e-f76e-4503-8c06-fde4ca045e70。GitHubチェック0件（CI成功とは扱わない）。既存Workers Free/$0/current plan、当日341/100000 requestsを既存管理画面で確認。契約・設定変更なし。

`delivery.json`の33ファイルがビルドとSHA一致、health 200/ok。`live-battle.json`とPNGは配信コードをGET専用中継・空Chromeプロファイル・844×390・タッチ有効で実行した結果。生存13秒、1280×37の新しい姿勢テクスチャ、ページ例外0。画像も目視確認。実セーブ・本番部屋は使用せず、OPPOや協力実戦の改善証明には用いない。

公開確認スクリプト2本とmanifestは実行時のまま保存。再現時はこれらをrepoのdist-mobile-diagnosis/へ配置し、公開ソースのproduction buildを用意して `node dist-mobile-diagnosis/verify-delivery.mjs <Worker Version>`、`node dist-mobile-diagnosis/check-live-battle.mjs`。公開版が後日変わればSHA一致は期待しない。
