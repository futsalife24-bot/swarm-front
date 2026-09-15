# mainへの安全な集約（2026-09-15）

## 依頼と範囲

ユーザーの「安全に集約して」「mainから作業開始 → 変更を保存・検証 → mainへ反映」「1タスク1セッション」に対応する。既存GitHubへのcommit/push/main集約とプロジェクト内ルール更新が対象。既存Workerの再デプロイ、別プロジェクトや旧コピーの削除、履歴の書換えは含めない。

## 開始時の状態

- GitHub main: `25d95e35ba1e5dfd9ad1ee088a5c72689c169fcd`（9/8 20:16 JST、PR #2）。
- 手元: `codex/home-armory`、HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。
- 47追跡ファイルの変更＋464未追跡ファイル。実行コード・素材・検証・作業記録が未保存のまま混在。
- originは旧ローカルコピー。GitHubの既定ブランチはmain、公開リポジトリ、main保護なし（読み取り確認時）。保護設定は変更していない。
- `2be699f` とGitHub mainのtree差分は0。mainのマージ履歴を取り込んでも、今回保存する手元のゲーム内容を戻す必要はない。

## 保護と接続

- `dist-validation/main-consolidation-20260915/` に変更511ファイル（224,222,852 bytes）のコピーを作り、コピー前後のSHA-256一致を検証。
- `manifest-before.json` は当時の追跡＋未追跡1,421ファイルのサイズ・SHA-256。`before.patch`、`before-status.txt`、`before-refs.txt`、`before-head.txt`、`git-config.before` も保存。
- `before.bundle` に全Git参照・履歴を保存し、`git bundle verify` 成功。ローカル保管であり、このbundle自体はGitHubに送らない。Git除外の秘密設定・キャッシュ・過去のレビュー出力は元の場所を維持。
- 旧ブランチはそのまま保持し、集約ブランチ `codex/main-consolidation-20260915` を作成。旧originを `local-archive` に改名し、新originを `https://github.com/futsalife24-bot/swarm-front.git` に設定。
- 既存成果は一体の保存コミットにし、その後の検証修正・運用文書とは区別する。相互依存する機能を推測で分割しない。

## 新しい運用

`AGENTS.md` と [WORKFLOW.md](WORKFLOW.md) に開始・commit・検証・PR・main反映・clean確認・中断時の引継ぎを明記。READMEを現在の入口へ更新。親フォルダーにもgameへのルーティングを追加（親は別の未初期化Gitなので、ゲームのコミットには含まれない）。

過去のSTATEや機能文書内のbranch/HEAD/未コミット/未公開は当時の記録として残す。今後はSTATE先頭＋Gitを正とする。既存の監査・権限制約は維持する。

## 検証の開始結果と修正

- 集約前 `npm test`: 296件中282成功、14失敗。`unit-before.json` / `failures-before.json` に保存。
- 6件: 個体差導入後も旧固定HPを期待。射撃ダメージ差分、未命中対象のHP維持、貫通する3体と4体目の区別へ修正。
- 4件: PRISM/HOUND/RAY/FOUNDRYのサイズ別威力を反映していなかった。倍率込みのダメージと非対象の無傷を検証。
- 2件: 平坦化した舗装マップにも高さ変化を要求。全移動ステップ・全連結パーツの接地を確認し、移動範囲・衝突回避・snapshot再現は保持。
- 2件: ST10/ST16がテスト実行時間30秒を超過。ファイルを順番に実行すると成功したため、既定の単体テストを `fileParallelism: false` にした。ゲーム時間上限は変更しない。
- ロケットの爆風テストは、横移動する敵を外す旧配置だった。テスト内で敵を予備動作中に固定し、実弾・実爆風による2体撃破を確認する。
- 実通信の撃破検証は、水平射撃のみの旧操縦から既存の通常入力pilotへ変更。通信・HP・敵・時間をモック化せず、両ソケットの撃破/HP/状態一致と再接続を確認。
- E2Eは廃止済み `#invite` の読み出しを実際のコピーボタンへ変更（端末のクリップボードだけテスト内捕捉）。旧固定開始座標を移動差分に変更。手動作成contextをfinallyで閉じ、独立ブラウザー間のフォーカス漏れを防止。クリア演出を含む結果表示待ちを20秒にした。
- 書式チェックの既存不一致を独立コミットで整形。65個のTS/JS/設定ファイルは整形前後の正規化した実行コードが同一。通常/Pagesの生成物348ファイルも全SHA-256一致。Worker生成物には書式由来の差分があるが、入力コードの正規化一致と再ビルド成功を確認。
- 報酬画面の実ブラウザー検証で、既存の30px・1行仕様を54px・2行に上書きするCSSを検出した。`src/menu-ui.css` の重複上書きを削除し、`mobile-ui.css` の共通1行構造へ戻した。640/844pxで行高・横スクロール・固定見出しを確認。これが今回の整理中に追加した機能上の修正で、戦闘の数値や素材は変更していない。`public/` 161ファイルは開始時のSHA-256と全件一致。
- 上記348生成物一致は書式整理時点の比較。報酬CSS修正後の最終生成物は表示修正を含むため、開始時と同一とは扱わない。通常/Pagesを再ビルド済み（`build-result-final.log` / `build-pages-result-final.log`）。
- 協力プレイの結果後、装備を変えて準備完了にしてもホストが準備中のままになる既存不具合を検出。`server/worker.ts` が終了済みworldの存在だけでreadyを拒否していたため、readyは戦闘中だけ拒否し、終了後は受理するよう修正。stage変更の既存制限は維持。型チェックと両Worker dry-runを再実行済み。今回追加の機能修正は報酬CSSとこの再出撃処理の2点。
- 協力画面テストは現行の招待・準備完了ボタンへ合わせ、装備行内の効果説明を誤クリックしないよう武器名を選択する。報酬テストは再読込後の協力入口からタイトル・武器庫へ戻る実操作を使う。開発Service Workerの再読込干渉を避けるため対象contextで登録をブロックしており、PWA検証の代替ではない。

