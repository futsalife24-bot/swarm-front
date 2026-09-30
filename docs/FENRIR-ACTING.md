# Fenrir採用6台詞のゲーム統合（2026-09-30）

GitHub: https://github.com/futsalife24-bot/swarm-front
作業場所: 既存`balance-t7` worktree（`game/`の別作業差分は保護）。
branch: `codex/fenrir-six-callouts` / base: `4520c57`。

ユーザーが試聴した改訂2の6本を採用し「組み込んで」と指示。既定声はFenrirを継続。既存11台詞を保持し、ゲームと既存サウンドテストを計17台詞にする。3声切替は保留。

| 場面 | 台詞 | 初期確率と発声条件 |
|---|---|---|
| 回避 | ほっ！ | 自分のevade開始で25%。抽選間隔6秒 |
| 被救助 | ありがとう！ / 助かったよ！ | 自分のダウン→生存と、新規の本人のreviveイベントが一致した時に80%。前回と同じ台詞を避ける |
| ピンチ | まだやれる！ / まずいな……！ | 最大HPの25%以下に入る時25%。40%超へ回復後に再許可、抽選間隔30秒。最大HPは育成値を反映。前回と同じ台詞を避ける |
| 開始 | よし、行こう！ | 正規出撃を明示通知した時35%、同じrun/ownerで1回。保存からの再開・初回スナップショット・再接続は対象外 |

共通: 発声後6秒、警告後10秒の既存間隔を維持。同じ更新の優先順位は大型警告→被救助→ピンチ→次WAVE→回避→被弾→装填→援護/射撃。抽選落選・他の発声中・ミュート・非表示・デコード未完了の機会は保存せず、後から鳴らさない。開始音声は正規開始通知だけ例外として初期観測時に抽選する。開始時はWAVE1を重ねない。

Soundはダウン時の発声を即停止する一方、状態観測は継続して本当の救助を識別。通信/非表示/一時停止では既存の再基準化を維持。権威シミュレーションの既存reviveイベントに救助されたplayer.idをownerとして付与（既存フィールド、保存形式変更なし）。他プレイヤーの救助・単なるHP回復では感謝しない。

ソロ/日替わり防衛は新規launchの入場操作だけで開始を通知。協力は同じ接続でロビー通知→戦闘通知を受けた時だけ通知し、ロード中の接続中断でも取り消す。

## 素材・検証

- `assets-src/voice-fenrir-acting-v2/`: 原本、生成指示、採用manifest、再現用処理スクリプト。ユーザーが許容した「まずいな……！」の冒頭の息遣いも保持。
- `public/assets/audio/voice-fenrir-v1/`: 6本追加、すべて試聴版のSHA256と完全一致。`node scripts/check-fenrir-acting.mjs`で照合。
- client/worker型チェック成功。
- 関連7ファイル107件成功（soldier-voice/soldier-playback/audio/media-playback/media-dialog/game/rescue）。実stepで回避/救助を発生させるテスト、最大HP/閾値/間隔/無発声/復帰/重複抑制/既存台詞回帰を含む。
- 実IABの設定→サウンドテストで17台詞表示。追加6本すべてended=true、メディアエラーなし。[再生記録](evidence/fenrir-acting/playback.json)、[画面](evidence/fenrir-acting/sound-test.png)、[素材照合](evidence/fenrir-acting/assets.json)。
- Judge入口はこのworktreeに未導入のため未判定。有料の代替呼び出しなし。実行モデルID/effortは未確認、切替なし。
- 物理Androidでの戦闘中の聴感と今回の協力実通信確認は未実施。単体テストを実通信試験とは扱わない。

独立Chat監査・main反映・本番公開は未完了。後続の証拠をこの文書へ追記する。

## 監査ZIP送信の承認待ち

PR114: https://github.com/futsalife24-bot/swarm-front/pull/114
実装HEAD: 1bc554e70ac26eb37032a275e1ba48482f46c4e1 / base: 4520c57ede444d44b8699753645f36ce479b72bf 。差分はcommit/push済み。production build、Worker dry-runも成功（既存chunkサイズ警告のみ）。
資料: dist-validation/fenrir-acting/fenrir-acting-1bc554e-audit.zip、1,831,640 bytes、SHA256 406C1AA4347DDFC993EC3EBDF47779D2610B9892F368E4D22F7AD80756E68A39 。変更ソースと依存、採用音声、生成指示/manifest、差分、107件テスト・型・build/dry-run結果、UI証拠を収録。秘密情報・個人情報・セーブは含めていない。通常Chat/Proを画面で確認しfilechooserで添付を試みたが、実行前に自動承認レビューが拒否。未添付・未送信・監査未依頼。

停止理由: 自動承認レビューが、非公開ソースを含む今回ZIPのChatGPT通常新規Chatへの具体的な送信承認が不足と判定。プロジェクトの継続承認だけで送信できると扱わず、経路の迂回もしない。
再開条件: ユーザーが今回ZIPをChatGPT通常新規Chatへ独立監査目的で送信することを明示承認。上記SHA256を照合して添付→監査結果/必須修正→通常merge→既存Worker公開と配信確認。送信確認を提示済み。main/本番は変更していない。

## 具体的送信承認取得後のChatGPT障害

2026-09-30、ユーザー「承認」。記録された同一SHA256のZIP添付は成功し、自動承認レビューの拒否は解消。通常Chatの送信後にUnknown errorが表示され、画面の再試行で入力へ戻ったため同じZIPを再添付して再送したが、同じUnknown errorが再発。監査回答なし。実装・素材は不変、PR114はMERGEABLE、mainはbaseのまま。通常Chat/iab以外へ切り替えたり、自己レビューで監査を代替したりしない。

証拠: [送信エラー画面](evidence/fenrir-acting/audit-send-error.png)。通常Chatのタブ22を保持。最後の仮URLは https://chatgpt.com/c/local-chatgpt%3Addaa656d-ecfd-4025-b55d-c394638ba5f9 （ローカル未同期表示であり、監査のサーバー受信成功を表さない）。ログに別の計測リクエスト403も見られたが、送信エラーとの因果関係は未確定。

停止理由: ChatGPTの添付付き監査依頼送信が2回ともUnknown errorとなり、監査が進められない。
再開条件: 指定の通常Chat送信が復旧したら、承認済み同一ZIPで監査を再開。承認は再要求しない。必須監査合格後main反映と既存Worker公開を行う。
