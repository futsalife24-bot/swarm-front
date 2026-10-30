# 通信停止の復旧と計測表示の公開（2026-10-31）

[PR237](https://github.com/futsalife24-bot/swarm-front/pull/237)を通常merge。実装 `857914e42619e60e0773222e13e203e73b76528b`、公開ソースmain `c772d657b5379ab50aba8de45f4b7e230833a459`、既存Worker Version `060a4889-3195-406c-b200-1a5153834f72`。公開先は既存の https://swarm-front.melosalife-24.workers.dev/ 。

merge後HEADのVite build・production dry-runはexit0。配信35ファイルのSHAはbuild manifestと全件一致、health200/ok。[配信照合](release-delivery.json)。公開用manifest revisionは `d22a9ea789dbee5728ab26e6cd23a44d4a58b0537ef113fca97677a5c70034d4`。mainの保護=false、rulesets空、当該HEADのchecks/statusesは0件。CI合格とは扱わず、保護の変更・迂回なし。

無料契約は直前の本人回答で確認済み。当日UTC 00:00〜22:52にアカウント全Workers397 requests・errors0・subrequests430を読み取り確認。OAuth期限切れ401後に既存Wranglerの通常更新を行い、使用量再取得は200。契約subscriptionsは403のため、account-settingsのstandardをFreeの証明とはしない。今回DO個別使用量は未取得。新規サービス、費用、契約、権限、永続データ形式は変更しない。[取得結果](account.json)

公開コードをGET専用中継・空Chromeで起動し、縦向き案内、事前保存11パック、通常の生存出撃と60FPS表示、画面例外0を確認した。[結果](public-ui-results.json)、[画面](public-survival.png)、[検査手順](check-release-public.mjs)。この検査は本番部屋・本人セーブを使わない。最初の実行は遷移中の入力ガードで閉じる操作が無効になり失敗、次は遷移用shadow DOMの6複製を実ダイアログと誤認して失敗。製品の遷移終了を待ち、実ダイアログだけを検査する手順へ直して3回目に成功した。ゲーム側の入力ガードは変更していない。

OPPO実機の継続移動、実回線での命中、複数スマホ、長時間・発熱、実Safari音量は未確認。本人の「ダメです」は未解決の報告として残す。公開成功を快適化goal達成へ読み替えない。[原因の根拠と検査の限界](README.md)
