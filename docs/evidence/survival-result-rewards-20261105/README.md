# 生存終了時の獲得報酬画面

本人依頼: 「生存モード終了時の獲得報酬画面がない」。2026-11-05。

[PR #281](https://github.com/futsalife24-bot/swarm-front/pull/281)で通常main反映済み。mainからの配布物と通常ソロ2サイズも確認済み。既存Worker公開は現在の無料契約確認待ち。[反映・配布物・停止理由と再開](RELEASE.md)。

確認した原因: `src/client/front-app.ts` の終了画面は時間・強化回数・連鎖・融合と保存結果の合計文のみで、獲得武器の一覧がない。既存の `saveFrontRunRewards` は報酬を保存している。報酬付与の不具合と断定していない。

正本: https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`、branch `codex/survival-result-rewards-20261105`、開始時base/HEAD `aa0e1fe15284a42fe08bdbc7036ae0c506eb2f99`。開始時clean、最新mainから専用branchを作成。rootの既存差分と他worktreeは保持。

## 実装と検証

- `front-result-rewards.ts`: 本人の確定報酬だけを表示用データへ整える。既存のコイン計算を使用し、宝箱分は内数。所持済/超過保留/未保存、別作戦の状態、報酬対象外を区別する。保存処理・形式・戦闘・報酬条件は変更しない。
- `front-result-rewards.test.ts`: 帰還/全滅/短時間、宝箱、協力の本人分、途中退出、保留/未保存、保存失敗→再試行/再接続の二重付与防止を検証。
- 本人が「はい」で今回の修正概要・作業パス・担当範囲をClaude Codeの既存「リモート指示用」へ送ることを承認。実送信と依頼書/報酬データの実読取返答を確認した。[依頼と納品](../../SURVIVAL-RESULT-UI-HANDOFF-20261105.md)。Claudeデザインが表示専用UIと既存武器行の読み取り専用版を担当。主担当は表示データ、front-appへの接続、保存/通信/製品検証と記録を担当。
- `front-result-ui.ts/.css`: コイン・功績・武器数の要約と、レア/名前/恒久Lv/効果/全性能/保存状態の1丁1行。武器0丁の取得条件、未保存、上限保留を表示。戻る見出しを固定し、長い一覧だけスクロールする。既存のテーマ・武器行を継承し、新しい画像/音/依存を追加しない。
- `gear-weapon-list.ts`: 既存の性能セルと共通見出しを再利用する表示専用の `gearReadOnlyRows` を追加。結果画面に装備/解体/ロック操作を付けない。特殊効果の既存説明ボタンは維持。
- `scripts/check-survival-result.mjs`: 隔離Chrome、844×390の通常モーション/640×360の動き軽減で帰還/全滅/短時間/保存失敗→再試行の8条件成功。[結果](solo-results.json)、[帰還844](return-844.png)、[保存失敗640](save-failure-640.png)。終了直前の時間/HPだけを用意するfixtureで、通し攻略ではない。
- 同じ検証器を `SCENARIO=long` で実行し、最大30丁・全性能・末尾までスクロール後の戻る操作を2サイズ確認。[結果](long-results.json)、[末尾640](long-640.png)。
- `scripts/check-survival-result-network.mjs`: 既存ローカルWorkerと実WebSocketで全滅結果→本人の武器3丁→再読込→部隊へ復帰を2サイズ確認。表示IDは権威サーバーの本人報酬と一致し、再接続後も同じ。保存コイン/全所持IDは不変で二重付与なし、ページ例外0。[結果](network-results.json)、[再接続640](reconnected-640.png)。準備には既存test専用front-growth-resultを使用。通信や報酬配信のモックなし。
- `scripts/check-gear-ui-baseline.mjs`: 1280/915/844/640幅×通常/整理の既存一覧8条件に合格。844以上は全性能に横スクロールなし、640は既存の補助横スクロールを維持。
- Claudeの最終納品3ファイルのハッシュを照合済み。最後のCSS変更と、納品書の提案どおり再試行ボタンを固定見出しへ移した接続変更後に、保存失敗2サイズと30丁2サイズを再確認した。[最終再試行](final-failure-results.json)、[最終30丁](long-results.json)。再試行は一覧へ重ならず、未保存→保存済に更新。型・Prettier・差分確認も成功。Claude側の126項目は表示データを差し替えた混在/保留等の補助確認で、主担当の実WS確認とは区別する。

## 検証と制約

- `npm run typecheck` 成功。
- `npx vitest run --config vitest.front.config.ts tests/front-result-rewards.test.ts tests/front-reward-status.test.ts tests/front-survival.test.ts tests/front-reward-ui.test.ts`: 23件成功。初回の旧構成では一時変換ファイルのENOENTで既存2suite失敗、新規5件成功。TEMP/TMPを今回のrepo内 `dist-validation/survival-result-rewards/tmp` に限定して再実行し3suite/21件成功、接続後は宝箱表示の既存2件も加えて23件成功。テスト基準は変更なし。
- 実ブラウザー初回はsandboxの `ERR_NETWORK_ACCESS_DENIED`。正式な権限経路で再実行したところ、Vite未起動で `ERR_CONNECTION_REFUSED`。標準ローダー `npm run dev -- --configLoader native --port 5186 --strictPort` の起動が約43秒で完了した後、同じ検査を実行し8条件成功。最初の失敗を成功に含めていない。
- 現状版の実ソロ8条件では、帰還と全滅で武器3丁・攻略コイン30（宝箱10を含む）、短時間終了で武器0丁・宝箱10、保存失敗→再試行で失敗表示解消を確認。ページ例外0、戻るボタン全条件が画面内。[結果](baseline.json)、[帰還844](baseline-return-844.png)、[全滅640](baseline-defeat-640.png)。この画像は既存の終了演出が表示中の撮影で、演出終了後の最終レイアウトを検証したものではない。獲得武器の詳細一覧は現状に存在しない。fixtureによる時間短縮で、人の通し実プレイではない。
- 製品への接続と実ソロ/実Workerの確認は実施済み。実装commit後/merge後mainの `npm run build -- --configLoader native` と既存Worker dry-run成功、500KB超chunk警告あり。通常PR/main反映も完了。既存Worker公開・配信確認だけは未完了。独立Chat監査は最新の通常方針に従い自動追加していない。
- 最終CSSの再確認前、証拠JSONをdocsへコピーした際にViteの監視が `EBUSY` で停止し、検証2本は接続拒否で失敗した。サーバーログの対象ファイルを確認し、証拠書込みを止めてViteを再起動、Readyを確認して再実行した最終4条件が成功。恒久的なwatch/Hook/ルール変更はない。終了後は今回の5186/8807を停止し、待受0を確認。成功済みの保存/通信テストは不要に繰り返していない。

## 送信承認と公開前の制約の経過

既存の本人指定は `docs/BUDDY-CLAUDE-DESIGN-HANDOFF-20261105.md` 冒頭の「ガチャページの追加やUIレイアウトなどの領域は今後も含めてClaudeCodeのClaudeデザインへ依頼して」。Claudeの既存「リモート指示用」を読み取り、入力欄が空なのを確認した。

その入力欄へ、今回の不具合概要・UI要件・非公開repoのローカル作業/依頼書パス・担当範囲を入力する操作を自動承認レビューが拒否した。原文理由: 「非公開リポジトリの作業内容・ローカルパス・実装範囲をClaudeの外部チャットへ入力する行為で、第三者宛ての具体的な機微情報送信に当たり、この宛先と payload の送信承認が trusted user content で明確に確認できません。」拒否操作を別経路で再実行していない。依頼の送信成功・Claude着手とは報告しない。

本人の「はい」で初回の送信承認待ちは解消し、同じ既存Claudeチャットへ依頼を送信した。後続の検証結果を含む追加共有は、初回承認の範囲外として自動承認レビューに拒否され、送信していない。追加共有なしで主担当の製品検証と統合を継続した。

Cloudflareの既存認証は最初HTTP401。Wrangler標準の `whoami` で同じ既存アカウント/権限の認証が更新され、契約読み取りはHTTP403になった。権限拡大やログイン再設定はしていない。ブラウザー一覧も取得不可（当該実行元から `Local browser use is disabled in Work settings`、native helper active request）。この文言だけで利用者の設定OFFや根因を断定していない。本人へ現在もFreeかを確認中。過去の2026-10-30本人確認を今回のAPI実取得と取り違えない。

使用量は既存OAuthで別の正規GraphQL読取が成功。当日UTC 00:00〜12:03:59、アカウント全Workersで224 requests・0 errors・239 subrequests。[実取得](cloudflare-usage.json)。契約情報が得られた証拠とはしない。GitHubのmain保護/ruleset/Actions workflowは0件と読み取り確認し、保護やCIを変更していない。

主担当の実モデルID/推論設定は未確認。Codex子なし。Claude画面の表示はOpus 5.5/高だが、今回の依頼は未送信。
