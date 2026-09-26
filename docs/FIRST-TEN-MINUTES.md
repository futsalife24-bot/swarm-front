# 初出撃から再出撃までの案内改善

対象: https://github.com/futsalife24-bot/swarm-front 。開始baseは `c46f2484d39c7e9a2308c505ab4356ccd9be211b`、branchは `codex/first-ten-minutes`。正規gameに別作業の変更があるため、同じ親ディレクトリの `first-ten-minutes/` worktreeを使用。既存の保存データ・作業差分は変更しない。

## 観測した詰まりと最小修正

新規Chrome BrowserContextのタイトルから、名前登録→進行開始→出撃準備→初回説明→戦闘→戦果→装備変更→再出撃を確認。844×390と640×360、Chromeのタッチエミュレーションを用いる。人間の初見ユーザーテストではない。

| 再現箇所 | 改善前 | 改善後の意図 |
| --- | --- | --- |
| PCで射撃中に初遭遇の説明が開く | Pointer Lockが残り、マウス移動が照準用のままで「スキップ」をクリックできない | ソロの既存dialog入口でPointer Lockを解除し、説明・pauseの通常クリックを可能にする |
| 初出撃の「戦闘の基本」 | タッチ画面にもPCキー中心の説明が出る。勝利条件が書かれていない | 既存の短い説明を、全WAVE撃破・タッチ/PCの基本操作・追加目標の区別へ差替え |
| 戦果→装備変更→再出撃 | 「ホームへ」「出撃準備へ」が同じ強さ。準備フッターは兵士名のみで、通常の武器行が即時入替することが弱い | 「装備変更・再出撃」をprimaryにし、既存フッターに選択中の装備番号と「一覧タップで入替」を表示。入替先の「詳細」表記も実動作へ合わせる |

保存形式・保存処理・装備処理・敵編成・難易度・報酬値は変更しない。既存の横画面、金属調、30px武器行、性能共通見出し、名前/ロック固定を維持する。

## 再現と比較の入口

```powershell
npm ci
node scripts/check-first-ten-minutes.mjs --baseline
node scripts/check-first-victory.mjs --baseline
node scripts/check-first-encounter-pointer.mjs --baseline
# 修正後
node scripts/check-first-ten-minutes.mjs
node scripts/check-first-victory.mjs
node scripts/check-first-encounter-pointer.mjs
npm run test:save
npm run test:save:browser
```

スクリプトは自分専用のloopbackポートと一時BrowserContextを使い、本番URL・ユーザープロファイルへ接続しない。終了時に自分のViteとブラウザを閉じる。画面・実行結果は `dist-validation/first-ten-minutes/`。`--narrow` は640×360だけの再実行用。

`check-first-ten-minutes` は初回キャンセル、タイトルへ戻る、説明中の戦闘停止、移動/照準/射撃の同時タッチとcancel解除、pause/リタイア取消、報酬受取、装備2への変更、reloadと再出撃時の装備一致を確認。結果画面への到達だけは実保存関数へ合成勝利/報酬を与える。CSS安全領域は左右24px・上下8pxの変数エミュレーション。物理ノッチの検証ではない。

`check-first-victory` は新規通常セーブ・初期装備のST1を既存pilotからの通常キーボード/ポインター入力で攻略する。Worldは読み取り用cloneだけを取得し、敵・HP・時間・報酬を変更しない。勝利→報酬装備→reload→再出撃を確認する。自動操縦であり、初心者の難易度・理解度の合格証明ではない。

改善前の初回探索と統合検査では、初遭遇演出がpause操作へ割り込んでtimeoutが発生した。ゲーム修正ではなく、検証側が通常の演出スキップとpause成立を待つよう修正。成功した844の記録は保持し、640だけを再実行した。旧 `e2e/mission.spec.ts` / `pause.spec.ts` は旧 `__swarm` と旧導線を前提とするため、今回の現行通常ソロの証明に流用しない。

一方、PCの通し攻略では初遭遇のスキップ自身がdialogに遮られた。`check-first-encounter-pointer` はpilotを使わず、実マウス押下によるPointer Lock取得→初遭遇の表示→通常クリックを確認する。baselineでは旧不具合を再現できた場合に成功となる負例であり、導線の合格ではない。修正後はcapture解除・同じボタンでの戦闘再開・pauseからのクリック再開を要求する。

## 人間の初見確認（未実施）

参加者は現時点0人。協力者3〜5人を目安に、手配できる人数で実施する。募集・外部連絡・録画共有はこの作業では行わない。氏名などの個人情報をこの公開文書へ記録しない。

1. 本人の既存保存を使わず、プライベートウィンドウ等の新規環境で開始。端末・画面サイズ・入力方法と確認した公開版を記録。
2. 最初は操作説明を口頭で足さず、10分を目安に「出撃→勝利を目指す→報酬を見る→装備を替えて再出撃」を依頼する。
3. 時刻、進んだ画面、止まった操作、本人の言葉、補助の有無を記録。未勝利・途中終了も実結果のまま残す。
4. 何を倒すと勝ちか、移動/照準/射撃、追加目標の扱い、獲得武器の保存、装備の入替先を本人がどう理解したか確認する。

