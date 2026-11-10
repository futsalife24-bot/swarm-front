# 既存Worker公開・配信確認（2026-11-10）

本人の「すすめて」を、直前に確認した既存Worker公開の承認として実施。新規公開先・契約・権限・依存・製品変更はない。

- 公開元main: 769353b21567ad9f0c2251d0c439c50edac9a077（PR297・298・299反映済み）。専用worktree task-resume-catena-20261110、記録branch codex/release-resume-20261110。公開直前の実remote mainと一致、clean。root他担当12差分・別worktreeのmainは保護した。
- 公開先: https://swarm-front.melosalife-24.workers.dev 。旧Version 42fb8817-67cc-4d0f-b478-73a12aeedc00 → 新Version abe7ecdb-5026-4c71-a0b6-f080028654e1。2026-11-10 07:06:01 UTCのdeployment、100%配信をWranglerで確認。
- 公開設定は既存wrangler.production.jsoncのまま。Room/Gate SQLite DO、PROJECT_HUB、既存公開site keyのみ。ローカル検証用varsは本番bindingに含まれない。

## 実行結果

- npm run build:production: exit 0、290 modules。Vite表示9.12秒は全コマンド所要時間ではない。自動更新履歴生成を含め最新mainから再生成した。埋込build SHA一致、manifest revision 3a8a6ebbf6308cb826be772ada68d615c457517f5efb37210e7d32177fb6e028。
- npm run server:build:production: 正式権限でexit 0、466 assets、526.00 KiB / gzip 135.20 KiB。初回sandbox実行は標準ログパスのEPERMを伴ったので、正式権限で同じdry-runを成功させた。Hookや設定の迂回なし。
- node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.production.jsonc: exit 0。16 assets更新、405 assetsは既存。deployments statusで新Version 100%を確認。
- 既存verify-release-delivery.mjsで公開ゲーム本体36ファイルのSHA-256一致、health 200/ok。HARROWとCATENAのGLB2件も公開bytesとビルドSHA一致。CATENAの形状は公開GLBと描画コードで作るため、素材配信と実戦遭遇確認を区別する。
- 公開URLの実Chrome、隔離保存/SW block、844×390と640×360で協力入口・通常ソロ出撃・実戦・一時停止を操作。pageerror 0、協力入口の横あふれなし。初回844はconsole error 0、初回640は透明文字のconsole出力4件により検査exit 1。発生元を記録する640再検査はconsole/pageerror 0で再現せず、戦闘・停止・再開成功/exit 0。初回4件の根因は未特定。初回の失敗を消さず両結果を保存した。主担当が640実戦と844停止画像を目視確認。
- 本番協力2clientは正規Turnstileを75秒待ったが未完了、部屋作成/WS接続前で終了。received 0、pageerror 0、状態はunverified。鍵・secret・fixture・認証回避を使わず、本番協力戦闘成功とは扱わない。ローカル実Workerの支援7件・CATENA36状態・密集通信成功は前回INTEGRATED.mdの結果であり今回本番結果と混ぜない。
- git diff --check: 成功。追加変更は公開記録・検査スクリプト・証拠だけ。

## 公開前点検

既存手順で公開前の確認を実施した。認証・契約・アカウント使用量の詳細はローカルの非公開記録へ保存し、今回の公開GitHub資料から除外した。公開Versionは従来の公開記録と同じリリース識別子であり、認証値ではない。

## 引き継ぐ制約

既存全体22失敗・format14警告は未修正。前回全体1752件は1729成功/23失敗、その追加1件は試験のv1指定修正で関連9件成功、修正後全件再走ではない。今回製品差分0のため全件を繰り返していない。

実Android/iOS・実回線・公開版CATENA遭遇・本番協力戦闘は未確認。補給演出は表示専用で本番抽選/券消費/保存に未接続。候補2リファクタは開始ゲート不合格で未着手、候補3も未着手。縦横モックは別branchで本番未反映。

通常タスクの独立Chat監査は追加していない。主担当の実モデル/推論設定は未確認。子harrowは既存設定gpt-6-sol/high、公開手順の読み取りと検査スクリプト準備のみ（実ランタイム設定は未確認）。

## 記録の送信範囲

初回のcommit/pushは自動承認レビューが非公開運用情報の共有範囲を理由に拒否したため未実行。アカウント使用量・契約・認証APIの詳細を公開資料から外し、既存Workerの公開結果・SHA・UI検査に限定した。同じGit操作を正式審査へ戻し、別経路で迂回しない。

限定後の同じcommit/pushは正式審査で承認・成功し、記録HEAD 392109cab76bd27fb0536748af6dcca3b8892462を[PR300](https://github.com/futsalife24-bot/swarm-front/pull/300)へ保存した。送信範囲は18ファイル（STATEを含む）、秘密パターン0・100 MiB超0。mainの保護/rulesetは0件と読取確認。既存CIを無効化していない。
