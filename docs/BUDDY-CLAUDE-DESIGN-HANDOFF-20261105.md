# ClaudeデザインへのバディUI依頼（2026-11-05）

本人の最新指示: 「ガチャページの追加やUIレイアウトなどの領域は今後も含めてClaudeCodeのClaudeデザインへ依頼して」。本書は実作業依頼。戦闘/抽選/育成/保存/同期のロジックと統合はCodex主担当、画面設計・UIレイアウト・演出はClaudeデザイン担当。主担当以外は共有STATE/MainVaultを編集せずHANDOFFへ追記案を置く。

## 作業場所と保護

repo: https://github.com/futsalife24-bot/swarm-front 。主担当worktree: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-integration （codex/buddy-game-integration-20261105、PR279）。main e8a6376に生存/カード/使い勝手修正は公開済み。旧survival-card-designのブランチ全体を戻さない。
rootのAGENTS.md、docs/agent-handoff/COMMON.md、PROJECT_RULES.md、PROJECT_CONTEXT.mdを読む。専用UI worktree/branchで作業し、他worktreeの切替/reset/cleanはしない。まずdesign/buddy-ui/に動作する画面とモジュールを用意、製品接続用のsrc/client/buddy-ui.ts/.cssを納品可。既存app/bootstrap/CSSへの接続箇所はHANDOFFで指定し、主担当と競合編集しない。共有戦闘/server/saveは編集しない。

## 確定方針と依頼範囲

進撃のみ1人1体。初回好きな1体選択、収集と育成、被りは共通突破素材、通常プレイ報酬からも突破可能。育成数値は主担当へ委任。固有スキルは初期から使う。通常攻撃自動、固有スキルボタンは時間再使用。
- タタラ火炎/範囲攻撃: 半径4m、再使用20s。
- ヨスガ風/自己回復: 持ち主のみ5秒で最大HP計25%、再使用25s。味方回復の古い記録は廃案。
- トバリ氷結/防御: 持ち主中心5mの近傍味方、6s被ダメ30%減、再使用25s。
- オリハ電撃/身体強化: 同5m6s、移動+20%/回避再使用-20%、再使用25s。
採用済GLBは主担当public/assets/buddyのtatara-v3/yosuga-v5/tobari-v7/oriha-v3。ヨスガ造形再制作は将来別タスク、今は変更しない。

ガチャ最新提案を実装可能な表示契約として準備: ticket1=1回、初期4体各25%、4連続被りの次は未所持均等保証、新規でカウントリセット。初回stage突破2枚、反復3clear相当1枚。全所持時保証countと難度別ポイントは未決扱いで、画面に仮値を確定仕様として出さない。無料・非課金。購入/広告/日課期限は追加しない。

必要画面: 初回1体選択、バディ一覧/詳細/同行変更、ガチャ(枚数/確率/保証/不足/処理中/結果/被り変換/保存失敗と再試行)、育成/突破(現在と次上限/素材/不足/成功)、戦闘HUD固有スキルの再使用待ち。抽選・保存をUI内に二重実装せず主担当の実データ/コールバックに接続する。最終APIはsrc/shared/buddy-progression.tsとbuddy-combat.tsを照合。
既存ゲームの暗い軍事SFテーマ、横画面844x390/640x360、既存設定/戻る/入力、安全領域、動きを減らす、SE音量を継承。兵士・敵・照準・予告を隠さない。本人了承なしで新しいレア度/能力を作らない。

## 保存済み参考資料（ローカルClaudeから実読取可）

MainVault起点 C:/Users/futsa/Obsidian/MainVault/START.md、memory-workflow.md。次の原ノートは用途に合わせて必要箇所だけ読む。別チャットの閲覧や全Vaultコピーは不要。
- notes/creative/2026-10-11-motion-reference-swarm-pv.md : https://motion-reference.takayustudio.jp/ 。HUD/登場/マスク/イージング/タイミング、コード転載でなく原理を自作。
- notes/creative/2026-10-12-claude-animation-style-catalog.md : 絵柄・動き・転換・カメラの切り分け。映像演出をUIへそのまま載せず操作性確認。
- notes/creative/2026-10-12-scrolltide-web-motion-reference.md : Webモーション参照。
- notes/creative/2026-10-07-nanka-dekiru.md : 82件の表現・文字・映像演出、必要項目のみ。
- notes/creative/2026-10-12-game-assets-eight-sources.md : Kenney/Freesound/OpenGameArt等の音素材入口。各素材の出典・ライセンスを再確認し表記を記録。無料=自由再配布ではない。
- notes/creative/2026-10-12-takayustudio-free-game-resources.md : 素材/学習サイトの入口。
- 10_プロジェクト/swarm-front.md のEarshot記録: https://leonxlnx.github.io/earshot-site/ 。10/24時点の検討依頼で、生成/導入済みを意味しない。ゲーム既存src/client/audio.ts等とpublic音資産を確認し、利用条件確認済みの音だけ採用。アカウント/費用の追加はしない。
これらは2026-10の保存調査。今回の最新版ライセンスや現サイト動作の保証ではない。選んだ参考資料、使った演出、採用音源とライセンス、未確認点をHANDOFFへ残す。

## 納品

プレビューだけで止まらず、ゲームへ接続できるUIモジュール/スタイルと再現手順、844x390/640x360の操作結果、通常/動き軽減/音量0/欠損/保存失敗時の確認、commit/push先をHANDOFFに記録。main反映とWorker公開はCodex主担当が統合後に担当する。最初に本書・参考ノートの実読取と担当範囲を回答してください。

## 主担当からの追記（依頼後）

Claude Codeの既存「リモート指示用」チャットへ依頼送信し、本書・Motion Reference・見本帳・Scrolltide・NANKA DEKIRU・素材8選・Takayu資料・Earshot記録の実読取返答を確認。PR279/210adf9基点のtask-buddy-uiを指定し実装開始を依頼。
全所持保証カウント0リセット、反復1clear=1unitを初期設定として主担当が採用。UIは受け取った値を表示する。操作APIはsrc/client/buddy-controller.ts applyBuddyAction、HUDはControls.activateBuddySkill()。保存成功後だけ返却saveを反映、抽選再試行は同requestId/同storage。戦闘中の選択変更は禁止。
# 納品・統合の後続記録（2026-11-05）

Claude Codeの `claude/buddy-ui-20261105` でa238729/d4abcd6/74b75dc/40eab65を納品。初回選択・編成/育成/突破・招集・確率/保証/結果/保存失敗・固有スキルHUDを統合側へ取り込み済み。参照ノートはClaudeが実読取済み。独立プレビュー216項目は `design/buddy-ui/HANDOFF.md`、主担当の実ゲーム検証は `docs/evidence/buddy-combat-progression-20261105/README.md` に分ける。

Designキャンバス: https://claude.ai/artifact/AJQjS8rdyi4KDSa4Yf7Jst （非公開）。固有スキルの操作キーは既存操作と衝突しないG。スキル名は役割名を使い、呼称は「招集」「招集チケット」「突破素材」。突破や抽選の数値はsharedから表示へ渡す。敗北/リタイアXPは即終了での稼ぎを防ぐため0。SEは既存キーだけで、新しい外部音源の採用はしていない。

本人の今後も含む担当指定を維持: ガチャページ・UIレイアウト/演出はClaude CodeのClaudeデザインへ依頼し、Codexはロジック・保存・協力・接続・検証と統合を担う。
