# 補給音源キャッシュ修正（2026-11-11、公開済み）

本人の開発者モードで旧音が鳴る症状を、実Chrome844×390・ローカルWorkerの正式認証・実Service Workerで再現。4b538ddのruntime/core/sfxをPRELOADへ保持し、実画面から選択10連をタップ完走。AudioBufferSourceNode.startを観測した。

修正前は旧ピアノ8音・速度も音階変化（old.json）。修正後は旧音0件・鍵音8件・全rate1・例外0・全localStorage不変（new.json）。固定URLのpublicモジュールimportが原因で、前回の新規/Service Worker無効試験では見落としていた。

通常/開発者共通のsupply-presentation.tsからViteでruntimeをbundleし、PCMとWorkerもハッシュ付き依存へ変更。保存やキャッシュの全削除はせず、音色/券/抽選/取得も変更なし。型/build/diff確認成功。scripts/check-supply-sound-cache.mjs（ローカル8796、既存Workerへテスト用hash）で再現。認証の初回はOrigin不足で停止し、正規ヘッダーで成功。認証/SW/音声のモックなし。

公開結果は後記する。実スマホ/耳での確認は未実施。本人端末を直接調査したとは主張しない。主担当gpt-6.1-sol（推論未確認）、委任なし。

## 公開結果

PR313通常merge、source `66aad08b3da249efc021e4d8a74d9baf5efb71d9`。mainから本番build/dry-run/deploy成功。既存大chunk警告は維持。既存Worker Version `73733ca9-4ed9-45f1-96ab-08ceb5e837aa`を100%配信。

新しいruntime-Cm089tVf.js/sfx-worker-YLEWSBTh.jsを含む本体38ファイルSHA一致、health200/ok。release/build-manifest.jsonとdelivery.json。GitHub status/workflow0件とmergeableを確認、保護迂回なし。公開後は記録のみで製品再公開不要。元root/別main作業を保持し、専用HEADをorigin/mainと一致・cleanへ同期する。

公開側の認証済みゲーム操作/実スマホは未実施。実際のSWと旧キャッシュを使った認証済み開発者10連の前後確認はローカル実Workerで行った。前回の新規ブラウザーでの確認を、既存キャッシュの検証済みと扱わない。