## 確認済みの検証

| 対象 | 結果 | 証拠（dist-validation/main-consolidation-20260915/） |
| --- | --- | --- |
| 通常単体・20面の攻略 | 296件成功 | unit-final.json |
| 育成・試遊・広告通知共通部 | 31件成功 | playtest-final.json |
| 実Worker/WebSocket結合 | 6件成功＋操縦修正後の残り1件成功 | integration-final.json / integration-repaired.json |
| 型・書式（最終修正後） | 成功 | typecheck-rematch-final.log / format-complete.log |
| 通常/Pages/通常Worker/production Worker dry-run（最終修正後） | 成功 | build-result-final.log / build-pages-result-final.log / worker-rematch-final.log / worker-production-rematch-final.log |
| 会敵HUDの全4段階・復帰操作 | 844×390 / 1280×582で成功 | browser-hud.log（詳細は../encounter-hud/built.json） |
| 武器行・固定比較・整理 | 4寸法×2状態で成功、844px以上の横スクロール0 | browser-gear.log（詳細は../gear-pinned/built.json） |
| 操作設定・配置編集・訓練射撃場 | 通常/試遊×3寸法で成功 | browser-controls.log |
| バトルから配置編集・復帰 | 通常/試遊で成功 | browser-controls-battle.log |
| ソロ・カメラ・タッチ・照準設定 | 既存4件成功＋移動修正後1件成功 | browser-smoke.log / browser-coop-reward-repaired.log |
| 2人参加・共有移動・再接続で同一隊員 | 1件成功 | browser-coop-reward-managed.log |
| 2人の報酬保存・装備変更・実再出撃 | 修正後成功 | browser-rematch-verified.log |
| 満杯報酬・お気に入り・再読込・分解の取消/保存失敗/成功 | 修正後成功 | browser-rematch-verified.log |

ブラウザーはPC Chromeの横画面エミュレーション。実機検証・全E2E一括合格・独立監査合格とは扱わない。再出撃時は `src/main.ts` でも終了済み戦闘の受信に合わせてロビー表示を更新し、サーバーが受け付けた準備完了を画面へ反映する。武器分解は現行の画面内確認ダイアログを操作し、保存処理の完了表示を待ってから結果を検証する。

検証済みコード/テストのHEADは `01b0bfd7df3cc84bb01676b7be7ade7cf3e2bc10`。後続は運用文書とmainの履歴接続のみ。監査の最終対象はPRのhead SHAで照合する。

## GitHub送信と機密確認

- 現在ファイルの機密候補は3箇所を確認。既存Wrangler認証を読み込むテンプレート、テスト専用パスワード、ローカル `.dev.vars` 読込関数であり、実際の値は送信対象にない。一般的な秘密鍵・GitHubトークン・クラウドキー形式を追加履歴のテキスト1,073 blobsに検査し検出0（history-secret-scan.json）。任意形式のあらゆる秘密の不在を保証する検査ではない。
- 現行ファイルに100 MiB超なし。除外された認証設定、バックアップ、node_modules/dist、別プロジェクトは送信しない。
- 初回の一括pushはHTTP 408で失敗し、リモートブランチがないことを確認。コミット単位の小分け送信へ変更。
- 小分け送信の初回は自動承認レビューが「公開先と送信対象の明示承認不足」として拒否。ユーザーへ公開リポジトリ `futsalife24-bot/swarm-front` とソース・素材・テスト・文書・Git履歴の送信範囲を提示し、「許可する」と明示承認を取得して再開した。保護の回避・force-pushはしていない。

## 監査・残条件

READMEの既存明記「本番公開・mergeは独立監査後の承認待ち」を確認。今回のmain集約承認を、独立監査の合格・免除と推定しない。集約PRとbase/head、変更一覧、検証結果を用意し、必要な監査結果を得てからmainへ反映する。

広告SDKは未接続。実機受入・各機能の残課題は元の機能文書を継承する。Git保存はゲームの全機能完成や全件監査合格を意味しない。
