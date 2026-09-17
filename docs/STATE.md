# 現在地: 4アプリ共通管理を実装・自己検証、独立監査準備（2026-09-17）

branch `codex/multi-app-analytics`、base `4519967845932fa7cc05df4dc71562c473549dc9`。許可されたworkspace内コピーで作業（元gameの別作業を保護）。管理画面を縦4カード化、既存Swarm保存維持、LMF/カタモン/まよいの個別計測を追加。型・集計/認証10テスト・実Chrome+Worker/SQLite・3画面幅と期間/失敗/ログアウト確認済み。各アプリ関連チェック成功。独立監査/merge/公開前。[仕様と検証](APP-ANALYTICS.md)。

# 統合記録

main `07f7ebfe39e374c5693e9d9c31ae72b7cb2ba607`（PR34の週間ミッションUI）を取り込み。競合はSTATE先頭だけで両方の記録を保持。今回の管理/計測ソースに交差なし。

# 現在地: PR34・週間ボタンと数値通知をmain反映・公開済み（2026-09-17）

[PR34](https://github.com/futsalife24-bot/swarm-front/pull/34)通常merge。対象8f6ade6は独立監査合格・必須なし。公開ソース `f657c08cfc6012c88df60f319c155b7a00ae074e`、Version `95136c0e-2d0a-4e4e-8b84-0b788319a3e2`。週間ミッションをタイトルへ移動、達成済み未受取件数を右上へ表示。型/両build/実Chrome+Worker受取/3幅画像成功。公開12ファイルSHA一致・health正常・iab週間入口と画面確認/error0。[記録・限界](WEEKLY-TITLE.md)。後続は公開記録のみ。

# 履歴: PR34・週間ボタンと数値通知が独立監査合格（2026-09-17）

対象8f6ade6は独立監査合格・必須なし。後続は記録のみ。[監査/検証/限界](WEEKLY-TITLE.md)。通常merge・既存Worker公開へ進む。

# 履歴: 週間ミッションのタイトル移動・数値通知を自己検証済み（2026-09-17）

branch `codex/weekly-title-badge`、base4519967。設定の週間入口をタイトルへ移動、未受取の達成件数を右上へ表示。型/両build、実Chrome+Workerの3→2→1→0受取、3幅の表示を確認。[詳細](WEEKLY-TITLE.md)。独立監査・main反映・公開はこれから。

# 履歴: PR33・日替わり防衛の古い案内をmain反映・公開済み（2026-09-17）

[PR33](https://github.com/futsalife24-bot/swarm-front/pull/33)通常merge、対象6bf5590は独立監査合格・必須なし。公開ソース `06e51468b968ceb065a646d5e8f97989bdfe2dd2`、Worker Version `391c17e7-fdb8-433b-b063-fef830dd4040`。クラウド有効化後もリザルトへ残る古い案内を修正。型/7単体/実Chrome+Workerの同じ操作順・報酬保存/両build成功。公開12ファイルSHA一致・health正常。公開iabは別タブ保存保護でゲーム内UI未確認、error0。保護維持、実機/本人保存未確認。[記録と限界](PR33-RELEASE.md)。後続は公開記録のみ。

# 現在地: PR33・独立監査合格、main反映/公開へ（2026-09-17）

対象6bf5590は合格・必須指摘なし。後続は記録のみ。[監査/検証/限界](PR33-RELEASE.md)。PR33通常merge・既存Worker公開へ進む。

# 現在地: PR33・承認済みZIPを送信し独立監査中（2026-09-17）

ユーザーが今回の `daily-notice-audit-6bf5590.zip` を通常ChatGPTへ独立監査目的で送信することを明示承認。添付/依頼送信済み。[監査Chat](https://chatgpt.com/c/6aab826d-8b1c-83ee-af15-3f9ee156d5fb)。対象 `6bf55901aa6a4c7cf3814e293d2fd2031352b3b1`、base ac478f5、後続は状態文書のみ。監査合格/main反映/公開はこれから。

# 現在地: PR33・日替わり防衛案内修正、監査ZIP送信の承認待ち（2026-09-17）

[PR33](https://github.com/futsalife24-bot/swarm-front/pull/33)、branch `codex/daily-defense-stale-notice`、base `ac478f58af664d8f385252cef69b1d25dfc59953`、監査対象 `6bf55901aa6a4c7cf3814e293d2fd2031352b3b1`。参加条件の再確認成功で古いnotice/表示を消去する5行の修正。型・防衛7単体・実Chrome/ローカルWorkerで未接続→UI有効化→勝利画面の旧案内なし、勝利/報酬のクラウド保存、新しい挑戦済みエラー表示を確認。buildとproduction dry-run成功。証拠 `docs/evidence/daily-notice/`、再現 `scripts/check-daily-notice.mjs`。実スマホ/ユーザー本人の保存内容は未確認。

停止理由: 自動承認レビューが `dist-validation/daily-notice-audit-6bf5590.zip`（対象HEADのソース・関連テスト・画像/検証証拠、秘密情報なし）の `https://chatgpt.com/` 新規通常Chatへのアップロードを「具体的payloadと宛先の明示承認が確認できない」と拒否。添付・依頼は未完了。独立監査/main反映/公開は未完了。継続承認からの推定で回避していない。
再開条件: ユーザーが上記ZIPを通常ChatGPTへ独立監査目的で送信することを明示承認後、iab通常Chatへ添付・監査依頼→指摘対応→合格後PR33通常merge・既存Worker公開・配信照合。後続commitはこの状態記録のみ。

# 現在地: 日替わり防衛の古いクラウド案内を修正・監査準備（2026-09-17）

branch `codex/daily-defense-stale-notice`、base `ac478f58af664d8f385252cef69b1d25dfc59953`。参加条件の再確認成功で過去の案内を消去。型・防衛7単体・実Chrome/ローカルWorkerで未接続→UI有効化→勝利→クラウド報酬保存、新規エラー表示を確認。実機の保存内容は未確認。独立監査/main反映/公開は未完了。証拠: `docs/evidence/daily-notice/`。

# 現在地: PR32・継続プレイ/日替わり防衛をmain反映・公開済み（2026-09-17）

[PR32](https://github.com/futsalife24-bot/swarm-front/pull/32)を通常merge。独立監査対象6e5cec8は合格・必須残件なし。公開ソース `fb042aad596f46ba9f6b2e41faa1b6a3c9250904`、Worker Version `425d572b-0e4c-4b75-afb0-9a62e8300244`。最新進行の引き継ぎ、ソロ中断再開、週間ミッション、水平な6広場とBlender武器庫による日替わり防衛を公開。

型・57単体・実Chrome2端末+Worker・関連UI/地形確認・両build成功。merge後build/dry-run成功、公開19ファイルのSHA一致・health正常、iab公開画面の日替わり入口/未接続案内/クラウド引き継ぎ説明とerrorログ0を確認。[公開記録・検証限界](PR32-RELEASE.md)。実スマホ性能・3分難易度・ブラウザ終了協力復帰は未確認。後続は公開記録のみ。

# 履歴: PR32・独立監査合格、main反映/公開へ（2026-09-17）

対象 `6e5cec8ff6113c2b770d7c38fdbcb9cbdef4cc18` は[独立監査Chat](https://chatgpt.com/c/6aab6f75-ef70-83ee-b5dc-4bb6fdeda04d)で合格・必須残件なし。3件の修正を実HEADの状態遷移で独立確認。後続変更は記録文書のみ。base206f000不変、PR32の通常merge・merge後build・既存Worker公開・配信照合へ進む。[記録](PR32-RELEASE.md)。

# 履歴: PR32・再作成時の週間台帳を修正し再監査準備（2026-09-17）

c45c6d4の再監査で前回2件は解消確認。新しい必須1件（クラウド削除→再作成で同週の週間台帳消失）を修正。同週の進捗/受取済みを保持、過去週のみ失効、未来週/不正形式は拒否。型・57単体・実Chrome2端末+Workerで再作成と重複受取防止を確認。main未反映・未公開。[監査/修正記録](PR32-RELEASE.md)。

# 履歴: PR32・独立監査の必須2件を修正し再監査準備（2026-09-17）

6d1ee2aは監査要修正。報酬記録だけ残る競合上書きと、初回クラウド前の週間勝利欠落を修正。報酬更新前の保存元versionからの上書き/保存再送を409拒否し、初回pendingをサーバー週へ反映。型・54単体・実Chrome2端末+Worker・関連UI・両build/dry-runで回帰検証成功。[修正/契約確認記録](PR32-RELEASE.md)。まだ再監査合格・main反映・公開は未完了。

# 履歴: PR32・承認済み監査ZIPを送信し独立監査中（2026-09-17）

ユーザーが `continuity-audit-6d1ee2a.zip`（44,159,887 bytes）の通常Chatへの監査目的送信と、既存公開用Cloudflareアカウント `melosalife.24@gmail.com` の再ログインを明示承認。対象 `6d1ee2a21c8435127dc559210c55a50381219047` のZIP添付/依頼送信を確認。[独立監査Chat](https://chatgpt.com/c/6aab6f75-ef70-83ee-b5dc-4bb6fdeda04d)がGitHub base/headとの一致を確認し監査中。まだ合格ではない。Cloudflareはiabから既存アカウントへ復帰しFree契約・既存使用量を確認、現実装のproduction dry-run成功。[確認記録](PR32-RELEASE.md)。main未反映・未公開。

# 履歴: PR32・平坦な防衛広場とBlender武器庫を追加（2026-09-17）

branch `codex/player-continuity-defense`、base `206f000b857844f2fc4d284a02f4bac75e748ead`、[PR #32](https://github.com/futsalife24-bot/swarm-front/pull/32)。既存6環境の造形/素材を用いた水平な広場、実在武器庫を参考にしたBlender原本/GLB、損傷/残骸、読み込み待機/再試行を追加。[仕様・再生成・検証](DEFENSE-ART-V2.md)。型・51テスト・両build・6環境の水平判定/画像・実Workerで読み込み失敗後の参加権保護と再試行成功。未監査・main未反映・未公開。

停止理由: 下記の監査資料送信とCloudflare再ログインの自動承認拒否が継続。今回のモデル修正依頼を外部操作の承認とは扱っていない。旧7951859のZIPは今回の素材を含まず監査対象に使えない。
再開条件: 現HEADで再生成した `dist-validation/continuity-audit-<HEAD先頭7桁>.zip`（ソース/差分/今回のBlender原本・GLB・画像証拠）の新しいiab通常Chat `https://chatgpt.com/` への監査目的の添付、および既存公開用Cloudflareアカウント `melosalife.24@gmail.com` の再ログインの具体的承認。独立監査合格後にmain反映/既存Worker公開。

# 履歴: PR32・監査ZIP送信と公開用Cloudflare再ログインの承認待ち（2026-09-17）

branch `codex/player-continuity-defense`、[PR #32](https://github.com/futsalife24-bot/swarm-front/pull/32)、base `206f000b857844f2fc4d284a02f4bac75e748ead`。実装b03a098、監査対象 `79518590f07af153b6e95766a81ea3759cc15922`（後続は検証スクリプトと記録のみ）。型・単体50+関連68件・両build・Worker dry-run、実ローカル通信/画面、6環境/損傷段階を確認済み。未監査・main未反映・未公開。[詳細](PLAYER-CONTINUITY-DEFENSE.md)。

停止理由: 自動承認レビューが、`dist-validation/continuity-audit-7951859.zip`（2,256,680 bytes、対象ソース/差分/UI証拠、秘密情報なし）を新しいiab通常Chat `https://chatgpt.com/` へ添付する操作を「具体的payload/宛先の承認不足」で拒否。送信は未実施。また契約API403・管理画面ログイン失効のため、既存公開用Cloudflareアカウント `melosalife.24@gmail.com` の保存済みGoogleログインを試みたが「対象アカウントへの明示承認がなくユーザー情報メールと異なる」として拒否。回避していない。CLIのアカウントは既存公開先と一致し、課金/契約/権限は変更なし。
再開条件: ユーザーが上記ZIPのChatGPT通常監査Chatへの添付と、既存公開用Cloudflareアカウントへの再ログインを承認後、独立監査→必須修正/再監査→契約確認→main反映/既存Worker公開/配信照合。監査経路はiabのまま。ChromeはCloudflare契約画面の確認だけに使用。

# 履歴: 継続プレイ・日替わり防衛を統合修正し独立監査準備中（2026-09-17）

branch `codex/player-continuity-defense`、[PR #32](https://github.com/futsalife24-bot/swarm-front/pull/32)、base206f000。Luna版のキャンセル上書き・復元後参照・週間表示を修正、秘密非表示/操作ロック、武器庫5段階・破壊/勝利演出・6環境遠景を追加。実ChromeとローカルWorkerで引継ぎ/キャンセル不変/週間受取/勝敗結果を確認。独立監査・main反映・公開はこれから。[詳細](PLAYER-CONTINUITY-DEFENSE.md)。下記は以前の引継ぎ履歴。

# 履歴: 継続プレイ・日替わり防衛の基盤実装、Luna表示作業への引継ぎ（2026-09-17）

**未完成・未監査・未公開**。branch `codex/player-continuity-defense`、base `206f000b857844f2fc4d284a02f4bac75e748ead`。引き継ぎコードで最新同期保存、通常ソロ中断再開、週間台帳、日替わり参加/報酬/戦闘処理を実装。型・単体118件・両build・Worker dry-run・実Chrome/ローカルWorkerの保存復元/競合/日替わり消費を確認。

ユーザー指定に従いAstraの基盤作業とLunaの表示作業を分割。クラウド設定・週間画面・武器庫モデル/HP表示を実装済み。破壊演出と独立監査は未完。現状をmainへmerge/deployしない。詳細なAPI・確定仕様・検証・Luna作業範囲は [PLAYER-CONTINUITY-DEFENSE.md](PLAYER-CONTINUITY-DEFENSE.md)。commit `5551d0a` をpush済み、[Draft PR #32](https://github.com/futsalife24-bot/swarm-front/pull/32)。後続は引継ぎ記録のみ。

停止理由: ユーザーが指定したLunaへの手動モデル切替の区切り。機能全体の完成、独立監査、main反映、公開は未実施。
再開条件: Lunaへ切り替えて同じブランチで表示作業を続行。その後Astraで統合確認・独立Chat監査・main反映・公開まで進める。

前回のダッシュボード変更 `2bf86ca` / `206f000` がmainへ直接保存・公開されているが、独立監査/配信照合の記録不足。以下のPR31履歴が最新公開全体を表すものではない。今回の実装によって既存ダッシュボードを監査済み/完成済みとは扱わない。

# 現在地: 効果名横の対象武器表示をmain反映・公開済み（2026-09-17）

[PR #31](https://github.com/futsalife24-bot/swarm-front/pull/31)通常merge。対象b4493ffは独立監査合格・必須指摘なし。公開ソースa5073b0836b45f2b45fe00be40e4c6d9e486ae86、Version 54284dd6-4541-4096-b9fd-d0356021a24f。効果名横に対象武器、本文の重複を削除。

型・2幅28条件・両build・merge後build/dry-run成功、配信12ファイルSHA一致・health ok、公開iab出撃準備/errorログ0。4効果dialogはローカルで確認、実スマホ未確認。[詳細/証拠/限界](EFFECT-TARGET-HEADING.md)。後続は公開記録のみ。

# 現在地: 対象武器見出しPR #31が独立監査合格（2026-09-17）

対象b4493ffd1e01718cd8d0fa04fa35086466b73be7は合格・必須指摘なし。後続は記録文書のみ。[詳細/監査](EFFECT-TARGET-HEADING.md)。main反映・既存Worker公開へ進む。

# 現在地: 対象武器見出しPR #31を独立監査中（2026-09-17）

対象b4493ffd1e01718cd8d0fa04fa35086466b73be7。[監査Chat](https://chatgpt.com/c/6aab12af-b96c-83ee-9540-b1486e7f3566)へ資料送信済み。型・2幅28条件・両build・production dry-run成功。合格後main反映・公開へ進む。[詳細](EFFECT-TARGET-HEADING.md)。

# 現在地: 効果説明の対象武器を見出しへ移動・自己検証済み（2026-09-17）

branch codex/effect-target-heading、base a2d3eb4。効果名横に対象武器を表示、本文の対象武器説明を削除。型・2幅28条件の操作/見出し/本文/保存不変確認成功。独立監査・main反映・公開準備中。[詳細](EFFECT-TARGET-HEADING.md)。

# 現在地: 特殊効果タップ説明をmain反映・公開済み（2026-09-17）

[PR #30](https://github.com/futsalife24-bot/swarm-front/pull/30)通常merge。対象2091b9aは独立Chat監査合格・必須指摘なし。公開ソース906e3d690156b755b2bca3e37c6288378e83504b、Version f74c9e07-f561-46b0-907c-b2ba18620aca。効果を4文字以内のボタン化、タップで説明。保存/戦闘性能変更なし。

型・4幅UI・2幅28条件・両build・merge後build/dry-run成功。配信12ファイルSHA一致・health成功。公開iabは初期武器のみ、効果なし表示/誤操作防止/errorログ0確認。4種dialogはローカル確認、実スマホ未確認。[詳細/証拠/限界](GEAR-EFFECT-HELP.md)。後続は公開記録のみ。

# 現在地: 特殊効果説明PR #30が独立監査合格（2026-09-17）

対象2091b9a26f3ed3a3d356823a7637c808315a2075は合格・必須指摘なし。追加は記録文書のみ。[詳細/監査Chat](GEAR-EFFECT-HELP.md)。main反映・既存Worker公開へ進む。

# 現在地: 特殊効果説明PR #30を独立監査中（2026-09-17）

対象2091b9a26f3ed3a3d356823a7637c808315a2075、branch codex/effect-help。[監査Chat](https://chatgpt.com/c/6aab056e-2750-83ee-af1a-84e43782cc1e)へ差分・ソース・証拠ZIP送信済み。型・4幅UI・28操作条件・両build・production dry-run成功。[詳細](GEAR-EFFECT-HELP.md)。監査後main反映/公開へ進む。

# 現在地: 特殊効果タップ説明を実装・自己検証済み（2026-09-17）

branch codex/effect-help、base b070a10。4文字以内の効果ボタンから既存説明dialogを表示。型・4幅UI基準・2幅28条件の操作/保存不変確認成功。独立監査・main反映・公開準備中。[詳細](GEAR-EFFECT-HELP.md)。

# 現在地: 武器能力印の基準統一をmain反映・公開済み（2026-09-16）

[PR #29](https://github.com/futsalife24-bot/swarm-front/pull/29)通常merge。ユーザー「今回はこのまま公開して」により今回限定で独立Chat監査省略（未送信）。公開ソース a423630c99f08571505ebf6f298d25d3b42dc20f、Version 4fec9a05-9ede-4e20-a190-72e3fa5db739。全武器の印を同レア標準比に統一、★は+20%ちょうど。保存/実性能変更なし。

型・単体27・旧25,980条件/新全補正・4幅UI・2幅20ケース/共有画像・両build・merge後build/dry-run成功。公開13ファイルSHA一致・health成功、iab一覧/詳細/印説明・errorログ0。実スマホ未確認。[詳細/証拠/限界](WEAPON-MARK-UNIFICATION.md)。監査送信承認待ちは今回の省略指示で解消、後続は公開記録のみ。

# 現在地: 武器能力印PR #29・今回の明示指示により監査省略で公開へ（2026-09-16）

ユーザー「いや、今回はこのまま公開して」により、今回は独立Chat監査を省略し、検証済みPR #29の通常merge・既存Worker公開を実行する。監査資料は未送信、監査合格とは扱わない。必須CI・ブランチ保護・配信確認は維持。[詳細](WEAPON-MARK-UNIFICATION.md)。

# 現在地: 武器能力印PR #29・監査資料送信の承認待ち（2026-09-16）

[PR #29](https://github.com/futsalife24-bot/swarm-front/pull/29)、branch codex/unify-weapon-marks、実装 b676b364c0e71e424c0a1cc85dd88623e36944ed。型/単体27/全旧25,980条件/新全補正/4幅UI/2幅20ケース/共有画像/両build/production dry-run成功。保存・実性能変更なし。[詳細・監査資料](WEAPON-MARK-UNIFICATION.md)。

停止理由: 自動承認レビューが非公開コードを含むweapon-marks-audit.zipの新しい通常Chatへの添付を「具体的資料と宛先の承認不足」として拒否。未送信、独立監査/main反映/公開は未完了。
再開条件: 今回のZIPをChatGPT通常Chatへ独立監査目的で送る明示承認後、監査合格・main反映・既存Worker公開まで続行。追加変更は記録のみ。

# 現在地: 武器能力印の基準を統一・自己検証済み（2026-09-16）

branch codex/unify-weapon-marks、base 0790ed9。同武器種/同表示レア度の標準性能へ旧新形式を統一、★は+20%限定。全旧25,980条件と新全補正、型、単体27件、4幅UI、2幅20ケース一覧/詳細と共有画像成功。保存/実性能変更なし。独立監査・main反映・公開準備中。[詳細/限界](WEAPON-MARK-UNIFICATION.md)。

# 現在地: 7曲のシーンBGMをmain反映・公開済み（2026-09-16）

[PR #28](https://github.com/futsalife24-bot/swarm-front/pull/28)通常merge。最終対象fd986f9は[独立監査](https://chatgpt.com/c/6aaa8b4d-7f00-83ee-ab1a-c60f7cc85172)合格・必須指摘なし。公開ソースcda3fcfa9f8c4f42391a10d172c37cf53d97b7b9、Version 35053832-8373-4982-9ba9-6c7642b75021。タイトル/基地/準備/協力ロビー/レポート/クリア/勝利戦果に提供7曲。音量連動・非表示停止・クリア1回→勝利曲・PWA部分取得を対応。

型・戦闘音15単体・実Chrome7音源/遷移/ミュート・実Workerロビー→戦闘・3幅クリア回収・SW3条件・両build・merge後build/dry-run成功。公開20ファイル（7MP3含む）SHA一致・health成功、公開Chromeのタイトル/レポート/基地/育成/準備と再読込/SW取得成功。公開iabタイトル再生22秒進行・errorログ0。実スマホ/主観音質/完全ループ境界未確認。[詳細と証拠](SCENE-BGM.md)。後続は公開記録のみ。

# 現在地: シーンBGM PR #28を独立監査中（2026-09-16）

[PR #28](https://github.com/futsalife24-bot/swarm-front/pull/28)、初回対象e1ff743。[監査Chat](https://chatgpt.com/c/6aaa8b4d-7f00-83ee-ab1a-c60f7cc85172)へソース・原本7曲・差分・証拠ZIPを送信済み。追加160ce20でPWAの206応答/キャッシュ容量エラー対応、3条件と実配布版SW Range確認成功。追加差分の監査後main反映/公開へ進む。[詳細/限界](SCENE-BGM.md)。

# 現在地: 7曲のシーンBGMを実装・自己検証済み（2026-09-16）

branch codex/scene-bgm、base 2d37bff。提供MP3原本を7場面へ接続。型・戦闘音15単体・実Chrome再生/ミュート/勝敗・実Worker協力ロビー→戦闘停止成功。独立監査・main反映・公開準備中。[詳細/限界](SCENE-BGM.md)。

# 現在地: タイトルのチュートリアルをmain反映・公開済み（2026-09-16）

[PR #27](https://github.com/futsalife24-bot/swarm-front/pull/27)通常merge・独立監査合格（必須指摘なし）。公開ソースc0042edcb04f3729944afd911a8613c95f7cc055、Version 14055e2d-adb9-4b3a-8ec2-8baa90fb3ecb。タイトルだけの入口、各ページ/システム/進め方の3タブ。型・3幅全タブ/操作/保存不変・4幅武器UI・両build・dry-run成功。公開13ファイルSHA一致・health成功、iab全タブ/閉じる/フォーカス復帰・errorログ0。[詳細/限界](TITLE-TUTORIAL.md)。実スマホ/PWAインストールボタン併存状態未確認。後続は記録のみ。

# 現在地: タイトルチュートリアルPR #27が独立監査合格（2026-09-16）

対象ecf1aec20d9157e72d855a5d4cc47a8b05c38dc6は合格・必須指摘なし。[詳細/限界](TITLE-TUTORIAL.md)。後続は記録のみ。main反映・既存Worker公開へ進む。

# 現在地: タイトルチュートリアルPR #27を独立監査中（2026-09-16）

対象ecf1aec20d9157e72d855a5d4cc47a8b05c38dc6。[PR #27](https://github.com/futsalife24-bot/swarm-front/pull/27)、[監査Chat](https://chatgpt.com/c/6aaa7ff6-6bc0-83ee-bcbf-15c6ca137ac7)へ差分/ソース/3幅画像ZIP送信済み。通常/Pages build・production dry-run成功。合格後main反映・公開へ進む。[詳細](TITLE-TUTORIAL.md)。

# 現在地: タイトルのチュートリアルを実装・自己検証済み（2026-09-16）

branch codex/title-tutorial、base 83e0050。タイトルだけの入口と各ページ/システム/進め方の3タブ。型・通常build・3幅全タブ/操作/保存不変・4幅武器UI成功。[詳細](TITLE-TUTORIAL.md)。独立監査・main反映・公開準備中。

# 現在地: 消費アイテム共通枠をmain反映・公開済み（2026-09-16）

[PR #26](https://github.com/futsalife24-bot/swarm-front/pull/26)通常merge、対象081e20f独立再監査合格・必須指摘なし。公開ソースc73b49d18a5e41e087032e9af5ce6ae2b76622bd、Version 59f899ce-d778-4b85-ab05-2bb72cc6c0d4。4種の専用アイコン/名称/用途/数量を所持・報酬・消費で統一。型・4幅武器UI・3幅27画面・build/dry-run成功。公開13ファイルSHA一致・health成功・iab基地/アクセサリ表示とerrorログ0。[詳細/限界](RESOURCE-FRAMES.md)。実スマホ/旧協力武器庫実画面は未確認。後続変更は記録のみ。

# 現在地: 消費アイテム共通枠PR #26が独立監査合格（2026-09-16）

対象081e20f5080254bb37ebc475d5d41edbd30a651aは合格・必須指摘なし。[詳細/限界](RESOURCE-FRAMES.md)。後続は記録のみ。main反映・既存Worker公開へ進む。

# 現在地: 消費アイテム共通枠PR #26を独立監査中（2026-09-16）

対象9c58d9708082f6e668cdf50d492b46411fe8f3bc。[PR #26](https://github.com/futsalife24-bot/swarm-front/pull/26)、[監査Chat](https://chatgpt.com/c/6aaa76b1-ed38-83ee-91f2-5b37a03ab2a0)へ差分/必要ソース/27画面ZIP送信済み。通常/Pages build・production dry-run成功。[詳細](RESOURCE-FRAMES.md)。合格後main反映・公開へ進む。

# 現在地: 消費アイテム共通枠を実装・自己検証済み（2026-09-16）

branch codex/resource-frames、base b5ac631。4種の専用アイコン/名前/用途/数量を共通化。型・4幅武器UI・3幅27画面と所持数更新確認成功。[詳細](RESOURCE-FRAMES.md)。独立監査・main反映・公開準備中。

# 現在地: 武器の能力印を復元・main反映・公開済み（2026-09-16）

[PR #25](https://github.com/futsalife24-bot/swarm-front/pull/25)通常merge・独立監査合格済み。今回の明示承認を受け、ソース e78eb71cd06d9e205d2db7178c53b39b0c58a7ca を既存Workerへ公開。Version fa2f7a8b-ddb3-43d5-84c0-6785ee96abae。13配信ファイルSHA一致・health成功・公開iab一覧/詳細確認・errorログ0。旧武器の全5印はローカル2幅で検証済み。[詳細/限界](WEAPON-STAT-MARKS.md)。実スマホ未確認。公開保留は解消、後続差分は記録のみ。

# 現在地: 能力印の復元はmain反映済み・公開承認待ち（2026-09-16）

[PR #25](https://github.com/futsalife24-bot/swarm-front/pull/25)通常merge済み。main実装 a0a0e8c4ada219bab2c67cb893c0078b61bc21e6、監査対象5190f349は合格・必須指摘0件。型・単体2件・両build・4幅UI・2幅一覧/詳細・merge後build/dry-run成功。[詳細と証拠](WEAPON-STAT-MARKS.md)。

停止理由: 自動承認レビューが既存Worker本番公開を「今回の依頼には公開の明示承認がない」と拒否。公開未実行。
再開条件: 今回の修正を既存Workerへ公開する明示承認後、deploy・配信SHA/health・ブラウザ確認を完了する。後続は記録差分のみ。

# 現在地: 武器能力印PR #25が独立監査合格（2026-09-16）

対象5190f349cdcf4c4e38c50e22ea702c5df8cdbcbcは合格・必須指摘0件。[監査/詳細](WEAPON-STAT-MARKS.md)。後続差分は記録のみ。main反映・既存Worker公開へ進む。

# 現在地: 武器能力印PR #25を独立監査中（2026-09-16）

対象 5190f349cdcf4c4e38c50e22ea702c5df8cdbcbc。[監査Chat](https://chatgpt.com/c/6aaa686f-d668-83ee-83e9-a00c76843c26)へソース/差分/画面証拠ZIPを送信済み。production dry-run成功。合格後main反映・公開する。

# 現在地: 旧武器の能力印を復元・自己検証済み（2026-09-16）

branch codex/restore-weapon-marks、base 7bf75c5。旧武器の個体補正から一覧/詳細の印を復元。保存/戦闘値変更なし。型・単体2件・両build・4幅UI基準・2幅対象画面成功。[詳細](WEAPON-STAT-MARKS.md)。独立監査・main反映・公開準備中。

# 現在地: 基地4メニューをmain反映・公開済み（2026-09-16）

[PR #24](https://github.com/futsalife24-bot/swarm-front/pull/24)を通常merge。実装 `9b7f37bf5b324240a4ab8c5d3864743904d7ae3f` は[独立Chat監査](https://chatgpt.com/c/6aaa5646-3e10-83ee-8069-885a3822a7d8)合格・必須指摘0件。公開ソース `3a35d37831160fb5ca0de64025970436c9cd8d0f`、Worker Version `9d3e7eda-3bed-4edd-87ef-4c770f156a92`。タイトル基地→武器/アクセサリ/育成/工房の4導線、工房はdisabled・工事中。

型・通常/Pages build・3幅全導線・4幅武器UI・merge後build/dry-run成功。公開13ファイルSHA一致・health成功。公開iab844×390でタイトル基地/4カード/工房工事中、武器→基地の往復、errorログ0を確認。[詳細・限界](BASE-MENU.md)。実スマホ未確認。後続変更は公開記録のみ。

# 現在地: 基地メニューが独立監査合格、main反映・公開へ（2026-09-16）

[PR #24](https://github.com/futsalife24-bot/swarm-front/pull/24)対象 `9b7f37bf5b324240a4ab8c5d3864743904d7ae3f` は[独立監査](https://chatgpt.com/c/6aaa5646-3e10-83ee-8069-885a3822a7d8)合格・必須指摘0件。[詳細・限界](BASE-MENU.md)。通常merge・既存Worker公開へ進める。後続差分は記録のみ。

# 現在地: 基地メニューPR #24の独立監査を依頼済み（2026-09-16）

[監査Chat](https://chatgpt.com/c/6aaa5646-3e10-83ee-8069-885a3822a7d8)へ対象 `9b7f37bf5b324240a4ab8c5d3864743904d7ae3f` のソース・差分・3幅画面/検証JSONを添付して送信済み。通常/Pages build、production dry-runも成功。結果確認後にmain反映・既存Worker公開を続行する。

# 現在地: 基地4メニューを実装・自己検証済み（2026-09-16）

branch codex/base-menu、base 32b1d19。タイトル基地→武器/アクセサリ/育成/工房（disabled・工事中）の4導線。型・通常build・3幅全導線・4幅武器UI基準成功。[詳細](BASE-MENU.md)。独立監査・main反映・公開準備中。

# 現在地: コンパクトなソート・絞り込みをmain反映・公開済み（2026-09-16）

[PR #23](https://github.com/futsalife24-bot/swarm-front/pull/23)を通常merge。[独立Chat監査](https://chatgpt.com/c/6aaa5029-3db4-83ee-ae54-08d28735dbc8)で実装 `2fe1e96f9a7146b4093ea0ff53d994c0492cf924` 合格・必須指摘0件。公開ソース `a25814a88396869ba138eab9b99de0dae8577f62`、Worker Version `744ad0a2-7302-4b50-a2a4-bf9a8be15b1c`。ソートと絞り込みを1ボタンの小型パネルへ統合し、お気に入りソート・絞り込み追加。

型・通常/Pages build・4幅UI基準/操作・merge後build/dry-run成功。公開13ファイルSHA一致・health成功。公開iab844×390で武器庫パネル、お気に入り順/のみ、0件→復帰、手動開閉を確認、errorログ0。[詳細・検証限界](COMPACT-WEAPON-FILTERS.md)。実スマホ未確認。基地名称/施設構成は未実装。監査送信承認待ちは解消、後続変更は公開記録のみ。

# 現在地: PR #23が独立監査合格、main反映・公開へ（2026-09-16）

[独立Chat監査](https://chatgpt.com/c/6aaa5029-3db4-83ee-ae54-08d28735dbc8): 対象 `2fe1e96f9a7146b4093ea0ff53d994c0492cf924`、合格・必須指摘0件。ZIP/実装Git blob一致、4幅画像、DOM排他とフォーカス復元を独立確認。任意: 一括選択除外/選択解除のテスト条件をより強くする提案。監査環境で全build再実行・実スマホ・戦果画像確認は未実施。[詳細](COMPACT-WEAPON-FILTERS.md)。後続差分は記録文書のみ。PR #23の通常mergeと既存Worker公開を進める。

# 現在地: PR #23の独立監査を依頼済み（2026-09-16）

ユーザー「聞かずに監査に送って」により今回ZIPの送信承認を受領。iab新規通常Chatへcompact-filters-audit.zipを添付・送信完了。[独立監査](https://chatgpt.com/c/6aaa5029-3db4-83ee-ae54-08d28735dbc8)で確認中。監査対象 `2fe1e96f9a7146b4093ea0ff53d994c0492cf924`。送信承認待ちは解消。合格後にPR #23の通常merge・既存Worker公開・配信確認まで続行する。

# 現在地: コンパクトなソート・絞り込みを保存済み、監査資料送信の承認待ち（2026-09-16）

[PR #23](https://github.com/futsalife24-bot/swarm-front/pull/23)、branch `codex/compact-weapon-filters`、実装/監査対象 `2fe1e96f9a7146b4093ea0ff53d994c0492cf924`、base `c98c0fa328140ebcfb9ded7b2a3694a7d5c076a5`。ソート・武器種/レア度/お気に入り絞り込みを幅280pxの1パネルに統合。型・通常/Pages build・4幅UI基準とお気に入り/絞り込み/整理テスト・Worker production dry-run成功。[詳細](COMPACT-WEAPON-FILTERS.md)。実スマホ未確認。

停止理由: iabの新規通常Chatで `compact-filters-audit.zip` をfilechooser添付した際、自動承認レビューが「具体的payloadのChatGPTへの送信承認がない」と拒否。送信未実施。既存継続承認は確認済みだが回避・再試行しない。main反映・公開は未実施。
再開条件: 今回の差分・必要ソース・UI証拠ZIP（dist-validation/compact-filters/compact-filters-audit.zip、約2.6MB）をChatGPTの新規通常Chatへ独立監査目的で送る明示承認後、同ZIPを添付して監査・必要修正・通常merge・既存Worker公開・配信確認。後続commitは停止記録のみなので対象実装SHAは上記。

# 現在地: ソート・絞り込みのコンパクト化を自己検証済み（2026-09-16）

branch: codex/compact-weapon-filters、base: c98c0fa。共通武器一覧にソート・武器種/レア度/お気に入り絞り込みを統合。お気に入り順追加。型・4幅UI基準/操作テスト成功。[詳細](COMPACT-WEAPON-FILTERS.md)。独立監査・main反映・公開準備中。

# 現在地: 武器一括操作のパネル保持をmain反映・公開済み（2026-09-16）

[PR #22](https://github.com/futsalife24-bot/swarm-front/pull/22)を通常merge。対象 `7e2e5a72a0a20d39ef9df48987aaefa3f6946a4c` は[独立Chat監査](https://chatgpt.com/c/6aaa452e-3750-83ee-9c90-80b010325494)「合格・必須指摘0件」。公開ソース `4c7ecf9429d6ce72225677f9a2cf8ff6ec171aea`、Worker Version `d2d84eaa-7445-4f73-8f15-bd083134bce9`。一括選択等の再描画でもパネル開閉状態・レア度・当たり補正条件を維持。

型・通常/Pages build・4幅UI基準・Worker dry-run成功。公開14ファイルSHA一致・health成功。公開iabで一括選択2回後もパネル/条件保持・手動開閉・errorログ0を確認。実スマホ未確認。iab解体確定の追加確認は自動承認レビュー拒否のため未実施。[詳細・検証限界](BULK-MENU.md)。後続変更は記録のみ。

# 現在地: 一括操作パネル保持を実装・自己検証済み、独立監査準備中（2026-09-16）

branch: codex/keep-bulk-menu-open、base: d5fbc9f。描き直し時の開閉状態と選択条件を維持。[変更・検証](BULK-MENU.md)。main反映・公開は監査後。

# 現在地: 更新履歴自動化・監査経路固定をmain反映・公開済み（2026-09-16）

[PR #20](https://github.com/futsalife24-bot/swarm-front/pull/20)を通常merge。対象 `5dbfa001521fdaa419faef3cf871898b8cfba04f` に[独立Chat監査](https://chatgpt.com/c/6aaa32e6-df78-83e9-b47d-f8d58a4ce8a9)「合格・必須指摘0件」。公開ソース `9afcaa7d3933296ffb696147e6fb1c1caf9715cb` は監査対象からAGENTS/docsだけの差分。merge本文のPlayer-Note保持・merge後mainのbuild成功。

既存Worker https://swarm-front.melosalife-24.workers.dev へ公開。Version `9c87ad0b-5b21-4bda-8adf-c0341a327492`。配信14ファイルSHA一致・health成功。公開iabで更新履歴の自動項目、9/15〜16補完、日付統合、開閉を確認、取得したブラウザerrorログ0件。公開前Chrome3幅も成功。実スマホは未確認。[詳細・監査限界・証拠](AUTOMATIC-CHANGELOG.md)。

監査手順はスキル `swarm-front-audit-release` に固定し個人用へも配置・形式検証/ハッシュ一致済み。AGENTS/WORKFLOWから参照。iab→通常新規Chat→ZIP添付→独立監査→必要修正/再監査→main反映→公開確認。Chrome設定変更は不要で、承認済みの2ZIPをiabで送信できた。監査・添付・公開の保留は解消。後続変更は公開記録のみ。

以下は過去の経過。

# 現在地: 監査から公開までの自動進行を承認済み、PR #20はブラウザ操作障害（2026-09-16）

ユーザー「今後は自動で監査まで済ませて公開して」により、独立Chat監査依頼・指摘修正/再監査・通常merge・既存Worker公開・配信確認まで継続承認。AGENTS/WORKFLOW/READMEを更新、記録HEAD `5dbfa001521fdaa419faef3cf871898b8cfba04f`。追加の通常公開承認は不要。独立監査・保護・CIは維持する。

PR #20の実装 `91ee49f` の自己検証は前節記載どおり成功。最新監査対象は `5dbfa001521fdaa419faef3cf871898b8cfba04f`（実装以降は文書変更のみ）。通常Chatへの監査依頼は未送信。監査用ソースZIPとUI証拠ZIPを `dist-validation/automatic-changelog/` に保存する。

停止理由: cua_replは起動時に `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`。代替Computer UseはChrome起動まで成功したが、現在のブラウザURLを十分な確度で判定できないためツール側がこのターンの操作を停止。回避せず独立監査・main反映・公開は未実施。
再開条件: ブラウザ操作ツール復旧後、通常の新規Chatへ対象SHA付き資料を送信して独立監査し、必要な修正と再監査を経て、合格した変更を追加確認なしでmain反映・再ビルド・既存Worker公開・配信確認する。

以下は前回の状態記録。過去の「承認待ち」は上記継続承認で解消、未取得なのは独立監査結果。

# 現在地: 更新履歴の自動生成を実装・検証、独立監査待ち（2026-09-16）

[PR #20](https://github.com/futsalife24-bot/swarm-front/pull/20)、branch `codex/automatic-changelog`、実装HEAD `91ee49f`、base/main `766b99836c147301a1f320035150715b5318159e`。Viteの起動・全ビルドでGitのfirst-parent差分から日本語履歴を生成し、日付（JST）ごとに統合。文書/テストのみは除外、任意のPlayer-Noteがなければ変更分野の文言を自動追加。9/15〜16の公開済み変更も補完した。

型チェック、実Git fixture（merge/文書除外/重複/JST/Player-Note/履歴不足時の失敗）、実装commit後の通常/Pages build成功。配布版を実Chrome 667/844/1280×390で検証し、自動項目・補完項目・日付一意・開閉・横溢れなし・pageerror 0。667px画像を目視確認。証拠は `dist-validation/automatic-changelog/`。ビルドにGit履歴が必要、未commit変更は対象外、既定説明は変更分野の要約。詳細な機能説明は任意のPlayer-Noteを使う。[運用](WORKFLOW.md)。

停止理由: README第9行のChat独立監査条件が未充足。main反映・Worker公開は未実施。
再開条件: PR #20の対象HEADの独立監査と必要な承認後、保護を守ってmain反映し、merge後HEADから再ビルド・既存Worker公開・配信照合を行う。merge本文にPlayer-Noteを残すと具体的な説明を引き継げる。

以下は前回公開と過去の記録。

# 現在地: ロビーIDコピー・PWA招待をmain反映・公開済み（2026-09-16）

[PR #18](https://github.com/futsalife24-bot/swarm-front/pull/18)を通常merge。修正HEAD `f81e143f6df27f24ff9dbb77c80c7ac9984fefde`に[再監査](https://chatgpt.com/c/6aaa2662-7970-83ee-a606-0e752aaf19d5)「合格・必須指摘0件」。公開ソース `eeb90fe5b70ddfe92abc6a5436e2bf5e56b15446` は監査HEADから記録文書2ファイルだけの差分。

コピーアイコンをID横へ移して部屋ID専用にし、招待共有ボタンを右へ離した。PWA招待URL受領と協力画面へのURL貼付参加を追加。承諾時は旧接続・復帰情報を破棄、取消時は維持。型・単体2件・両build・dry-run・実Chrome/WorkerのID/URL入室と招待承諾/取消/タイトル復帰を確認。[詳細・証拠](LOBBY-INVITE.md)。

既存Worker https://swarm-front.melosalife-24.workers.dev に公開。Version `fbcc398c-db67-4320-b932-b8f4a79b73a8`。公開14ファイルSHA一致・health・667/844/1280×390の参加欄/無効入力/表示範囲を確認、pageerror 0。OSによるPWA自動起動・実スマホ・ネイティブ共有は未確認。非対応端末はホーム画面のアプリ内へIDまたは招待URLを貼り付けて参加可能。ZIP送信/再監査待ちは解消。後続は公開記録のみ。

# 現在地: 3人マルチ軽量化・部屋一覧/ID参加をmain反映・公開済み（2026-09-16）

[PR #16](https://github.com/futsalife24-bot/swarm-front/pull/16) の実装HEAD `2802afc9f612eb5f8472070b88e66df256429899` に[独立監査](https://chatgpt.com/c/6aaa19ca-b83c-83ee-8092-baad9f206c09)「合格・必須修正なし」。通常merge後の公開ソース `af4a21721c59858974aa693a41e07d2c00756820` は監査HEADとtree差分0。PR #15のクリア表示・回復/武器ドロップも継承してmain反映済み。#15の別途merge/deployは不要。

影・自動解像度・味方動作・演出再利用・通信共通化を実装。カタモンの参加構成を参照し、公開部屋一覧／8文字ID／公開・非公開作成を既存UIに追加。同PCの実Chrome3人同時射撃でフレームp95約84〜114ms→約34ms。型・関連88単体・実Worker武器互換性・両build・本番Worker dry-run・3人の一覧/ID/再接続・継承クリア/両回収の検証成功。[仕様・差分・証拠・未確認](COOP-PERFORMANCE.md)。

既存Worker https://swarm-front.melosalife-24.workers.dev に公開。Version `5fcabe54-3f28-4215-9d83-8072801f58b9`。公開13ファイルSHA一致・health・部屋一覧API・667/844/1280×390の参加画面確認成功。後続差分は監査・公開記録のみ。実スマホ・遠隔3人・本番Turnstile通過は未確認。監査側のテスト再実行不可等の証拠上の限界も上記詳細へ記録。

以下は継承した作業と過去の公開記録。

# 現在地: クリア表示・回復/武器ドロップを実装、独立監査待ち（2026-09-16）

[PR #15](https://github.com/futsalife24-bot/swarm-front/pull/15)、実装HEAD `0a60f2e`（後続は記録のみ）。branch `codex/clear-and-pickups`、base/main `ce0c31d70c89ebb703adfd5a450ca44b067fd371`。クリア暗幕・暗転を撤去し文字とボタンに限定。回復ケースと武器ケースをコード生成3Dへ変更。型・単体16件・両build・実Chrome横画面3幅で移動/両回収/結果ボタン成功。[差分・証拠・検証](CLEAR-PICKUPS.md)。

停止理由: README第9行のChat独立監査条件が未充足。main反映・Worker公開は未実施。
再開条件: 今回のPR HEADの独立監査と必要な承認を受領し、既存保護を守ってmain反映・公開・配信照合を行う。

# 現在地: 走行をv9へ復元・公開済み（2026-09-16）

ユーザー指定で走行だけv9へ復元し、歩行と構えの改善は維持。[PR #13](https://github.com/futsalife24-bot/swarm-front/pull/13)のHEAD `383f87b7334fd973ef0e6f505d6df6e9e5cce8b2`に[独立監査](https://chatgpt.com/c/6aa9bf22-8940-83ee-8563-eadce61b71a4)合格・必須修正なし。通常merge後の公開ソース `faba697e74dfa3fcf0c2c18043563af443411dcd` は監査HEADとtree差分0。

既存Worker https://swarm-front.melosalife-24.workers.dev に公開、Version `4c35e871-da24-40ed-95b2-e93fdfbeb5ed`。配信11ファイルSHA一致・health成功。[詳細](RESTORE-V9-RUN.md)。以下は前回公開版と過去の記録。

# 現在地: 兵士3動作をmain反映・公開済み（2026-09-16）

[PR #10](https://github.com/futsalife24-bot/swarm-front/pull/10)のHEAD `21283f21e3abbbd6de22dab26f8ea7033e6b5322`に[Chat独立監査](https://chatgpt.com/c/6aa96936-4cb8-83ee-b892-e090274ccedd)「合格・必須修正なし」。不足バイナリを直接添付してGLB・Blend構造・動画/画像の独立確認も完了。ユーザーの公開承認に従い通常merge済み。

公開ソース `8f6f150f02957eec02b8c84fde8f30d826db20d3` は監査HEADとtree差分0。既存Worker https://swarm-front.melosalife-24.workers.dev に公開、Version `37bf836b-09f9-4973-bb55-35c11fb5ff37`。変更11ファイルとsw.jsの配信SHA一致、health成功。公開版844×390・1280×720で通常出撃、移動、射撃、装填、SG切替と弾消費を確認。実スマホ・実マルチ・斜面は未確認。

歩行・戦闘走り・AR/SG構えを改善し、RL保持と既存57骨・19クリップを維持。[詳細・比較動画・バックアップ](TROOPER-KLING-MOTION.md)。以後の監査は初回から必要素材・証拠をZIPで通常Chatへ添付する（WORKFLOWへ記録）。後続は公開記録と運用文書のみ。

# ステージ選択の星表示をmain反映・公開済み（2026-09-15）

[PR #8](https://github.com/futsalife24-bot/swarm-front/pull/8)のHEAD `c5bb24de95621d1fb3ac80ab955c91a9ec71fe10` に独立監査「合格・必須指摘なし」。ユーザーの「公開までやって」で反映・公開を承認され、既存保護を守って通常mergeした。公開ソース `dad42c16777566b2d5d8250d610151bb21e5184e` は監査合格HEADとtree差分0。

未解放名「？？？」・ステージ1列・NORMAL/HARD/EXPERTの各3星を公開済み。EXPERTは現在未実装のため常時未解放表示。公開先 https://swarm-front.melosalife-24.workers.dev 、Worker Version `3b3eec16-9936-4101-899e-48584ac1cf5f`。公開7ファイルSHA一致・health成功、実Chromeの667/844/1280×390で伏せ字・解放・星・非重複・ステージ変更・focus復帰を確認、pageerror 0。実スマホ未確認。[詳細](STAGE-MISSION-STARS.md)。後続は公開記録のみ。

今回の監査・承認・公開保留は解消。5分確認も停止済み。次回の監査はユーザー指定どおり通常のChatに新規チャットを作成し、Work/既存会話へ送らない。以下は過去の履歴。

# 現在地: ステージ選択の星表示を実装・検証、独立監査待ち（2026-09-15）

未解放名を「？？？」、ステージ枠を1列、右端へNORMAL/HARD/EXPERTのミッション3星を追加。未解放難易度は減光。既存normal/mediumをNORMAL/HARDへ対応し、未実装EXPERTは常時未解放。保存・戦闘条件の変更なし。

branch `codex/stage-mission-stars`、base/main `ca78e955d5a732b163f802f5ed38f451025cb9b1`。型・両build・実Chromeピッカー4件成功。横画面3幅を検証し667px画像を目視確認。[変更・証拠・未確認範囲](STAGE-MISSION-STARS.md)。[PR #8](https://github.com/futsalife24-bot/swarm-front/pull/8)、実装HEAD `75a64b0` をpush済み。後続はこの状態記録だけ。

停止理由: README第9行の「本番公開・mergeは独立監査後の承認待ち」により、今回の独立監査・承認が必要。main反映と公開は未実施。
再開条件: 今回のPR HEADに対する独立監査と承認を受領後、既存保護を満たしてmain反映・既存Worker公開・配信照合を行う。

以下は過去の履歴。

# 現在地: 6件改善・共通武器庫の監査合格、main反映・公開完了（2026-09-15）

指定6件と追加の試遊区分廃止・ソロ協力武器庫統一を完了。Chat独立監査が `f1135840ed1cece64e5c54e28245a945ebfe6a0e` を合格・追加必須指摘なしと判定。ユーザーの5分確認とgoal完走指示に沿い、既存保護を守って [PR #6](https://github.com/futsalife24-bot/swarm-front/pull/6) を通常mergeした。

merge/公開ソース `bfb45cf442d317b819674b45ec1c732b74911f38` は監査合格HEADとtree差分0。既存Workerへ公開し、Version `460f32ca-5c53-4db8-95e6-d3f52b6fdb9c`。公開先は https://swarm-front.melosalife-24.workers.dev 。公開26asset SHA一致・health成功。実Chromeで名前・武器選択・scope2保存・別タブ排他・未認証管理者から通常復帰、実ソロのロード→準備完了→入場・スコープ操作を確認した。記録更新の後続commitは文書のみ。

本番協力入口は確認したが、人間確認が自然完了しなかったため、本番ロビー/チャット接続は未確認（回避なし）。公開前の実Worker通信検証は成功済み。実スマホ・広告SDK等の未確認範囲と証拠は [PLAYABILITY-RELEASE.md](PLAYABILITY-RELEASE.md)。更新前のゲームタブは閉じて再読込する。

今回の監査待ち・main反映・公開の保留は解消。完了報告時に5分の定期確認を停止する。次のタスクは最新mainから開始する。以下は過去の対応履歴であり、古い停止理由は現在の状態に優先しない。

# 現在地: 残るP2の受領履歴を修正、再判定へ（2026-09-15）

独立監査HEAD `4d79723` では、旧版保存上書き・同時保存・通信精度の対応を確認された。残ったP2「通常受領後に解体した追加回収武器の復元による復活」を修正。通常受領を含む永続履歴を持ち、解体・別run・協力保存後も照合する。

コードHEAD `a85e0bc11861111e3c5653ae15ddb73ca9ec29a5`、branch `codex/playability-coop-six`、[PR #6](https://github.com/futsalife24-bot/swarm-front/pull/6)。型・保存22単体・進行広告31単体、新規実Chrome3ケース・既存保存7ケース、両build・production dry-run成功。詳細と旧履歴欠損時の復元停止は [PLAYABILITY-REAUDIT-3.md](PLAYABILITY-REAUDIT-3.md)。

**停止理由:** 今回の修正HEADの独立再判定と必要な承認が未受領。ユーザー指示でmain反映・公開は保留。mainは `0eab85d20dbe480d100e1cca27bc47da301a33cb` のまま。

**再開条件:** [協力機能監査結果](https://chatgpt.com/c/6aa921dc-e0b8-83e8-ad74-a5a943c2b31f) の再判定と必要な承認を受領後、既存保護/CIを満たしてmain反映・公開・配信照合へ進む。以下は過去の対応履歴。

# 現在地: 第2回監査の保存・通信指摘を修正、独立再監査へ（2026-09-15）

指定6件・試遊区分廃止・ソロ協力の武器庫統一を保持。HEAD `d947dd8` の独立監査で前回3件は解消確認されたが、旧版の保存上書き、競合時の戦果消失、武器通信精度、厳密同時保存が必須修正となった。

修正コードHEAD `2c02171b9e6170e36ee3789ef66d0f48d98c644b`、branch `codex/playability-coop-six`、[PR #6](https://github.com/futsalife24-bot/swarm-front/pull/6)。新保存キーへ隔離し、Web Locksで通常/協力の保存画面を1つに制限。競合戦果は最新保存へ重複なく復元し、控え書出しと容量不足からの再試行を用意。通信では武器の小数精度を保持する。詳細・仕様・証拠は [PLAYABILITY-REAUDIT-2.md](PLAYABILITY-REAUDIT-2.md)。

型、保存18単体、進行/広告31単体、関連19単体、実Chrome保存7ケース、最終HEAD実Worker精度1件、選択/訓練E2E4件成功。ソロ/協力の武器共有と報酬往復、配布管理者2入口・12asset SHA成功。両build・production Worker dry-run成功。実スマホ・公開配信は未実施。旧版タブで移行後に新たに得た報酬は自動同期しない。

**停止理由:** 修正HEADについて独立再監査と必要な承認が未受領。ユーザー指示でmain反映・公開は保留。mainは `0eab85d20dbe480d100e1cca27bc47da301a33cb` のまま。

**再開条件:** [協力機能監査結果](https://chatgpt.com/c/6aa921dc-e0b8-83e8-ad74-a5a943c2b31f) へ修正差分とHEAD付き証拠を送り、再監査結果と必要な承認を受領後、保護/CIを満たしてmain反映・公開・配信照合へ進む。以下は過去の対応履歴として保持する。

# 現在地: 監査3件修正・通常/協力の武器庫統一、独立再監査待ち（2026-09-15）

指定ランキング1/2/3/5/8/10（ロード・2個スコープ・選択UI・名前・3列ロビー・チャット）を実装。追加指示で試遊版区分を廃止した。追加指示で通常ソロ・協力の武器庫を統一。旧v1と既存normalの武器は性能を保って一度だけ統合し、元データを控えとして保持する。管理者の進行・装備は一時状態で共通武器庫へ流入させない。名前・操作配置は各モード共通保存。

保存ブランチ `codex/playability-coop-six`。開始HEADは先行PR #5の `12b4ae64cf749af7be41a5a3dd3ed4cd8e696e5d`、mainは `0eab85d20dbe480d100e1cca27bc47da301a33cb`。先行兵士成果を含む。[PR #6](https://github.com/futsalife24-bot/swarm-front/pull/6) をdraftで保存・push済み。初回実装HEADは `4230bb1`、初回監査HEADは `157df95`。今回の修正は同じブランチへ追加保存する。

型・関連単体116件、実Worker通信13ケース（分割）、選択/訓練E2E4件、実Chromeで勝利/敗北→同じ部隊→再出撃、旧/新武器の通常・協力共有と報酬往復、武器一覧の開発/配布各8条件成功。配布管理者2経路で一時装備分離・名前/配置共通、12asset SHA一致。両build・production Worker dry-run成功。修正と追加仕様・証拠・限界は [PLAYABILITY-REAUDIT.md](PLAYABILITY-REAUDIT.md)。

**監査結果:** HEAD `157df9549cbce64f936a120034f9ca4a6b985b59` の外部監査は要修正だった。P1サーバー準備世代、P2協力結果のロビー復帰、P2再描画後focusを修正し、追加の共通武器庫も実装・自己検証済み。修正HEADの独立再監査は未受領。

**停止理由:** ユーザー指示によりmain反映・公開は保留。Codex内レビューを独立監査合格に代用しない。

**再開条件:** PR #6の修正HEAD（追加の保存統合・通信変更を含む）についてChat独立再監査と必要な承認を受領後、保護/CIを満たしてmain反映・公開・配信照合へ進む。実スマホ受入と厳密同時の別タブ保存排他は未確認/未対応として記録。

以下の兵士デザイン記録とそれ以前の履歴を保護する。次の作業はこのブランチ/PRの未反映成果を確認し、旧mainから取り落とさない。

# 現在地: 兵士デザインv9を保存、Chat独立監査・公開承認待ち（2026-09-15）

Image Aに沿う部隊装備・材質・待機姿勢を実装し、途中指示の骨盤/太腿/ポーチのスリム化も反映。[PR #5](https://github.com/futsalife24-bot/swarm-front/pull/5)、保存ブランチ `codex/trooper-design-refresh`。実装・証拠HEADは `5c9279b9586d8d1589ea0a287ce4e6b71b386c70`（この後続commitは現在地記録のみ）。開始base/mainは `0eab85d20dbe480d100e1cca27bc47da301a33cb`、最終fetchでも同じ。

型・関連14単体・通常/Pages build・production Worker dry-run成功。合成315条件でソケット差4.3e-8m以下、57骨/15非待機clipのpayload保持、3クラス接地/反復切替、開発/配布の横画面2サイズで移動/射撃/装填/切替/回避復帰成功。GLB7.34MB・制服11draw、source/dist/dist-pages SHA一致。ユーザー許可のCodex内監査は指摘修正後「必須修正なし」。[調査・実装・比較画像・動画・残課題](TROOPER-DESIGN-V9.md)、[Codex内監査記録](TROOPER-DESIGN-V9-REVIEW.md)。

**停止理由:** READMEに残る「本番公開・mergeは独立監査後の承認待ち」により、main反映とWorker公開は未実施。今回の監査エージェント許可をChat独立監査条件の解除とは解釈していない。

**再開条件:** PR #5の最新HEADについてChat独立監査と必要な承認を受領後、既存の保護・CIを満たしてmain反映と既存Worker公開へ進む。先にこのブランチ/PRの未反映成果を確認する。原画と同等の写実品質・実機GPU負荷を合格扱いしていない。

以下はmain集約と各機能の履歴。上記の未反映PRを解消するまで、新しい作業を旧mainから始めて成果を取り落とさない。

# main集約完了（2026-09-15）

正本: GitHub `futsalife24-bot/swarm-front` のmain。正規作業場所はこの `game/`。新しい開始・終了ルールは [WORKFLOW.md](WORKFLOW.md)。

集約PR: [#3（merge済み）](https://github.com/futsalife24-bot/swarm-front/pull/3)。Chat独立再監査で `34193cfe65564a752f98b6d118974f7f6485a63e` が合格し、ユーザーからmerge可の判定を受領。2026-09-15 11:31 JSTに通常mergeを実施した。merge commitは `6dea3ce3eed6d1671dc478f7f24da32922fd5ad1`、監査対象HEADとtree差分0。手元mainもfast-forward同期し、origin/mainとのSHA一致・cleanを確認済み。この後続更新は完了記録だけ。

初回監査対象 `d72871c` はST11〜20のロビー同期不具合で要修正だった。共通判定への修正と実Worker回帰テストを `1fb2395e408170c13c2b665953f13c6d7fb30a63` で保存・検証し、再監査合格後に上記PRで反映済み。[指摘対応と再現・検証結果](MAIN-CONSOLIDATION-REAUDIT-20260915.md)。初回のバックアップ・327件の単体/試遊・実通信7件・対象UI確認は[集約記録](MAIN-CONSOLIDATION-20260915.md)。旧audit.zipは初回監査対象版の資料として保管しており、後続の修正を含まない。

この集約に関する監査待ち・停止条件は解消済み。次の通常タスクは最新mainから [WORKFLOW.md](WORKFLOW.md) に従って開始する。`codex/main-consolidation-20260915` と旧ブランチは履歴保管用で、新規開発の起点にしない。

Worker再公開は今回のmerge条件では不要とされ、実施していない。全バイナリの個別監査、ローカル退避物の独立再照合、実機、広告SDK、PWA、GitHub CIでの再実行は監査合格の範囲外として維持する。

以下は機能ごとの履歴。古い承認待ち・未コミット・branch/HEADは当時の記録であり、この先頭と実際のGitに優先しない。

# 2026-09-15 会敵イベント中のHUD非表示（公開済み）

会敵の停止開始から黒帯・ズーム・敵名表示まで戦闘HUD、操作、ミニマップ、装填表示、照準、ダメージ数字、スコープを非表示。閉じると復帰。型/両build/Worker dry-run、配布版2寸法で全4段階の非表示と復帰後の射撃/装填/一時停止成功。変更前162配信SHA一致後に既存Workerへ公開。Version 4d3a3fbd-52bb-44ae-9665-6058185f8e51。[記録](ENCOUNTER-HUD.md)。

公開後も2寸法で全4段階の非表示と復帰操作成功、pageerror 0、14配信SHA一致・health成功。

# 2026-09-15 ARの敵質感別ヒット音3種（暫定採用・公開済み）

HIT-05＝PLEAT/HOUND、HIT-07＝PRISM/FOUNDRY ZERO通常・連結炉、HIT-10＝RAY。AR命中イベントの敵種で判定し、撃破後・協力受信にも対応。型/audio15テスト/全7形態Chrome/実WebSocket2接続/両build/Worker dry-run成功。公開18配信SHA一致・health・3音decode・操作成功。Version 64e99a11-07cc-4ffd-81c5-a6ad8af3825a。[対応表と検証](AR-HIT-SE.md)。

# 2026-09-15 タイトルロゴv2へ再差し替え（公開済み）

新指定PNGを無加工採用し参照v2へ更新。黒背景はロゴ限定screen合成、表示枠は新画像寸法に調整。型/両build/Worker dry-run、配布・公開の両入口×3サイズ成功、pageerror 0。公開15配信SHA一致・health成功。Version 8b32d7b0-b306-4bb4-8e18-5489eebf7a8a。[記録](TITLE-LOGO-V2.md)。

# 2026-09-15 添付透過ロゴをタイトルへ（公開済み）

Drive指定PNGの実アルファを確認して無加工採用。共通タイトルのテキストをPNGへ、透明余白は表示枠で調整。型/両build/Worker dry-run、配布/公開の両入口×3サイズで画像・非重複・設定/履歴動作成功、pageerror 0。公開15配信SHA一致・health成功。Version 8f6ec8a3-fd5c-4231-bb22-e18c4c26a6e7。[記録](TITLE-LOGO.md)。

# 2026-09-15 メニュー入口整理（公開済み）

48丁サンプルを開発者モード内へ、開発者入口を設定右下へ、更新履歴をタイトル左下へ移動。型/両build/Worker dry-run、ローカル両入口×3サイズと認証・サンプル往復・保存保持成功。ユーザー明示承認後、公開済みコード・素材・Workerとの比較で範囲を証明して公開。Version 6394c0ec-3534-4718-9df3-d578279cf52e。公開14配信SHA一致・health成功、両入口×3サイズの履歴/設定/認証入口成功、pageerror 0。[記録](MENU-ENTRY.md)。

# 2026-09-15 操作配置・訓練射撃場・設定2列（公開済み）

通常/試遊のバトルから実ボタン配置編集、個別濃さ、編集途中の設定を試す新訓練マップ、設定の環境/保存2列化を実装。型・関連7テスト・両build・Worker dry-run・配布版6画面と両入口バトル往復成功。既存ゲーム6テスト不一致は変更前でも再現、ST20時間切れは単独成功。9/15の明示承認で公開。Version 1a0582b8-7090-48ca-9eb6-14beb9dda35a。公開49取得SHA一致・health成功、公開6画面と両入口バトル往復も成功。pageerror 0。[変更・検証・承認履歴](CONTROLS-TRAINING.md)。

# 2026-09-14 RL初期発射音・EX-05爆発音を正式採用（公開済み）

RL発射を初期制作se-v1/rocket.wavへ復元、着弾・誘爆はEX-05専用音。敵攻撃と分離し距離減衰を保持。型/audio7テスト/両build/Worker dry-run、Chrome27音・32音混合ピーク0.9497、開発/配布/公開の射撃操作とpageerror0、公開配信一致・health成功。Version 4dbb61c1-aec5-43db-b4ba-dd47169406bd。[記録](ROCKET-FINAL-SE.md)。

# 2026-09-14 選定3音を正式版へ（公開済み）

AR-04の1発抽出・SG-01・RL-05を発射音へ採用。新URL、出典表示、32音混合時の出力余裕。検証で見つかった既存の初期化循環はBLOCKSの定義分離のみで修正。型/audio6件/両build/Worker dry-run、3音実バッファ・32音ピーク0.9281、ローカル/公開の射撃操作とpageerror0、34配信一致・health成功。Version bb0653da-e1eb-486d-9de7-94fec3875c44。[記録](SELECTED-WEAPON-SE.md)。

# 2026-09-14 アイコンを拡大・上下中央揃え（公開済み）

元画像を約16%拡大し文字ブロックを上下中央へ。maskableの追加余白も撤去し、全参照をv3へ更新。両build/Worker dry-run、ローカル/公開の両入口で画像読込・インストール判定エラー0・7配信一致・health成功。Version c72d0fb5-abfa-48f3-80bd-18c40450dd8b。端末側更新は未確認。[記録](PWA-ICON-ZOOM.md)。

# 2026-09-14 添付画像をアプリアイコンへ採用（公開済み）

ユーザー指定のSWARM FRONT画像を192/512/180/64pxとmaskable512pxに変換。PWA/apple/faviconの参照を別名v2へ統一。両build/Worker dry-run、ローカル/公開の両入口で画像読込・インストール判定エラー0・7配信一致・health成功。Version 78f1fca9-662f-4edd-8151-be4bbbf019c6。既存インストールの端末側更新は未確認。[記録](PWA-ICON-ART.md)。

# 2026-09-14 インストール用PNGアイコン（公開済み）

既存SVGから192/512px・maskable512px・apple180pxを生成しmanifest/HTMLへ追加。通常/Pages build・Worker dry-run、ローカルと公開の両入口の画像読込/Chromeインストール判定（エラー0）/7配信一致/health成功。Version 1a5f5e49-58a7-4caf-950a-b6dbe12e816d。ユーザー端末のタスク切り替え表示・インストール種別は未確認。[記録](PWA-ICONS.md)。

# 2026-09-14 固定パスワードで開発者モードへ往復（公開済み）

通常/試遊のタイトルと設定に共通入口。固定パスワードをWorker側で認証し、未認証の直URLを拒否。通常/テスト保存を保持、退出はlogoutして元の通常画面へ戻る。型/認証5件/進行境界4件/両build/Worker dry-run、実ローカルと公開の2経路・2寸法で往復/失効/保存一致、11配信SHA一致・秘密非混入・health成功。Version 67f6a3dd-e8fe-4b9a-be17-2738243d30c6。[現行仕様と検証](DEVELOPER-ACCESS.md)。

# 2026-09-14 3型の正式分類・レポート表示（公開済み）

生物型=PLEAT/RAY、異構型=HOUND 2種/PRISM、機構型=FOUNDRY ZERO両形態を正式分類として造形正本へ記録。ボスは独立区分。レポートの一覧/詳細に型名だけ表示。型/通常・Pages build/Worker dry-run、ローカルと公開の全7形態×2寸法、未遭遇ロック、11配信SHA一致、health成功。Version 0db7a5b5-f593-4f8c-afe6-6bf4b6f1d96f。[記録](ENEMY-TYPES.md)。

# 2026-09-14 スポーン演出（公開済み）

RAY/PRISMは転移の光輪と粒子、地上系は土煙と破片。モデル・モーション・戦闘データは保持し、初会敵カットインは演出終了後へ。型/関連40テスト/通常・Pages build/Worker dry-run、全7形態×2寸法と寿命・停止・再出撃成功。今回の「はい」で公開承認後、Version d4d98899-8a6e-4d78-a499-e5b051e8d1c6へ更新。配布版/公開版の2寸法で出撃/初会敵/停止、11配信SHA一致、公開health成功。[記録](ENEMY-SPAWN.md)。

# 2026-09-14 全7形態の攻撃予備動作強化

PRISMは8枚が個別に縦回転。地上3種の足先を固定して沈み込み、RAYのひれ、通常炉のクレーン、連結炉の発射器を強調。攻撃時刻・判定は保持。36テスト・型/通常・Pages build/Worker dry-run成功。公開全7形態×2寸法、11ファイルSHA一致・health成功。Version 902658d5-da39-4671-98a3-43774aacd708。[記録](ENEMY-WINDUP.md)。

# 2026-09-14 会敵ムービーを最新待機で再撮影

全7体を現在の6秒Idleで再撮影し、旧動画キャッシュを避けるreport-v2へ読込先を変更。全デコード、7本の連続画像、横画面2寸法の再生/シーク/再再生/解放、型/通常・Pages build/Worker dry-run成功。公開版でも全7本×2寸法、18配信ファイルSHA一致・health成功。Version 2a32b9a8-5b63-4896-a128-9d9f5c5c0e54。[記録](REPORT-FILMS-V2.md)。

# 2026-09-14 旧式レポート復元・全解放開発者モード

試遊版の簡易レポートを既存bestiaryへ統一。未遭遇/協力/ソロの解放を保持。?developer=1 と設定→保存データから全解放の検証モードへ。通常保存とは分離し再読込でリセット。全画面化がレポートを覆う表示順も修正。型/15テスト/通常・Pages build/Worker dry-run、全7形態×2寸法・全42条件選択・ST20出撃・保存分離/復帰・全画面成功/拒否/復帰を確認。公開版でも全項目・11配信ファイルSHA一致・health成功。Version 2a83029f-63e7-4c46-bcac-e54de13c94c6。[記録](REPORT-DEVELOPER.md)。

# 2026-09-14 全7体の待機モーション

PRISMの浮遊板周回、地上3種の足先固定屈伸と襞/背板、RAYのひれと尾、通常炉のアームと連結炉の発射器を更新。レポートの停止を待機再生へ変更、初会敵にも共通適用。型/関連14テスト/通常・Pages build/Worker dry-run、全6スキンの接地・継ぎ目、全7体×2寸法のレポート/初会敵を確認。既存Workerへ公開し、公開14画面・11配信ファイルSHA一致・初会敵/復帰・health成功。Version 74b59121-cbdf-4a97-8990-497fbd59d44f。[記録](ENEMY-IDLE.md)。

# 2026-09-14 エネミーレポートへ全7会敵ムービーを採用

初登場ステージのマップで、敵が最初からこちらを向いた直進ズーム映像を全7体撮影。FOUNDRY ZEROは草原の平地へ移して脚埋まりを解消。既存レポートに再生ボタンを追加し、ソロ遭遇ロックとバトル中の正面回り込みを維持。約2MB/本を選択時取得しBlob再生、シーク・再再生・閉じる際の解放対応。Google Drive送信なし。全7本×2寸法のローカル/公開操作、MP4全デコード、公開18ファイルSHA一致・health、型/build/Worker dry-run、カメラ4テスト成功。Version af518618-258f-4177-b6fd-105f72163147。[記録](REPORT-FILMS.md)。
# 2026-09-14 初会敵カメラを正面へ修正

敵の実描画前方向を参照し、背面からは円弧で正面へ寄る。全7種×2寸法の正面/停止/待機/復帰、カメラ4方向単体テスト、型/build/公開確認成功。Version ac45cb29-c9b8-4efb-8f78-4ee28675350e。全7動画＋まとめをDriveへ共有。[記録](ENCOUNTER-FRONT.md)。

# 2026-09-14 初会敵の待機モーション・名前カットイン

ゲーム時間を止めて対象1体だけIdle再生。連結炉は発射器の観測動作。左中央のRajdhani Bold名称カットインと右寄り構図。全7種×2寸法・36テスト・型/build/公開12ファイル一致と動作確認成功。Version 16413e52-860e-4506-afe2-867050dd64b9。[記録](ENCOUNTER-IDLE-CUTIN.md)。

# 2026-09-14 初会敵イベントの連続ズーム

画面停止 → 上下黒帯 → 現在のゲーム画面から相手へズーム → 名前とテキスト表示。型/build/Worker dry-run・横画面2サイズの時間停止/順序/再開・公開配信一致と実動作を確認。Version 4b9716c4-5cad-464d-b022-5ee0d332a0ff。[記録](ENCOUNTER-SEQUENCE.md)。

# 2026-09-14 全武器の写真参照モデル・友人向け固定URL公開

SCAR 16S / Mossberg 590A1 / AT4の実物写真を目視参照し、3系統×5レア度の別名GLBを生成。通常3モデル・試遊15モデル・詳細/共有へ反映。型・関連9テスト・通常/Pages build・Worker dry-run・15プレビュー/手持ち/切替・公開26ファイル一致・公開2寸法のタッチ出撃/射撃/切替/停止・health成功。Version b447f835-344b-4c6a-80ab-ab53fc17e735。ユーザーの友人向け公開明示承認による。
https://swarm-front.melosalife-24.workers.dev/?playtest=1
写真からの外観再構成で、実寸の工業的複製ではない。実スマホ受入未確認。[記録](WEAPON-REALISM.md)。
# 2026-09-14 性能補正を色付き記号へ統一

−10〜−1%青▼、0%なし、+1〜10%黄▲、+11〜19%橙▲2段、+20%朱★。白数値/下線なし、一覧/詳細/共有/凡例対応。型/build・境界8値・4寸法通常整理・公開10ファイル一致を確認。同じ一時URL反映済み。[変更記録](PERFORMANCE-MARKS.md)。

# 2026-09-14 白・青下線廃止、負補正に青い二段▼

数値白を維持、基準/負補正の下線なし、負補正に青▼を縦2段追加。黄/橙/赤下線と★維持、一覧/詳細/共有対応。型/build・4寸法通常整理・スタイル/画像・配信一致を確認。同じ一時URL反映済み。[変更記録](PERFORMANCE-DOWN.md)。

# 2026-09-14 固定装備の金枠・見出しとの隙間解消

固定行の四辺を金色2pxで強調。見出し余白4pxを除去して固定位置を20pxに合わせ、境界を不透明化。4寸法通常/整理・3寸法×5スクロール位置・配信10ファイル一致を確認。同じ一時URLへ反映済み。詳細: [固定行の枠と接続](PINNED-SEAL.md)。

# 2026-09-14 装備変更SE・白文字と色下線

装備確定時に戦闘共通switch.wav、同一品/入替先選択では無音。性能値を白字＋5色下線へ統一、◎廃止、☆→★。一覧/固定行/詳細/共有画像対応。型/build・実音源再生/消音・4寸法通常整理・共有PNG・公開10ファイル一致を確認。同じ一時URLへ反映済み。詳細: [SEと性能下線](WEAPON-FEEDBACK.md)。

# 2026-09-14 武器行30px・入替先選択・先頭固定比較

武器行44→30px、文字サイズ維持。出撃準備は装備1を初期選択、左カードで1/2切替、選択装備を見出し直下に固定。候補1タップで装備し、他方装備なら交換。固定行は詳細表示。型/build・4寸法通常/整理・固定/交換/保存/タッチ・安全領域を確認、同じ一時URLの10配信ファイル一致。実機受入未確認。詳細: [行密度と固定比較](GEAR-PINNED.md)。

# 2026-09-14 メニュー配置・武器ジャンル入口・48丁サンプル

見切れのtop:-18pxを解除、左枠／特殊効果欄を縮小、全行を単一スクロールに統合。武器庫は3ジャンル選択→一覧、ロックは文字と色で明確化。専用メモリ上の48丁サンプル入口を追加。型・13テスト・4寸法の通常/整理・3ジャンル全7ソート・タッチ横スクロール・保存分離・安全領域と入口往復成功。同じ一時URLへ反映、最終10配信ファイル一致。固定Worker未更新、実機受入未確認。詳細: [配置とサンプル記録](MENU-FIT-SAMPLES.md)。

# 2026-09-14 出撃準備の行密度・整理表示

ユーザーPhoto 2を基準に、性能欄600→316px、見出し30→20px、レア度を左の小枠、チェックは整理中のみ、右端ロック固定へ修正。27丁・4寸法の通常/整理を確認し、844px以上は全性能が横スクロールなし。既存UI継承をAGENTSと画面検証で明文化。同じ一時URLを更新。詳細: [出撃準備UI基準](GEAR-UI-BASELINE.md)。

# 2026-09-14 試遊版の既存UI復元

初回試遊版が既存UIを継承していなかったというユーザー指摘を受け、タイトルを共通部品化し、既存テーマ・左右の準備画面・HUD・操作設定を復元。同じ一時URLへ反映済み。3画面寸法、関連17テスト、実戦→報酬→育成→再出撃、配信一致を確認。ゲーム全体の完成・実機受入とは区別する。詳細: [UI復元記録](PLAYTEST-UI-RESTORE.md)。

# 2026-09-14 スマホ一時試遊URL

https://congressional-structured-thirty-keeping.trycloudflare.com/?playtest=1

検証済みdistをQuick Tunnelで配信。タッチ開始/戦闘/一時停止・11配信ファイル一致を確認。PC稼働中のソロ用で、固定Workerへの反映は未実施。詳細: [試遊記録](PLAYTEST-V1.md)。

# 2026-09-14 初期試遊 v1（ローカル・未公開）

出撃→戦闘→回収/敗北→報酬→育成→再挑戦を別入口 `?playtest=1` で実装。初期8条件の後、全42条件攻略、新機能65件・既存関連32件・実2接続・配布版確認成功。同じ読み取り専用確認担当1体の前後監査から7指摘を主担当修正。旧保存と既存差分を保持。実広告・実機・公開は未実施。設定/受入/限界/監査資料は [初期試遊v1記録](PLAYTEST-V1.md)。

# 2026-09-13 ゲーム内SE（公開済み）

BGMなしで26種類のSE。AR-15／Mossberg実録銃声、着弾・装填・回避・切替・装備着脱・メニュー、敵の近接／酸／杭／跳躍／レーザー等。26WAV計0.87MB、CC0出典・加工履歴を同梱。型・SE6テスト・ブラウザ音源／32音ミックス・配布版操作成功。公開Version `2bfa2591-c02b-4c09-b6cb-288ca4615d11`、30配信ファイル一致・health正常。公開版の装備／射撃／装填／切替／回避／一時停止と発音・エラー0も確認。既存の固定HPテスト4件は現行個体差との不一致。実機聴感未確認。詳細: [SE記録](GAME-SE.md)。

# 2026-09-13 兵士の走りB暫定採用（公開済み）

ユーザーの「Bで暫定採用するから公開までやって」により、比較済みSprint下半身を別名v8モデルで既定化。既存57骨・18クリップ・見た目・武器と速度を保持。型・14テスト・client/Pages/Worker dry-run、540フレーム3武器の比較B一致、ローカル/公開版の移動・射撃・切替後射撃・回避を確認。公開JS/CSS/兵士/3武器/採用情報一致、health正常、描画例外なし。Free/$0現契約を画面で確認。Version `b3978663-7e39-41ac-9350-b3a2fed2198f`。足滑り・開始停止と後退切替の滑らかさは残課題。詳細: [B暫定採用記録](TROOPER-SPRINT-ADOPTION.md)。

# 2026-09-13 全6マップの素材・陰影（公開済み）

各環境の実景写真を参照し、建材目地/雨筋・金属酸化・植生ムラ・雪風紋・岩層/湿りと自然面の法線を改善。全24画面のマップ三角形数据置・頂点増加なし・描画エラー0、型・20テスト・client/Pages/Worker dry-run成功。配布12出撃/表示/配信一致を確認、外部CAPTCHA読込のみ未確認。ユーザーの「公開して」で承認後、Version 58192466-522f-483d-9827-0dd17c57832dで公開。公開版12出撃・配信一致・エラー0・health正常を確認し、CAPTCHA読込遮断もなし。比較・参考画像・差分・検証は [マップ質感記録](MAP-REALISM.md)。

# 2026-09-13 地形表面・攻撃予告（公開済み）

斜面追従の円・扇形、背景山の場内張り出し解消、舗装3マップ平坦化。全6×2画質38,408点・50テスト・実Worker2接続成功。ユーザーの「はい」で公開承認後、Version c6106c8d-1431-41a0-b238-f6e38f6af5a1で公開。公開版12画面の出撃・配信一致・エラー0・health正常を確認。詳細: [地形表面修正](TERRAIN-SURFACE.md)。

# 2026-09-13 全敵の固定サイズ・性能個体差（公開済み）

通常型FOUNDRY ZEROはサイズ/HP/威力2倍。他の全敵は0.8〜2倍の固定個体差、HP/威力比例、基準サイズ以下の移動は1.5倍速。配置番号で固定し増援数から独立。大型の攻撃間隔を調整、全20stage攻略・関連142件（分割）・全20描画・実Worker2接続同期成功。配布版PC/横持ち確認・Worker dry-runも成功。ユーザーの「公開して」で承認を取得しVersion `aabcfb6f-b3d4-439a-862a-2ec9b0dc997a`で公開。公開版PC/横持ち操作・JS/CSS/モデル一致・health正常を確認。詳細と差分は [サイズ調整記録](ENEMY-SIZE.md)。

# 2026-09-13 PWA横向き全画面（公開済み）

実機でステータスバー常駐の報告を受け、非全画面PWAまでAPI要求を止めた回帰を修正。省略条件を実際のdisplay-mode fullscreenまたはDOM fullscreenのみに限定し、standalone等は最初の操作/解除後操作で全画面化。型/build/dry-run、PWA4条件、実Chrome復帰、公開版4条件/オフライン/設定更新、配信一致・health成功。修正版Version 7be0b569-3739-4c79-9a88-d1ee27c786d2。実機未確認、DOM全画面時の案内は残る可能性あり。下記は初版履歴。

manifestをfullscreenへ、アプリ表示ではDOM全画面の再要求を抑止、古いmanifestキャッシュ更新を追加。型・client build・Worker dry-run・PWA4条件の操作/復帰・実SW更新/オフライン・既存ブラウザ全画面検証成功。初回deploy拒否後ユーザーの「承認します」で公開。Version 6fb5a9eb-b657-4db7-acfe-888e6d574874。公開版4表示条件・SW更新/オフライン・配信JS/CSS/manifest/sw一致・health成功。実スマホ未確認。詳細: [PWA全画面](PWA-FULLSCREEN.md)。

# 2026-09-13 武器庫1行・全画面復帰（公開済み）

ユーザーの公開明示承認で一覧UIと全画面復帰をまとめて公開。Version 051e66c2-d647-4b9f-8cc2-1b6339198460。公開版4サイズの配置/操作、配信JS/CSS一致、health、実Chromeの武器庫全画面開始・準備/戦闘での解除後タップ復帰が成功。実Android/iPhoneは未確認。詳細: [一覧UI](MENU-DENSITY.md)、[全画面復帰](FULLSCREEN-KEEP.md)。下記の承認待ち記載は解消済みの履歴。

# 2026-09-12 全画面維持・復帰（実装済み／公開承認待ち）

タッチ端末の全ゲーム操作でnavigationUI hide付き全画面要求。解除後は準備・武器庫・戦闘の次のタップで復帰。上下safe-area強制0は撤回。型/build・APIスタブ・実Chromeで開始/解除/準備と射撃での復帰・既存向きAPI2条件成功。実機未確認。前のUI修正と合わせ公開承認待ち。詳細: [全画面維持](FULLSCREEN-KEEP.md)。

# 2026-09-12 武器庫1行・上部余白・ヘッダー配置（実装済み／公開承認待ち）

武器庫32pxの1行表示、共通性能見出し、整理ボタン重なり修正、準備の3操作を上段へ移動、貫通説明の重複除去、fullscreen余白回収、全画面の密度ルールを実装。型・build・Worker dry-run・配布版4サイズの操作/配置成功。自動承認レビューが本番公開の明示承認不足として拒否したため公開未実施。詳細・制約: [修正記録](MENU-DENSITY.md)。

# 2026-09-12 特殊効果なしの表示修正（公開済み）

効果なし・旧quick・旧ショットガン貫通を「ー」の非ボタン表示へ統一。装填性能は維持。型/client/Worker dry-run・配布版2サイズの効果操作・4サイズの1行配置成功。ユーザーの「はい」で明示承認後に公開。Version 38b710d4-ab11-4336-a389-ba134ead49d0。公開版2サイズの効果操作・4サイズの配置・JS/CSS一致・health成功。現行表示仕様・差分・検証は [修正記録](EFFECT-NONE.md)。

# 2026-09-12 出撃準備の武器一覧1行表示（公開済み）

武器名・特殊効果・5性能・装備マークを1行へ復旧。型/client/Workerビルド・CSS書式・配布/公開4サイズの配置と装備変更・公開JS/CSS一致・health成功。Version d32c44cc-17a0-4360-b9ee-53de70197493。詳細: [修正記録](WEAPON-ROW.md)。

# 2026-09-12 LEAPERの黒い支柱の貫通修正（公開済み）

旧リングを除去した際に残ったring_support_L/Rが前脚に誤追従していた。不要な2本の88三角形のみを除去したleaper_motion_v2を採用。形状の他部位・材質・骨・モーションは維持。型・7テスト・4方向の比較・配布/公開PCと横持ち操作・ファイル一致・health正常を確認。Version 2480abe0-8260-4915-92be-3301c34f3e65。詳細: [修正記録](../assets/blender/candidates/leaper/support-binding-v2/DESIGN.md)。

# 2026-09-12 LEAPERレポート跳躍（公開済み）

移動時だけカメラが引いて小さくなる処理を除去。五脚の接地屈伸・空中折畳み・着地復帰をレポート専用IKで実装。型・関連7テスト・121フレームの実GLB検査・PC/横持ちの配布/公開確認成功。Version b03e0c69-2950-4eda-ab78-758f81416d26、health正常。実機性能未確認。差分・証拠は [跳躍修正記録](LEAPER-REPORT-JUMP.md)。

# 2026-09-12 レポート表示領域の拡大（公開済み）

視点リセット・左右回転ボタンを削除し、PC／横画面の3D表示高さを36px拡大。再生・ドラッグ操作を維持。型・build・2サイズ操作成功。Version `d0c86e17-61ac-4b4b-b94c-96990918fb99`。詳細は [レポート記録](ENEMY-REFERENCE-REDESIGN.md)。

# 2026-09-12 PLEAT・LEAPER精細化／全敵モーション再生（公開済み）

添付参照でPLEATの殻・胸の襞を精細化し、LEAPERだけを独立した分割装甲・発光背骨モデルへ刷新。VOLLEYは元GLB/blendのハッシュ一致を確認。全6種＋連結炉に移動／攻撃／停止ボタン。Blender再import、全clip頂点、旧／新motion80,366数値一致、1/10/40体、型・関連37テスト、14表示条件の再生／静止画像確認、client/Pages/Worker dry-run成功。Version `52b47ba0-3e5a-4692-8099-ee9282408475`で公開。公開版PC／タッチの全7表示・再生・出撃／撤退、JS/CSS/新旧3GLB一致、health200を確認。差分・制約は [制作・検証記録](ENEMY-REFERENCE-REDESIGN.md)。

# 2026-09-12 全マップの不自然な追加物撤去（公開済み）

雪山にも残っていた共通階段を全6マップで再点検。工場・倉庫等の後付け入口も含め、階段・箱・台125個、付属装飾、専用の平坦化を撤去。自然の起伏と標準／軽量モードは維持。型・関連75テスト（全20stage）・全6マップ×2モードの実描画、撤去位置250サンプルの接地／衝突・client/Pages/Worker dry-run成功。Version `27a56beb-3820-4efd-a6c2-3cc202dc8bb2`で公開。配置ルールをAGENTS.mdに明記。詳細・差分・証拠は [全マップ点検記録](MAP-CONTEXT.md)。以下の旧記録にある追加小物・倉庫入口の仕様はこの撤去で更新。

# 2026-09-12 全マップ精細化・倉庫入口・軽量モード（公開済み）

孤立した階段を既存建物につながる荷役台・入口へ再配置。全6マップの標準は近距離4分割、遠距離は従来密度。地面の陰影と素材を改善し、バッチ描画・頂点共有・非選択主マップの解放で負荷を抑制。設定／一時停止の軽量モードは従来密度・質感と解像度65%で、保存・再読込み・戦闘中の切替を確認。型・単体/攻略237件（分割実行、全20stage）・全6マップ×2モード・床746点・設定2サイズ・client/Pages/本番Worker dry-run成功。配布版12画面もJS/CSS/GLB一致・エラー0。ユーザーの「公開して」で承認を取得し、Version `51dfd38a-e803-4566-8649-245dd94dd471`で公開。公開版12画面のファイル一致・エラー0、PC/横持ちの軽量保存と双方向切替、health200 / ok:trueを確認。Android/iPhone実機性能は未測定。詳細・制約・差分は [マップ精細化記録](MAP-DETAIL.md)。
# 2026-09-12 全6マップの高低差刷新（公開済み）

ベースを保持し、登れる稜線・高低差と149個の段差・小物を追加。移動/カメラ/射撃/敵接地を高度へ対応し、プレイヤーより高い敵だけ中抜きのマーカーに変更。ジャンプ操作は次タスク、空中移動指定と下降接触APIは準備済み。型、全224テスト（全20stage含む）＋最終着地10件、実Worker2接続同期、床374点照合、配布・公開PC/横持ち各12画面、client/Pages/Worker dry-run成功。ユーザーの「はい」で公開承認を取得し、Version `d603879b-7508-4682-bf4e-6f9fc50d1d1f` で公開。公開JS/CSS/全6GLB一致、health200、エラー・横はみ出し0を確認。Android/iPhone実機性能は未確認。仕様・差分・証拠は [地形刷新記録](TERRAIN-REFRESH.md)。

# 2026-09-12 FOUNDRY ZERO不規則歩行（公開済み）

左右交互の固定周期を廃止し、脚ごと・一歩ごとに間隔/送り速度/持上げ高さ/着地点を変える足運びへ変更。実34脚すべての独立した踏み出しと一定速度時の間隔変動、支持足固定、停止時34脚接地、分離・レーザー・破棄等を確認。型・関連33テスト・client/Worker build・配布版PC/タッチ操作・同条件再生の一致が成功。ユーザーの「承認する」を受け、Version `59a51ebc-cdb5-41f0-b477-5d1567382794` で公開完了。公開JS/CSS/GLB一致、PC/タッチのレポート・出撃/撤退、health200を確認。実スマホ性能は未測定。実差分・再生プレビュー・検証・公開結果は [不規則歩行記録](FOUNDRY-ZERO-IRREGULAR-GAIT.md)。

# 2026-09-12 FOUNDRY ZERO支持脚修正（公開済み）

人体的な脚の膨らみと靴状の足先を、角型支柱・関節軸・小型接地パッドへ変更。脚以外の29meshと素材、136剛体パーツの関節配置は旧GLBと一致。36,628→36,152tri、5素材を維持。型・関連33テスト・Blender/GLB再読込・実歩行/分離・client/Worker build・配布版PC/タッチのレポート/出撃/撤退が成功。ユーザーの追加公開承認「はい」を受けて既存Workerへ公開完了。Version `12cda6ba-80f9-4cec-9aa5-8c535cc1687a`。公開GLB/JS/CSS一致、PC/タッチ2サイズのレポート・出撃/撤退、health200を確認。実スマホ性能は未測定。比較画像・実差分・検証・公開結果は [支持脚修正記録](FOUNDRY-ZERO-MECHANICAL-LEGS.md)。

# 2026-09-12 FOUNDRY ZERO（公開済み）

「公開までやっていいよ」で公開承認取得済み。その後の統合初版への「オッケー」で未指定だった回数・対象・速度・抽選・レーザー性能も確定し、[制作正本](FOUNDRY-ZERO-CONCEPT.md)へ追記。再承認待ちではない。

新しい地上多脚モデル、節の分離と追跡、頭部接続胴数だけの1回生成、直進レーザー、形態別レポートを実装。独立監査で見つけた短い予告・急旋回の重なりを修正し、型/client/本番Worker build・223テスト・全20stage・実Worker2接続同期が成功。Version `11801197-c7d7-411a-b66f-25f2c85f7aca` で公開済み。公開JS/CSS/GLB一致、PC/タッチ2サイズのレポート・出撃/撤退、health200を確認。実スマホの性能と長時間混戦は未検証、速い空中足送りの測定値を含む監査範囲・証拠は [実装記録](FOUNDRY-ZERO-IMPLEMENTATION.md)。

# 2026-09-12 FOUNDRY ZERO制作コンセプト（正本登録）

ユーザー指定文を [FOUNDRY-ZERO-CONCEPT.md](FOUNDRY-ZERO-CONCEPT.md) に保存し、参考画像2枚と共通造形正本からの参照を追加。頭部1＋胴体7、レーザー、頭部接続中の残存胴体節数と同数の生成、胴体破壊位置での分離を確定。画像・旧仕様より文章優先、破壊順序は固定しない。生成回数・高速化対象・具体的な挙動や数値などは要確認。文書・参考資料のみの更新で、モデル制作・ゲーム反映・公開は未実施。

# 2026-09-12 横画面・ピンチ抑止・移動中スコープ（公開済み）

追加指定により端末側の向き固定を優先。「横にしてください」案内を外し、起動時lockと通常開始操作時のfullscreen→lockを追加。CSS90度回転は未採用。型/client/Worker build、既存Chromeタッチ2サイズ、APIスタブ2条件成功。追加公開Version `94745420-f895-45a6-9220-77681b28d2ad`。実iOSの向き固定成功は未確認。詳細は同記録の追加変更節。

全サイズ・全メニューを横画面専用化。縦向きで入力解除・ソロ停止、対応端末の向き固定と未対応時の案内を追加。Safari gestureと複数指touchの拡大縮小を抑止し、スコープをpointerdownで処理して移動中の副ポインターでも反応。型/client/Worker build、Chrome実タッチのスマホ・タブレット各縦横で検証成功。Version `57794295-215f-4e00-84e5-052a75716735`。実iOS未確認。詳細・差分・証拠は [LANDSCAPE-TOUCH.md](LANDSCAPE-TOUCH.md)。

## 2026-09-12 照準・弾道修正と全武器スコープ（公開済み）

カメラと権威射撃の狙い点を共通化し、上半身の旧角度制限を修正。全武器に約2倍のタップ/Z切替スコープを追加。通常/拡大24描画条件、全187単体＋最終関連45件、実Worker2接続、3画面サイズ操作、型/client/Worker build成功。Version f59eae5e-31f0-4a44-9362-4f95312ee283。公開版でも横2サイズ・全3武器の操作、JS/CSS一致、API200を確認。実iPhoneとネット越し操作感は未確認。公開確認・差分は [AIM-SCOPE.md](AIM-SCOPE.md)。

## 2026-09-12 視点・射撃方向のズレ（調査時点の記録）

実Renderer/fireの隔離ブラウザで、カメラと弾道が30m先でのみ一致し、水平5m先では約18px左/31px下へズレることを再現（915×412）。上半身は約46度で止まる一方、弾道入力は80度まで動く点も実モデルで確認。ゲーム/本番変更なし。実機・協力遅延は未検証。数値・証拠・修正方針は [AIM-ALIGNMENT-AUDIT.md](AIM-ALIGNMENT-AUDIT.md)。

## 2026-09-12 iOSの文字選択対策（公開済み）

一時停止ボタン/メニュー・操作ボタン・戦闘表示にSafari向け文字選択/長押しメニュー抑止を追加。入力欄は編集操作を維持。Chromeタッチ2サイズで連打時の選択抑止、停止/再開/設定/離脱と公開JS/CSS一致を確認。型・client/Worker build成功。Version 14b91af6-393a-42d8-b6dc-07d9cfd3db69。iOS実機と他の不安定さは未確認。詳細 [IOS-TEXT-SELECTION.md](IOS-TEXT-SELECTION.md)。

## 2026-09-12 一時停止配置・ジャイロ軸と感度修正（公開済み）

左右2列整列、独立ジャイロ感度、回転速度の軸修正。型・4単体・3画面サイズ・実Controls模擬32方向・client/Worker build成功。ユーザー明示承認後に公開完了。Version fb3fdda5-fe91-4101-9bbd-1e2d88703fb6。公開JS/CSSハッシュ一致・感度保存・設定列・出撃/一時停止・API200確認。実機未確認。詳細 [GYRO-LAYOUT.md](GYRO-LAYOUT.md)。

## 2026-09-12 視点設定・ジャイロ（公開済み）

射撃ボタン専用感度とジャイロオン/オフを両設定画面に追加。上向き80度、サーバー検証とカメラ床下防止も対応。型・関連44単体・client/Workerビルド成功。ブラウザの操作assertionと画像確認済み、ジャイロ検証のブラウザ後片付けは停止するためランナー完走は未確認。実スマホ未確認。ユーザーの追加明示承認で既存Workerへ公開完了。Version `d501ed15-86ba-4ed9-be34-ffa942966c08`。公開JS/CSS一致・両設定画面・個別感度保存・出撃撤退・API正常を確認。詳細 [AIM-SETTINGS.md](AIM-SETTINGS.md)。

## 2026-09-12 射撃中の視点調整（公開済み）

射撃ボタンを押したまま指を動かして照準調整できるよう変更。既存感度・ボタン外の押下継続・解除処理を利用。型・client/Worker build・公開ページの出撃/撤退/API確認成功。検証と既存smokeの失敗・停滞の記録は [FIRE-DRAG.md](FIRE-DRAG.md)。

## 2026-09-12 未コミット変更の整理

既存変更を保全し、素材・本体・検証・記録・未接続WIPの8単位でローカル履歴へ整理。ゲーム内容は変更なし。分類・バックアップ・検証・運用は [GIT-CLEANUP-20260912.md](GIT-CLEANUP-20260912.md)。

## 2026-09-12 ミニマップ範囲外の敵（公開済み）

範囲外の敵を方向を保って外縁へ配置。型・client/Worker build、実Chrome16条件256マーカー、公開版の配信・出撃/撤退・API確認成功。記録は [MINIMAP-RIM.md](MINIMAP-RIM.md)。

## 2026-09-12 攻略・育成・周回（仕様回答待ち／未接続）

既存調査と広告通知共通部の準備のみ。全体未完成、ゲーム・セーブ・本番への接続なし。確定方針、回答待ちの推奨仕様、競合回避範囲、検証と再開条件は [PROGRESSION.md](PROGRESSION.md)。

## 2026-09-11 ステージクリア演出（公開済み）

戦場を背景に中央へSTAGE CLEARをアニメーション表示し、3.2秒後にリザルトへ。ソロ・協力の入口を共通化、報酬先行保存とBGM接続用イベントを追加。型・関連41単体・対象E2E2件・client/Worker build成功。配信7ファイル一致/API200。Version 63c84e07-1fee-4af6-be93-1e4642802d15。通常敗北待機／既存協力再出撃テストの未解決事項を含む詳細は [STAGE-CLEAR.md](STAGE-CLEAR.md)。

## 2026-09-11 兵士の停止・構え v7（公開済み）

走り→立ちで関節の回転補間が凍結し最後に跳ねる不具合を修正。下半身と上半身の遷移を分離し、0.18秒の停止・腰の向き戻し・足先経路と膝の接地補正を追加。足首幅54cm/前後差14cm/軽い膝曲げの構えへ。形状・骨格・材質・立ち以外14クリップを保持。型・関連9テスト・実モデル180停止条件・PC実入力・横持ち配布版・client/Workerビルド成功。既存Workerへ公開、Version `fc8ee188-e5f0-4417-9acd-0c81e833d9b7`。公開7ファイル一致/API200。実スマホ・インターネット協力は未確認。詳細・差分証拠は [TROOPER-STOP.md](TROOPER-STOP.md)。

## 2026-09-11 兵士の走り v6（公開済み）

指定YouTubeを参考に沈み込み・蹴り出し・滞空・腰と胸の逆回転を改善。走り4本と距離同期を変更、v5の造形/骨格/残る14本を保持。型・関連9テスト・4走り接地計測・5方向有限姿勢・配布版表示・client/Worker build成功。既存Workerへ公開、Version `bc5d9aa7-598b-4773-8fa7-1cb9b602348f`、公開7ファイル一致/API200。比較MP4をGoogle Driveへ保存。詳細・動画・制約は [TROOPER-RUN-V6.md](TROOPER-RUN-V6.md)。

## 2026-09-11 Standard Trooper v5（公開済み）

人体と服の連続性、装甲の配置、武器保持・持ち替えを修正。指定Chat監査で全4段階合格後、ユーザーの追加公開承認に従い本体適用・公開を完了。57骨・18試作モーション、装填3本を実装填時間に接続。元v4のモデル・スクリプト・GLBと元15Actionを保持。型・関連12テスト・実step/Rendererで逆順装備/射撃/装填/切替中の大型被弾/回避/再開始・配布版2サイズ・公開7ファイル一致/API200を確認。Version `d499d59f-d9b4-493b-b61d-0b2949306813`。瞬間的な干渉はユーザーのSF基準に従い許容、実機/インターネット協力は未検証。詳細 [TROOPER-V5.md](TROOPER-V5.md)。

## 2026-09-11 Standard Trooper v4（公開済み）

公開後もJS/4GLBのハッシュ一致、PC/横持ち操作、API正常応答を確認済み。

添付参照に合わせた白い密閉ヘルメット・胸部装甲・背面ユニットへ改修。ユーザー追加指示で通常立ちを股関節25cm→膝約36cm→足首47cmの逆V字へ。24→57骨格、指・3段背骨・つま先を実変形可能にし、スキン用の部品・材質契約と4配色APIを追加。15モーション・接地・武器受け渡し・4人分離・PC/横持ち実操作・型・関連9単体・client/Workerビルド・配布版2画面検証成功。既存Workerへ公開、Version `434603ce-9e09-4410-a023-1a4b23b55578`。詳細と監査証拠は [TROOPER-V4.md](TROOPER-V4.md)。ゲーム内スキン選択UIと同期は未実装。

## 2026-09-11 PLEAT半回転修正版公開

ユーザーの追加承認により公開完了。Version a42ea2da-792a-42d0-8271-f4c423c30a93。公開JS/CSS/GLBは検証済みdistとハッシュ一致。前段の公開保留は解消。詳細 assets/blender/candidates/crawler/pleat-v4/turn-fix/RESULT.md。

## 2026-09-11 PLEAT攻撃後の半回転修正（未公開）

回復中に古い照準地点を通り越すと後ろを向く不具合を再現し、地点ではなく攻撃yawを保持する修正。実Rendererで反転解消、型・12テスト・攻撃18条件・リセット6条件・ビルド成功。公開は自動承認レビューに拒否され保留。詳細 assets/blender/candidates/crawler/pleat-v4/turn-fix/RESULT.md。

## 2026-09-11 PLEAT v4公開

ユーザーの明示承認で既存Workerへ公開。Version 2e5595d6-8841-4aa6-bf73-884cb845bc9a。公開先 https://swarm-front.melosalife-24.workers.dev 。本番dry-run成功、配信GLB/JS/CSSはローカルビルドとSHA-256一致。詳細は assets/blender/candidates/crawler/pleat-v4/adoption/published/ 。

## 2026-09-11 PLEAT v4本体実装（ローカル・未公開）

crawlerをユーザー承認済みPLEAT v4へ接続。ant/spiderは既存HOUNDを維持。統合第3案の時刻・方向・履歴修正を適用。エネミーレポートは具体的戦闘数値・回避方法を直接書かない共通方針へ更新。型・関連34テスト・本体18条件・リセット6条件・PC/横持ちレポート・client/Workerビルド成功。既存PWAボタン追加時のタイトル収まり検査は失敗、実スマホ・途中参加の攻撃完全再現は未確認。詳細: assets/blender/candidates/crawler/pleat-v4/adoption/RESULT.md。

## 2026-09-10 ANOMALY造形規約・1体制作手順（文書整備のみ）

今回のユーザー決定を既存の [造形正本](STRUCTURE-ANOMALY-v2.md) 第1・2節へ統合。正体未確定、不完全な模倣、被覆・擬態の許可、非グロ表現、戦闘可読性を規定し、旧の正体断定・混合数義務を撤回。[1体制作テンプレート](art/ANOMALY_TASK_TEMPLATE.md) は既存Blender/GLB手順を再利用し、候補隔離・現行読込条件・証拠を明記。プロジェクトAGENTSから参照。基準モデルは未制作・未承認。モデル生成、既存素材差し替え、ゲーム仕様変更、公開なし。後続の記録は各時点の履歴として読む。

## 2026-09-10 屋外5マップの遠景（公開済み）

Blender制作の周辺市街・倉庫群/クレーン・煙突/タンク・森林/山並み・雪の稜線を追加。描画専用・raycast/影なし、地下は対象外。型・176単体・Blender再読込・切替回帰・配布版全12画面成功。既存Workerへ公開（Version `ab1048be-967e-4fc2-968f-296b8e290544`）。現状は天候派生データなし、将来の非表示切替口を用意。実機性能は未確認。制作データ・差分・最終公開検証は [DISTANT-SCENERY.md](DISTANT-SCENERY.md)。

## 2026-09-10 全6マップのBlender細密化・拡張（公開済み）

全6マップをBlenderで制作し、PBR画像テクスチャ・建物設備・草木・雪山・地底の岩肌を導入。屋外188×208m（縦横各2倍）、地底は幅と高さを維持して通路総延長315.777→631.554m。176単体・20面攻略・実Worker2画面同期・4接続の左右分岐移動成功。配布版のPC/横持ち全12画面でJSエラーなし、全GLB/JS/CSS一致。既存Workerへ公開（Version `ed291edb-6189-47bf-be26-5d9c9d9dd355`）。4画面SwiftShaderの連続入力テストは遅延で失敗、通信と表示を分離して検証。実機性能・4台操作感は未確認。詳細・編集データ・差分・公開検証は [MAPS-BLENDER.md](MAPS-BLENDER.md)。

## 2026-09-10 メニュー外観・装備2の枠外表示修正（公開済み）

前線指揮端末を意識した金属パネル・角を落としたボタン・枠を全メニューへ適用。装備2は実際の左欄高さに連動して収まり、再現条件で58.5px→0px。175単体・15メニュー・安全領域回帰・実Worker3件・配布版2サイズ成功。ユーザーの明示承認後、承認時の配布物とSHA-256一致する隔離ビルドを公開（Version 5e7b333c-bfe4-42d4-911a-85211554b2de）。公開版2サイズで表示・操作・保存・出撃/撤退と配布物一致、API正常を確認。別作業のマップ開発差分は保持。実装・検証・差分は [MENU-DESIGN.md](MENU-DESIGN.md)。

## 2026-09-10 メニューUI・UX刷新（公開済み）

武器庫の特殊効果を常時表示、出撃準備左欄のスクロール解消、設定分離・一覧位置保持・分解確認・ホーム/協力/結果の統一を実装。175単体・12メニュー・最終5サイズ・実Worker3件成功、サブエージェント独立監査のP1/P2解消。ユーザーの「公開承認」を受け既存Workerへ公開（Version `5af02375-6aba-4bdb-b69b-a118f6bc5afe`）。公開版の2画面サイズで主要操作・保存・出撃/撤退と配信JS/CSS一致を確認、ヘルスチェック200。仕様・検証・差分・公開状態は [MENU-UI.md](MENU-UI.md)。

## 2026-09-10 走りの再監査・兵士の細密化

腰上下差18.6→5.5cm、前傾8→17度、膝の過度な折り畳みを抑制。武器保持を含む走りと専用後退を追加。装甲・布・関節・背面装備を細密化したv3兵士へ。自己監査所見・検証・公開結果は [TROOPER-POLISH.md](TROOPER-POLISH.md)。

## 2026-09-10 片脚で蹴り出す走りを再制作

歩行に見えるRunを、着地・沈み込み・片脚の蹴り出し・滞空・膝の回復へ作り直した。形状と他11クリップは保持、v2 GLBで旧キャッシュを回避。武器切替0.5秒は継続。研究根拠・最終検証・公開記録は [TROOPER-RUN.md](TROOPER-RUN.md)。

## 2026-09-10 走り方向・武器切替短縮

走りの待機混入・足運び方向を修正し、移動方向へ脚を向ける。武器切替は射撃待ちも含め1秒→0.5秒。175単体、5方向のGLB足運び、PC/横画面、実Worker2画面を検証。既存Workerへ公開（Version `8512e285-8b74-45bf-bf24-26fc09dbadd9`）。詳細は [TROOPER-MOTION-FIX.md](TROOPER-MOTION-FIX.md)。

## 2026-09-10 Standard Trooper 導入

標準兵士をBlender制作・リグ・12クリップ・GLB化して既存Workerへ公開。ユーザー承認済みの切替1秒の射撃待ち、大型範囲攻撃のHeavy演技を連動。全175テスト、実Worker2画面で状態同期・回避無傷・大型被弾・2体描画を確認。Version `aa1a33b7-2ec9-48d6-bd24-1ad723b7524b`。実機とインターネット協力操作は未確認。詳細・ファイル・公開検証は [STANDARD-TROOPER.md](STANDARD-TROOPER.md)。

## 2026-09-10 撤退後の永久停止対策・HOUND派生表示修正

既存Workerへ公開。Version `5396d9a2-fa2e-4f0b-9fda-035e6eedbe89`。一時的な例外でフレーム更新が途切れないよう変更し、離脱時の描画状態を消去。VOLLEY/LEAPERへ採用済みHOUNDを適用。単体171件、ST16/ST20再出撃、40体fixture、例外注入回復を検証。実機での最初の停止原因は未特定、ミミズ型専用造形は旧型を維持。詳細は[RETREAT-FREEZE-FIX.md](RETREAT-FREEZE-FIX.md)。

2026-09-10 4体の正式モデル・個体別モーションを導入・公開済み（Version 6e102708-a10c-49ff-b0d0-107f22c7134c）。正式仕様・検証・公開記録は [ENEMIES-PRODUCTION.md](ENEMIES-PRODUCTION.md)。

2026-09-10 第一弾の独立監査4必須＋3改善をローカル修正。単体161件・実Worker4接続を含むE2E2件成功。確定・公開・commitは未実施。今回の正本と再監査証拠は [STRUCTURE-AUDIT-FIX.md](STRUCTURE-AUDIT-FIX.md)。以下の検証記録は各時点の履歴。

2026-09-10 STRUCTURE × ANOMALY v2をローカル実装。HOUND / PRISM / RAY / FOUNDRY ZEROへ置換し、標的AI・予兆・非昆虫モデルを導入。基礎HP/攻撃力とwave枠を維持。公開・push・mergeなし。新しい敵世界観の正本は [STRUCTURE-ANOMALY-v2.md](STRUCTURE-ANOMALY-v2.md)、今回の検証・差分・制約は [STRUCTURE-v2-VALIDATION.md](STRUCTURE-v2-VALIDATION.md)。以下の公開記録は過去版。

2026-09-09 全10面を再設計し20ステージへ拡張（公開済み、Version 6440b7cb-b300-4efc-b69e-797782e1f109）。2〜5波、開幕ボス、最大3体同時、全ボス波に護衛、最後の全敵撃破で勝利。詳細は [STAGES-20.md](STAGES-20.md)。

# 開発状態

2026-09-09 巨大ミミズの3倍速周回・空中移動・各節酸攻撃・独立HP・分裂後2倍速を実装。138単体検証と2人実協力同期／画面E2E3件合格。ユーザーの明示承認後に公開済み（Version 50380a01-ab16-486a-8c40-460e2b7a24d8）。公開配信JS一致・出撃・API正常応答を確認。仕様・証拠は [WORM-SPLIT.md](WORM-SPLIT.md)。

2026-09-09 ST10・16を「晶脈の地底巣」へ刷新して公開。筒状の岩壁・天井、2つの環状ルート、分岐と袋小路、敵と巨大ミミズの経路探索を追加。129単体・全20面攻略・4人実通信で左右分離を確認。現行洞窟仕様は [UNDERGROUND-NEST.md](UNDERGROUND-NEST.md)。

2026-09-09 草原・雪山・細長い分岐洞窟を追加し全6マップへ拡張、公開済み。127単体検証・全20面自動攻略・6マップ画面・実協力同期・公開配信確認成功。現行配置・制約・証拠は [MAPS-6.md](MAPS-6.md)。

2026-09-09 エネミーレポートを攻撃方法・移動方法中心へ整理して公開済み。数値・登場ステージを撤去し、クラウンの通常型／巨大ミミズ型を明記。検証と証拠は [BESTIARY.md](BESTIARY.md) 末尾。

2026-09-09 敵図鑑をエネミーレポートへ刷新。敵一覧から解説・回転拡大できる3Dモデルを表示、巨大ミミズ形態切替。タイトルのスクロール解消。詳細は [BESTIARY.md](BESTIARY.md) 末尾。

2026-09-09 タイトルに敵図鑑を追加・公開済み。全6種の基本HP・攻撃力・通常速度と行動説明を閲覧可能。PC・スマホ横4サイズのローカル／公開検証成功。詳細は [BESTIARY.md](BESTIARY.md)。

2026-09-09 協力入口の横画面を2列にし、縦スクロールを解消・公開済み。高さ300pxを含む4サイズで検証。詳細は [COOP-ENTRY.md](COOP-ENTRY.md) 末尾。

2026-09-09 ルーム作成・参加前の武器選択を撤去し、専用1列画面へ変更・公開済み。ローカル4人実通信・公開3サイズで検証。詳細は [COOP-ENTRY.md](COOP-ENTRY.md)。

2026-09-09 ロビー招待操作を見出し横へ移動、左OPERATION下部に準備・大型出撃ボタン、右下チャット枠を拡張して公開済み（Version b179ab95-3d9e-464e-97a7-171d807d60bd）。4人実通信・4画面サイズ・公開配信一致を検証。詳細は [COOP-LOBBY.md](COOP-LOBBY.md) の末尾。

2026-09-09 協力ロビーの横画面2×2配置・右下チャット（仮）・隊員装備一覧・準備中共有・ホストステージ同期を実装、4人実通信とサーバー制限を検証済み。ユーザーの明示承認後に公開済み（Version f0df7e06-c697-4d14-8cf5-272907922160）。正本は [COOP-LOBBY.md](COOP-LOBBY.md)。

2026-09-09 全6種を機械生物へ刷新・公開済み。種類別の輪郭を保ち、脚なしの環状装甲ミミズ、4枚金属羽根の蜂、関節脚、発光部、薬液タンクを実装。現行仕様と証拠は [MECHA-DESIGN.md](MECHA-DESIGN.md)。

2026-09-09 接地の上下揺れ・蟻の脚・蜘蛛のジャンプ専用移動と壁姿勢・蜂の高度選択を修正・公開済み。97単体・型・Chrome検証成功。公開PC・スマホ幅で配信JS一致・出撃・射撃・API応答を確認。詳細は [ENEMY-MOTION-FIX.md](ENEMY-MOTION-FIX.md)。

2026-09-09 敵ごとのランダム追跡・全ステージの待機敵を公開済み。仕様と検証・公開記録は [ENEMY-BEHAVIOR.md](ENEMY-BEHAVIOR.md)。

2026-09-09 酸の放物線・実弾の連射表現・ミサイル爆風と範囲表示を公開済み。静止プレイヤーを酸が通り抜ける問題も修正・公開済み（狙い位置で胴体高さを通す）。仕様・検証は [COMBAT-EFFECTS.md](COMBAT-EFFECTS.md)。

2026-09-09 武器庫のレア度別詳細枠・一括分解・武装片保存を公開済み。名称は「武装片」、獲得量はR:1 / SR:3 / SSR:10 / LR:30。仕様・検証は [DISMANTLE.md](DISMANTLE.md)。

2026-09-09 回避ローリングモーションを公開済み。回避性能は維持し、回転・脚の引き寄せ・武器の抱え込みを追加。公開Version・検証は [ROLLING.md](ROLLING.md)。

2026-09-09 武器庫ヘルプを28pxに統一、出撃準備の選択枠を縮小し説明を下段に全幅表示、一覧の?を削除して武器名の欠けを解消。公開済み。検証・Versionは [FILTER-HELP-UI.md](FILTER-HELP-UI.md)。

2026-09-09 武器ヘルプ・残弾装填・撃退散弾・誘爆弾頭・ショットガン基本貫通を公開済み。現行仕様・検証・公開Versionは [WEAPON-EFFECTS.md](WEAPON-EFFECTS.md)。

2026-09-09 戦闘HUDをコンパクト化して公開済み。HP・ステージ・武器を異なる形で表示。公開Version・検証は [COMBAT-HUD.md](COMBAT-HUD.md) を参照。

2026-09-09 全10ステージ・3マップと段階的な難易度／ドロップ調整は [STAGES.md](STAGES.md) が正本。

2026-09-08 武器庫の視認性改善は [ARMORY-UI.md](ARMORY-UI.md) を参照。一覧と選択詳細を分離し、同系統装備との差分を表示。

2026-09-08 のホーム武器庫変更は [HOME-ARMORY.md](HOME-ARMORY.md) が正本。結果での整理を廃止し、整理待ちを端末保存してホームの武器庫で扱う。以下の結果画面・整理に関する旧記録は履歴。

現行のmobile UI監査修正は [MOBILE-AUDIT-FIX.md](MOBILE-AUDIT-FIX.md)。記録と画像はdist-validationに統一し、最終HEADのchecks.jsonを照合する。

現行のスマホUI改善は [MOBILE-UI.md](MOBILE-UI.md)。P1基点3bdb438からfeat/mobile-uiで作業。

現行P1修正は [P1-AUDIT.md](P1-AUDIT.md) と Git除外の ../dist-validation/checks.json を参照。以下の検証件数・測定は修正前 eb39568 の履歴であり、今回の合格証明ではない。

2026-09-06 / 初回ローカル版。正式名称未定。カタモン・Sparkling Hollowとは独立。

担当交代の引き継ぎは [HANDOFF.md](HANDOFF.md)（2026-09-08 作成）。

## 実装済み

- 市街地、三人称視点、歩兵、移動・手動照準・射撃・装填・切替・回避。
- 雑魚2種類、3ウェーブ、ボス、勝敗、蘇生、人数別HP調整。
- 3武器系統、3レア度、個別戦利品、貫通／高速装填、比較、装備、保存、再出撃。
- 独立ポインターによるスマホ同時操作、入力解除、横持ち案内、感度・音量・品質設定。
- 実Workers＋SQLite-backed DO＋WebSocket、4人上限、サーバー権威、補間・移動予測、再接続、受付・入力の制限。
- 同じタブの再読み込み後に、参加者トークンをURLへ出さず「進行中の部隊へ戻る」から30秒以内の同一隊員・戦闘状態へ復帰。
- 協力で倒れた隊員は作戦終了まで蘇生可能。観戦中の入力不能を放置と誤判定して切断しない。
- manifest、Service Worker、ホーム画面追加による横画面PWA起動。画面本体のみをキャッシュし、協力通信は常にネットワークを使用する。
- 公開先は <https://swarm-front.melosalife-24.workers.dev>。`wrangler.production.jsonc` の同じCloudflare Workerが静的画面と `/api` の協力通信を配信する。公開時のルーム作成はTurnstileの人間確認をサーバー側で検証するため、作成キーの入力・共有は不要。検証SecretはCloudflare Secretにのみ保存する。
- バージョン付き端末保存、重複防止、上限・保存エラー・壊れたデータの扱い。
- **出撃準備を左右2カラムにした。** 左は固定の情報欄（見出しと出撃ボタン・ステージ・装備・武器庫の在庫・
  整理・設定）、右は武器一覧だけのスクロール領域。一覧は横1行1丁をやめてカードのグリッドにし、
  出撃ボタンは左カラム上部に固定し、スクロールで隠れない。
- **装備はスロットを選んでから武器を選ぶ方式。** カードごとの「装備1／装備2」ボタンを廃し、
  左カラムの装備1・装備2を押して対象スロットを決め、右の一覧を1行タップで入れ替える。
  一覧は縦1列・1行1丁（40px・行全体が操作対象、Enter/Space も可）。
  数値は表形式。「武器／威力／装弾／装填／射程／連射」の見出しを一覧の先頭に1本だけ置き、
  各行は数字だけを同じ列に並べる（項目名を8行ぶん繰り返さない）。見出しはスクロール領域の
  **内側**に置いて追従させる。外に出すとスクロールバーの幅ぶん列が行とズレる。
  リザルトの戦利品一覧には見出しが無いので、そちらは各行のラベルを残す。
  レア度は `R` / `SR` / `SSR` / `LR` のバッジを武器名の横に置き、左端の色帯は残す。
  **威力・弾数・装填・射程・連射の5項目すべてを個体ごとに振る**（`Weapon.rolls`・帯域 0.80〜1.25倍）。
  振れ幅が基準の上下にあることが要で、上振れだけにすると全項目最大の1本が再び全てを支配する。
  実効値は `stats()` に集約し、戦闘・HUD・武器庫がすべてここを通る。
  **レア度は抽選せず、5項目の平均（`quality()`）から読む。** 実測 R 64.7% / SR 29.1% /
  SSR 6.0% / LR 0.23%（約29周に1本）。LRは平均が `LR_QUALITY` 以上かつ効果ありのときだけ。
  **完全上位互換の発生率は約2.2%**（旧設計では威力しか振れず、2本並べれば必ず一方が上位互換だった）。
  装填だけは小さいほど良いので `LOWER_IS_BETTER` で反転させる。弾数は整数丸めで最低1発を保証
  （ロケットは基本2発のため、割合だけで丸めると半減する）。
  **威力の上限はレア度に紐付けない**。低レア度でも威力だけ高い個体は正当に存在し、
  その分を他項目で払っている。各数字は自分の帯域内の位置で色を変える（上位20%＝金・下位20%＝くすみ）。
  `rolls` が無い旧セーブは全項目1.0＝基準値として読むので移行不要。
  **色だけの区別にはしない**（ミントとゴールドは最も見分けにくい組み合わせのため）。
  特殊効果は独立した列にし、値そのものに数字を入れる（`貫通 ×3` / `装填 -20%` / `—`）。
  別置きの凡例にすると視線が往復するので置かない。全文（`貫通：最大3体` など）は
  整理欄とレア度バッジの `title` に残す。装備中の印は `E1` / `E2` のバッジ。装備すると機械的な効果音が鳴る。
  **`Sound.play()` は生成直後のAudioContextで初回を握り潰していた**（`currentTime` が0のため
  45msガードに掛かる）。`unlock()` で `last` を負にして解消。装備音に限らず全ての初回音に効く。
  **すでにもう一方のスロットに着けている武器を選ぶと入れ替える**（同じ武器が2枠に入ると
  `parseSave` の検証を壊すため）。装備中の行には「装備中1／2」を表示する。
- **武器の所持上限を系統ごと8丁にした**（`LIMITS.perKind`）。全体80丁の中から捨てる物を選ばせる
  形は「何を比べればいいか分からない」ため、溢れた系統の中だけを提示する。リザルトと整理欄は
  どの系統が満杯かを名指しする。旧データは起動時に系統ごと8丁へ整理し、装備中は必ず残し、
  レア度・威力の低い順に手放す（`trimToKindCap()`）。何丁手放したかを画面に表示する。
- 救助する側への蘇生フィードバック。距離・視線・長押しのどれを満たしていないかを画面とボタンに出す。
  対象がいない時はボタンを無効の見た目にする。サーバーの蘇生条件・入力・通信は変更していない。
- 北固定のミニマップ。建物、敵（種別で色分け）、味方、ダウンした味方の輪、自分の向き。
  建物はリサイズ時のみ焼き直し、描画は10Hz。優先順位は [BACKLOG.md](BACKLOG.md) を参照。
- 一時停止メニュー。戦闘中の離脱ボタンを廃し、配置変更できる一時停止ボタンから開く。
  感度・音量・ミニマップ向きを戦闘中に変更でき、離脱は失う未確定品の数を示して確認を挟む。
  ソロは実際に停止し、協力は止まらないことを明記する。視点感度は 0.1〜6.0。
- **試験実装の空中敵「蜂」。** 敵に高度 `y` を持たせ、当たり判定を `eye()` へ集約した。
  地上の敵は `cruise: 0` のまま挙動不変。蜂は建物を越えて直進し、7m以内へ寄ると高度1.2mまで
  降りて接触攻撃し、離れると6.5mへ戻る。ウェーブ2以降に2割の確率で出る。
  ミニマップでは高度1.5m超を中抜きの輪、それ以下を塗りで描く。
  **建物は貫通せず、屋根より高く登って越える**（`blocked()` が高度を見る・`roofHeight()`）。
  **2026-09-09: 針・壁への静止をローカル実装。蟻・蜘蛛・ST5/10の多関節ボスも追加。詳細と検証は `ENEMIES.md`。人間の体感調整は未実施。**
  照準補助は自機とおおむね同じ高さの相手にしか働かないよう制限した（下記）。

- **与ダメージの数値表示。** `hit` イベントに `amount` と着弾高度を載せ、敵のいる世界座標へ
  貼り付けて浮かせる（カメラを振っても数字が敵から離れない）。空中の敵は高い位置に出る。
  DOM要素は使い回し、同時28個まで。**味方のぶんは設定で選ぶ**（自分のみ／味方も／表示しない・既定は
  自分のみ）。4人分を常時出すと画面が数字で埋まるため。味方のぶんは小さく淡い色にする。

- タイトル右下に更新履歴ボタン。`src/client/changelog.ts` に日付ごとの項目を持つ。
  **遊ぶ人向けの言葉で書く**（コミット文をそのまま載せない）。内容は実際のコミット履歴から起こす。

## 実際に検証済み

初回ローカル完成条件1〜10に対応する検証を実施。現行は単体25件、実通信結合7件、ブラウザ16ケース。インターネット・実機2台についての完成宣言ではない。

ソロの勝利から装備・再読み込み・再出撃、敵攻撃による敗北から再出撃。2つの独立Chromeコンテキストで協力戦場を共有。4接続と5人目拒否、2接続の敵HP・撃破数の一致、再接続、サーバー上の蘇生と個別報酬再受信。スマホ画面で3点同時タッチ。40敵の描画。通常・Pagesサブパス・Worker dry-runビルド。詳細はTESTS.md。

横画面のリザルトは左側に戦績と再出撃、右側に独立スクロールの獲得武器一覧を表示。同一Wi-Fi版の協力は、ホストのルーム作成、招待リンク共有、参加者のリンク起動から参加までを通常画面だけで進められる。公開版ではホストのTurnstile人間確認後に招待リンクを発行する。

## 未実装（今回の範囲外／残る制約）

- 外部リポジトリ・PR。
- 戦闘中のサーバー再起動からの完全復旧。中断を明示する。
- クラウドセーブ、持込武器の入手履歴の証明、完全な改ざん防止。
- 複数兵種／マップ、乗り物、大規模破壊、合成、ランキング、課金。

## 空中敵の設計判断（2026-09-07）

**照準補助を高さで制限した。** 従来の補助は横方向の角度と距離しか見ておらず、水平に撃つだけで
上空6.5mの蜂へ弾が吸い付いた。これを許すと「上を見上げる」必要が消え、空中敵が色違いの雑魚になる。
`Math.abs(eye(t.e) - 1.5) < 2` を条件に加え、自機とおおむね同じ高さの相手にだけ働くようにした。
ボス（`aim: 3`）と地上敵は従来どおり補助対象で、蜂も降りてくれば対象に戻る。

**ミニマップの高度表現は「空中かどうか」までしか答えない。** 平面の地図に高さを描き込むと、
情報が要る瞬間に一番読めなくなる。「どこに」は地図、「どのくらい上に」は3D画面という分担。
EDFはミニマップが視点に追従して回転するためこの分担が成立していた、というのがユーザーの指摘。

**回転は端末設定にした**（`Save.mapRotates`・任意項目なので既存セーブは無傷）。
どちらが正しいかを今決めずに済ませるため。回すと自機中心・進行方向が上・半径42mの
円形ビューになる。回さないときは従来どおり街区全体を北固定で映す。初期値は北固定。

**引き撃ちの是正（2026-09-07）。** プレイヤーは7m/sで、これまで全ての敵がそれより遅かったため、
下がりながら撃つのがノーリスクで常に成立していた。射程65mのライフルは街区のほぼ全域に届く。
対策は2つ。ライフルに22m超から距離減衰を入れた（最大45%まで低下・`falloff()`）。
蜂の速度を8.2m/sにして、**唯一プレイヤーより速い存在**にした。ロケットは減衰なし＝遠距離の答えとして残す。
**人間による難易度評価は未実施。** ボットは照準が完璧なので勝率の目安にならない。

## 未検証

- 公開URLからのルーム作成キーによる協力出撃、インターネット経由の遅延・パケット損失。
- Android実機2台でのLAN協力出撃と、戦闘中のページ再読み込みから同一参加者への復帰はユーザー確認済み。PWAの実機インストール、安定30fps、熱、電池消費は未検証。
- Cloudflare本番契約・無料枠使用量・1時間連続の本番測定。
- 実プロセスクラッシュ／DO退避を強制したサーバー再起動の復旧契約。
- 人間による初見攻略難易度、継続して遊びたくなるバランスの評価。

## 次の開始地点

0. 蘇生フィードバックとミニマップは公開済み。**ミニマップの実機表示はユーザー確認済み（2026-09-07）**。
   蘇生は `e2e/rescue.spec.ts` が2ブラウザで実ルームを張り、prompt・ゲージ・蘇生完了まで通す。
   **Android実機での蘇生操作は未確認**（PC2ブラウザでの通過をもって実機合格としない）。
   当初疑った `visible()` の高さ1.2m判定は、蘇生が完了することを確認したため現時点で無罪。
1. Android実機2台で、修正後の時間無制限蘇生、観戦継続、個別報酬を確認。
2. Android実機でホーム画面へ追加し、横画面起動と短い通信断後のソロ開始画面を確認。
3. 公開URLでホストがルームを作成し、Android実機2台の協力・PWAインストールを確認する。
4. Android実機で横持ち・3点入力・1ミッション・40敵、FPS・発熱を検証。
5. 独立監査はユーザーから再開指示があるまで休止。本番公開は2026-09-09のユーザー指示により、別指示がなければ必要な検証後まで一貫して実施する。

全履歴や他作品の引き継ぎを読み込まない。このフォルダが本作の正本。










## 2026-09-12 下向き移動のカメラ振動
カメラ位置と注視点の補間基準を統一。原因・差分・修正前後の計測は docs/CAMERA-JITTER.md。
