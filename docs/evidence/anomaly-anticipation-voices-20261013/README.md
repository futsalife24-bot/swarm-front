# 全ANOMALYの予備動作・赤予告・固有ボイス

## 最新の確認（2026-10-13）

今回のみ本人が承認したChrome通常Chatへ初回ZIPを送信済み。[独立監査](https://chatgpt.com/c/6acdaec0-6ddc-83ee-98d5-8c96c0c6955e)の初回判定は実装 `ea2c947` に対して要修正（P0/P1未検出、必須P2が5件）。P2-01〜05はすべて実装・回帰検証済みで、修正版を同じChatへ再監査する準備中。修正は `e6c1ff9` と未commit差分を含み、確定SHAは統合後に追記する。初回ZIPは修正前の資料であり、再監査の送信・判定は未実施。main未反映・未公開。

P2-01のVOLLEY攻撃種選択は固定照準点の距離へ統一（`431741d`）、P2-02の壁上端予告は権威と同じ50ms積分へ統一して予告4件通過。P2-03のLEAPER構え/跳躍競合、P2-04の連結FOUNDRYレーザー赤線終端、P2-05の中断後に残る古い声も修正・回帰検証済み。関連7スイート87件と予告4件、計91件通過。src・Worker・確認ページの型検査も通過した。初回のsandbox Temp ssr ENOENTは作業領域Temp・単一workerで同条件を再実行し、assertion失敗と区別した。詳細は[作業記録](../../ANOMALY-ANTICIPATION-VOICES.md)。

固定版の実ゲームRendererでは17攻撃中14ケースの表示を確認し、残るCALYX 2攻撃と連結FOUNDRYの3ケースは未確認。FOUNDRY通常の再生・側面も追加確認中。Chrome試聴一覧の16声はすべて `readyState=4`・エラーなし、再生時刻の進行、切替時の単独再生を確認した。これは実通信戦闘での全攻撃目視や本人の聴感・美術的採用の確認ではない。PNG保存はブラウザ接続障害で未達。観測の詳細は `dist-validation/anomaly-voices-20261013/chrome-qa-observations.json`。

Cloudflare既存アカウントはWorkers Free・有効。閲覧時の当日リクエスト51/100,000。既存DOの表示値は対象期間不明のため当日値とは扱わない。契約・設定変更なし（cloudflare-preflight.json）。

## 初回資料の記録

以下は修正前の初回監査資料と当時の未完了状態を保存した履歴。「履歴検査未合格」「実再生未確認」「監査未送信」は現在の状態ではない。

- [PR177](https://github.com/futsalife24-bot/swarm-front/pull/177)
- branch: `codex/anomaly-anticipation-voices-20261013`
- base: `27208f1de0d491bcfbba191a75c861bed0c29418`
- 実装対象: `ea2c94799827042a7980fdaea81401f355d1caa5`
- 記録更新は別コミット。実装差分の監査対象を変更しない。

型検査3対象（src/Worker/確認ページ）通過、Prettier通過。音声関連51件、最終戦闘関連179件と地形再実行1件の計180件、実Worker/WebSocket9件と429枠回復後1件の計10件通過。地形検査はCLI上限180秒で同じassertionを実行した。

履歴検査は既存90秒上限を超え未合格。添付ログにある失敗を通過扱いしない。実スマホと人の美術的評価は未確認。

16声は全件ブラウザreadyState 4・エラーなしを確認したが、入力が反映されず実再生は未確認。確認ページは実Rendererを使うが、最終モデルのテクスチャ読込エラーを観測しUI合格ではない。PNG保存とブラウザ全体の状態取得も時間切れ。

必須経路であるiab通常Chatへの監査送信は未実施。main未反映・未公開。

監査ZIPはローカル `dist-validation/anomaly-voices-20261013/anomaly-audit-ea2c947.zip`。349ファイル、22,348,852 bytes、SHA256 `baca9c27cc26ca61420a086788b7aa17094aeaf96625e7999156dc1d4d1b5794`。CRC・内包全ファイルのSHAを検証済み。対象コミットから抽出したソース・現行8モデル・16声・実差分・検証ログを収録。最終vite buildと本番設定Worker dry-runは成功。最終ログをZIPと本ディレクトリへ保存。公開操作は未実施。

試聴一覧 `public/anomaly-voices.html`。音声は外部AI生成ではなく独自の手続き合成。費用0。原本・計測・権利情報は `public/assets/audio/anomaly-voice-v1/`。

主担当・補助の実モデルID/推論設定は取得不可のため未確認。

再開確認（2026-10-13）: 履歴検査は既存90秒上限を変更せず単独52.11秒で通過（changelog-recovery.txt）。iab一覧/試聴一覧の表示は一度復旧したが、再生クリック・Spaceは時刻0のままで未確認。攻撃画面は再読込のCDP focus命令と画像取得が時間切れ。通常Chatタブ27へのアクセスは別件下書きの読み取り可能性を理由に自動承認レビューが拒否し、本人へ全文保護と一時置換/復元の承認を依頼中。下書きにはアクセスしていない。
