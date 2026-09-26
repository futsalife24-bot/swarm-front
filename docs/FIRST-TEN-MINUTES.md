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

作業中。最終の実行結果、対象SHA、独立監査、merge、公開をここへ追記する。実行担当の正確なモデルID・reasoning effortは未確認であり、切替は報告しない。隔離worktreeに `.meloso-judge/run.cjs` はなく、Judgeは未導入・未判定。
