# タイトル・メニュー演出品質改善の公開（2026-10-07）

正本: https://github.com/futsalife24-bot/swarm-front
作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

- [PR142](https://github.com/futsalife24-bot/swarm-front/pull/142)を通常merge。公開ソース `65c0ed30201138e3db2811b3158db70af2293d6a`（14:07 JST）。merge本文の`Player-Note:`にプレイヤー向け日本語更新説明を保持。
- 実装監査対象 `7ef32289a4662afa940c1c7accbfc9f42bb179e6`、base `1026fccaa509723c74e1b85bbdde934afe6d82f6`。以後の製品src/server差分0。監査後の追加修正はなく、確認スクリプト・証拠・文書のみ追加。
- [通常Chatの独立監査](https://chatgpt.com/c/6ac5cd95-d3f4-83ec-9f08-046535b388f4): **合格、必須P0/P1/P2各0、任意1**。[確定回答](evidence/menu-polish-windows-20261007/audit-final.md)。任意は既存の900ms監視期限を超えた画面遷移でタイトル線が出ない可能性。非同期決定ガードは維持され、今回の回帰ではない。
- 公開Worker: `swarm-front`、Version **`24caf74a-9d6a-4289-ba76-1e294caf3e9d`**。公開ソースのmainからbuildし、`wrangler.production.jsonc`のdry-run成功後に既存Workerへ公開（14:09 JSTごろ）。[公開版](https://swarm-front.melosalife-24.workers.dev/front)、従来版は同じドメインの`/`。
- 管理画面で既存アカウントのFree/$0/Current planを公開前に確認。当日153/100,000 requests、10/1〜10/7のrequests2.72k・CPU2,035ms。新規サービス・契約・権限の変更なし。

## 検証

Windowsのnpm ci、型、save147/front73/progression6/media3、本番build、Worker dry-run成功。メニュー・実ローカル通信・連続操作・武器行確認の各スクリプト成功。武器行は自然な入場終了を待って同じ判定基準を使い、PRとbase mainの両方で8表示合格。844/640・通常/reducedの各演出を実時間動画・rAF計測で確認し、実通信の準備完了/週間報酬も追加動画4条件が成功。[Windows詳細](MENU-POLISH-WINDOWS.md)。Linux既定単体5ファイルの既知失敗は元の記録を維持し、Windowsで無関係な全件単体を再実行したとは扱わない。

公開後、HTML・JS・CSS・SW・タイトル背景の**26/26ファイルのSHA256がmainビルドと一致**。healthはHTTP200、`ok:true`。[配信結果](evidence/menu-polish-release-20261007/delivery.json)。

`scripts/check-menu-polish-published.mjs`で、公開版をWindows Chromeの4条件（844×390/640×360、通常/reduced）で確認。従来版で既存Service Workerを登録した新規コンテキストから改装版へ移動し、ガイド、支給武器の一時選択、保存不変、成功演出0、横溢れ0、3本メーターの実再生/停止とreduced時静止、閉じた後のcleanupを確認。**4条件ともpageerror0・console error0**。[結果](evidence/menu-polish-release-20261007/public-ui.json)。初回は改装版単独にSW登録があると想定して待機がタイムアウトしたため、実装に合わせて登録入口を従来版へ補正。製品修正や失敗の隠蔽は行わず初回ログも保持。

公開IABの追加目視は、別タブの保存ロックにより保護画面から進めなかった。[記録](evidence/menu-polish-release-20261007/iab-ui.json)。初回の再開クリックは自動承認レビューが保存権限の奪取を懸念して拒否。`save-writer.ts`の読み取りで`ifAvailable: true`のみの非奪取処理を確認後、通常ボタン操作は実行できたが同じ保護画面だった。操作可能な一覧から保持元の別ゲームタブは特定できず、他のタブや保存・ロックを変更せず確認用公開タブを閉じ、UI014を返却。IABの追加目視を成功とは記録しない。公開版の検証結果は上記の実Windows Chrome4条件・画像確認を根拠とする。任意でIABも再確認する場合は、本人が既存のSwarm Frontゲーム画面を閉じて保存ロックが通常解放された後に行う。

## 限界・引継ぎ

- 実際のタブ非表示cleanup、実機タッチ、GPU長時間負荷、全敵モデルは未実測。監査側Linuxは依存取得未完のため独自テストの再実行は成立せず、提出したWindowsログ・JSON・動画とソースの整合を独立照合した。
- 初期IABのローカル5347で観測した一時装備成功線の原因は未特定。実配信ソース、別の新規入口、Windows Chromeの一時所持武器検査、公開版のSW有効4条件とは区別し、古い表示を合格根拠に含めない。
- 戦闘演出と兵士音声PR137は保留を維持。使用モデルID・推論設定は未確認。
- 公開記録は`codex/pr142-release-record-20261007`で保存し、通常PRでmainへ反映する。製品ソース変更を含まず再公開は不要。公開後のブラウザ検証スクリプトも再現用に保存。
