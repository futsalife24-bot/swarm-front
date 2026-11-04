# 生存改修の公開記録（2026-11-04）

- 公開先: https://swarm-front.melosalife-24.workers.dev
- 実装PR: https://github.com/futsalife24-bot/swarm-front/pull/269
- 実装HEAD: `c0a321a2fb9fe5d4bdde90d690928f0d408029c9`
- 公開ソースmain: `5708e80234108137ab40747173f97e89f64159f7`
- Worker Version: `461eb914-8134-4c69-832e-73d9aab5f355`
- 配信開始: 2026-11-04 16:17 JST、100%配信を確認。
- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`
- 記録branch: `codex/survival-release-record-20261104`

専用ライフル・共通カード表示・レベルアップカットイン・ボス宝箱と、初期8種/進撃解放/除外/再抽選/兵士の適性/専用難度を一緒に公開した。[仕様とローカル検証](README.md)。既存のカード所持と防衛のデッキは保持する。

## main反映と公開

通常公開の継続承認と2026-10-15の監査方針に従った。公開直前のmainは `24cbbae65568c9a034214a421e13627abfd886f9`、mainの保護なし・rulesetなし・Actions workflow 0・PR check 0を確認。独立監査は未実施。保護無効化や管理者バイパスを使わず、検証済みHEADを指定して通常mergeした。

cleanなmainへfast-forwardし、`npm run build:production`、`npm run server:build:production` を成功させてから、既存 `wrangler.production.jsonc` で公開。新しいサービス・契約・権限は追加していない。merge本文の日本語 `Player-Note` が公開buildに含まれることを確認した。配信ログは17ファイル更新・378ファイル既存、Worker 478.11 KiB（gzip 122.39 KiB）。

`wrangler deployments status` で上記Versionの100%配信を確認。`/api/health` は200、`ok:true`、`transport:websocket`、`authority:durable-object`。

[配信照合](production/delivery.json): dist内の全HTML・JS・CSS・JSON・Webmanifest、51件のSHA-256が公開応答と一致。今回変更していない画像・音声・3D素材の全量照合は対象外。

## 公開版の実画面

隔離した新規Chrome、844×390・640×360、実ユーザーの保存とCookieは不使用。生存の確認はOS相当の動き軽減、共通基地は通常の動き。進撃突破fixtureを公開サーバーへ送っていない。

- [生存の検査結果](production/survival.json): 初期8種、未獲得14種、専用ライフル1本、3択選択、戦闘開始、取得状況、カード一覧と準備の往復を2サイズで成功。防衛2武器・旧デッキ・共有保存の不変、ページ例外0も確認。
- [共通基地の34項目](production/base-report.txt): 生存タイトル→基地→育成/武器/アクセサリ/生存カード→基地、進撃側の共通基地、準備への戻り、古い協力接続情報があっても基地を開くことを成功。表示のはみ出し/重なりなし、ページ例外0。
- [公開640の3択](production/640-choices.png)、[公開844の融合一覧](production/844-fusions.png)、[公開640の戦闘](production/640-battle.png)を目視確認。

公開環境での複数人通しプレイ、実スマホ、長時間の難度/描画負荷/電池消費は未確認。協力の個人別解放・再抽選・再接続と宝箱はローカル実Worker/WSで検証済み。5分の成長計測は通常Inputの機械操作で、人間の熱中度や勝率の実測ではない。火炎・氷結・電撃など新属性とバディは後続。

専用の開発Viteとローカル検査Workerは停止。ほかの作業tree・本人のブラウザーは変更していない。主担当の実モデル/推論設定は取得不可。子1体は指定 `gpt-6-sol` / `medium`、共有戦闘と計測・限定的な読取助言のみ、主担当が統合と公開を担当した。