記録欄: 匿名番号／端末・寸法・入力／開始〜終了時刻／到達地点／詰まりと発言／補助／未確認。自動検査・Codex目視だけでこの欄を合格にしない。

## 検証・反映状況

開始後に既存PR90がmainへ反映されたため、最新main `97926835baefe1fa8fa41df079360114a3e4061d` を競合なしで取り込んだ。実装commit `6e20fd8`、統合後の検証対象はcleanな `803858ef155c5da2f2864317f243b7ee9e495777`。以下はこの統合版で実行した結果であり、以前の成功記録の転用ではない。後続は証拠・文書のみ。

- 型チェック（client/Worker）、保存単体10ファイル147件、変更ファイルの書式・diff check成功。
- 実マウスで修正前のlock残留/クリック不能を再現。修正後は初遭遇とpauseのlock解除・通常クリックでの再開が成功。pauseボタンはフォーカス後Enterで起動。初回検証のEscape1回はブラウザ側に消費されpauseへ届かなかったため、検証手順を修正した。
- 844×390・640×360の新規導線、同時タッチ/cancel、戻る、合成勝利後の報酬装備、reload/再出撃、CSS安全領域エミュレーションが成功。全体は2026-09-26T05:46台〜05:48台UTCの記録。
- 初期装備のST1通常入力による自動攻略は53.7秒（ゲーム内時間）・32撃破。初勝利→報酬装備→reload→再出撃が成功。HP・敵・時間・報酬の書換えなし。自動操縦の速さを初見プレイヤーの所要時間へ一般化しない。
- `npm run test:save:browser`: cleanな803858eで21ケース/シナリオ成功、202.15秒。競合7、固定fixture等10、分解済み報酬3、途中再開1（3回更新・再開）。実行中のソースhash/HEAD不変。
- `scripts/check-gear-ui-baseline.mjs`: 1280×582、915×412、844×390、640×360の通常/整理8組成功。30px行・20px見出し維持。844以上は横スクロール0、狭幅は名前/ロック固定・見出し同期。完全表示行数11/6/6/5。
- production/Pagesビルドとproduction Worker dry-run成功。dry-run初回はサンドボックスの親ディレクトリ読取制限で失敗し、同コマンドを通常権限で再実行して成功。500kB超チャンクの既存警告は残る。
- 新規導線の未捕捉pageerrorは0。保存ブラウザ群にはService Worker遮断、WebGL、texture読込のconsole出力があり、全console errorゼロとは扱わない。

[機械可読検証](evidence/first-ten-minutes/validation.json)。比較画像: [戦闘説明・前](evidence/first-ten-minutes/before-guide-640.png) / [後](evidence/first-ten-minutes/after-guide-640.png)、[装備・前](evidence/first-ten-minutes/before-gear-844.png) / [後](evidence/first-ten-minutes/after-gear-844.png)、[戦果・前](evidence/first-ten-minutes/before-result-640.png) / [後](evidence/first-ten-minutes/after-result-640.png)。

独立監査・merge・公開はこの時点で未完了。人間の初見確認0人、Android/iOS実機・物理safe area・Service Workerを伴う配信更新・初心者の難易度/理解度は未確認。実行担当の正確なモデルID・reasoning effortは未確認であり、切替は報告しない。隔離worktreeに `.meloso-judge/run.cjs` はなく、Judgeは未導入・未判定。元gameの別作業7ファイルは確認時からのSHA256一致で保護。

## 保存先と再開条件

[PR92](https://github.com/futsalife24-bot/swarm-front/pull/92)へcommit/push済み。branch `codex/first-ten-minutes`、base `97926835baefe1fa8fa41df079360114a3e4061d`、監査資料の対象HEAD `f470d3da0555ad0c0fd84e6669e56cae54e28dc6`。この節を含む後続の変更は記録文書だけ。

監査ZIP（400ファイル、15,944,963 bytes）は隔離worktreeの `dist-validation/first-ten-minutes/audit-f470d3d.zip` に保存。SHA256: `1360b961eeff4a3a73c927a39d8a1c9623e6fdffe508ab744304c85493d10a8d`。必要ソース・差分・比較画像・隔離テスト結果・ファイルhashを含み、実セーブ・秘密情報・無関係な資料は含めない。既存の大容量モデル/音声は変更対象外として省略したため、完全なブラウザ再実行にはリポジトリの素材も必要。

通常ChatGPTへのZIP添付を自動承認レビューが拒否した。GitHubのpublic属性、ZIP内容、AGENTSの継続承認を確認して同じ正規経路を再試行したが、明確なユーザー承認が必要として再拒否。別経路での送信は行っていない。監査未依頼・未合格、main未反映・未公開。今回のZIPを通常ChatGPTへ送信する許可をユーザーへ確認中。

再開時は保存ZIPのhashを照合し、送信許可後に通常Chatの独立監査を実施する。合格後の最新main/PRチェック、通常merge、merge HEADからのbuild、既存Worker公開、配信hash/health/新規隔離ブラウザ確認は未実施の残作業。公開確認用の準備スクリプトは `dist-validation/check-first-published.mjs` に保存済みで、まだ実行していない。人間の初見テストが0人の間は総合完了と扱わない。
