# 協力画面・基地デッキと全体UIUX改善の公開（2026-10-07）

正本: https://github.com/futsalife24-bot/swarm-front
作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

## 変更・監査・公開

- [PR144](https://github.com/futsalife24-bot/swarm-front/pull/144)を通常merge。公開ソースはmain `7bc6ac48289e8e5d153074cf4e4b266742985240`。merge本文の`Player-Note:`に日本語の更新説明を保持。
- 協力画面にタイトルの2列配置が残る幅崩れを修正。基地は既存の強化画像・効果説明・融合9レシピ・名前付きデッキ3枠を実装。デッキ保存と出撃適用を区別し、未解放・破損・保存失敗を保護。融合の実ルールは変更していない。
- 改装版と従来版を同じUIUX基準で確認。長い合成確認の操作を既存ヘッダーへ収め、安全領域と短横画面のボタン寸法を改善。武器1行表示・完全表示件数を維持。
- [通常Chatの独立監査](https://chatgpt.com/c/6ac5e3c4-0174-83e8-84b7-cee77d5e1e11)は初回P2が2件。未保存デッキ名の消失と小さいヘッダーボタンを`cd29362`で修正。[再監査の確定回答](evidence/base-decks-20261007/audit-final.md)は対象`2a5639d5c289857efaec2e6da3782589cf01003d`に対し**必須P0/P1/P2各0、全体UIUX合格**。対象以降の製品変更なし。
- 公開Workerは既存`swarm-front`、Version **`a35b1e09-bbd1-4f1d-b00a-0d2bf6e7db80`**。統合mainからbuildと`wrangler.production.jsonc`のdry-runに成功後、同じWorkerへ公開。既存Free契約は同日のPR142公開前に確認済み。新規サービス・課金・権限変更なし。
- [公開版](https://swarm-front.melosalife-24.workers.dev/front)。従来版は同じドメインの`/`。

## Windowsで実行した検証

依存は直前PR142の`npm ci`と同じlockfileを使用。今回の型・front77・save147・関連E2E11＋戦闘UI6、基地6条件/実時間動画6本、実ローカルWorkerの協力作成/一覧/別ブラウザ参加/準備/退出、共通メニュー108画面、結果fixture20画面、安全領域8画面、武器一覧8条件が成功。メニュー演出と実通信の週間報酬も確認。[対象と限界](BASE-DECKS-UIUX.md)。

監査修正後は型/front77、未保存名の回帰6条件、全108画面のヘッダーボタン152箇所（最小44×36px）、最終武器8条件を再実行。武器の完全表示件数は1280幅11件、915/844幅6件、640幅5件を通常/整理とも維持。修正commitと公開mainのbuild/dry-runも成功。保存147・協力実通信・戦闘UI等は修正に影響のない初回結果を再利用し、修正後に再実行したとは扱わない。

## 公開後の照合

HTML・JS・CSS・SW・タイトル背景の26/26ファイルがmainビルドとSHA256一致、healthはHTTP200/`ok:true`。公開直後の初回は12ファイルが不一致で、各応答が同一ハッシュだった。約30秒後の直接取得ではJavaScriptとして正常応答し、通常の全件再取得で26/26一致。初回ログも保存する。原因を特定済みとは扱わない。

公開Windows Chrome検査の初回は、融合表示へ切り替えた直後の6画像を未読込と判定して停止。6画像の本番HTTP200/image/pngとローカルSHA256一致を別途確認。検査側に画像の`complete`待ちを追加し、自然幅0の壊れた画像は引き続き不合格とする。ゲーム本体・公開物は変更していない。初回ログと補正後の結果を分けて保持。

補正後の公開Windows Chromeは、844×390/640×360/1220×413×通常/reducedの6条件で、デッキ保存・呼出し・再読込・出撃適用・未保存名保護・融合素材・協力画面の幅が成功。全条件でService Worker制御を確認し、横overflow/画像破損/pageerror/console error各0。読み込み待ちの実測は最大1,365ms、完了後に全画像の自然幅が得られた。[結果](evidence/base-decks-release-20261007/public/base-checks.json)。

さらに`check-front-prep-published.mjs`で公開`/front`の最終準備画面を844/640×通常/reducedの4条件で確認。共通ヘッダーボタン44×36px以上、画面内、横overflowなし、pageerror/console error各0。最終画像を補完した。[結果](evidence/base-decks-release-20261007/prep/checks.json)。公開検査は新規の隔離コンテキストを使い、本人の保存や公開ルームを変更していない。

IABの追加目視は「別のタブでゲームを開いています」の保存保護で進めず未確認。再開や強制解放、他タブ操作をせず確認用タブのみ閉じ、UI031を返却。保護画面のconsole errorは0。IAB成功とは扱わず、公開版の検証根拠は上記Windows Chrome10条件と画像に置く。[記録](evidence/base-decks-release-20261007/iab-ui.json)。

## 任意・未確認

- 監査の任意3件は永続化DTOの分離、未保存名回帰のCI常時化、最終padding適用後の改装版準備画像の補完。前2件は今回未変更。画像は公開版4条件で補完済み。
- 監査側はZIP/manifest/Git blob/ソース/差分適用/構造化JSON/画像を独立照合。型は依存がないため再実行不能、Windowsテスト/build/dry-runは提出ログの照合。監査側の独立実行成功とは扱わない。
- 実機タッチ、実際のタブ非表示cleanup、GPU長時間、全敵モデル、全ミッション実通過は未確認。結果fixtureやタッチエミュレーションと区別する。
- 戦闘演出と兵士音声PR137は保留。使用モデルID・推論設定は未確認。
- 公開記録は`codex/pr144-release-record-20261007`、[PR145](https://github.com/futsalife24-bot/swarm-front/pull/145)に保存し、通常mergeでmainへ反映。製品変更を含まないので追加デプロイは不要。
