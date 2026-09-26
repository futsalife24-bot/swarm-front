# 設定の右メニュー集約とBGM/SE個別音量（2026-09-26）

## 依頼と実装

- サウンドテスト/PVを上段から右メニューのプレイヤー名の下へ移動。左の設定欄を横切る専用段を削除。名前はtextContentで通常表示し、右に幅52px以上の「変更」ボタン。長い名前は折り返し、編集後の表示更新を維持。
- 左に「全体音量」「BGM音量」「SE音量」。既存volumeを全体音量として維持し、bgmVolume/seVolumeは任意の0〜1倍率。旧保存では個別1（100%）で元の音量/ミュートを維持。ソロ/協力とも自動保存、協力pauseと配置練習にも反映。
- SoundのBGMは全体×BGM、SE Gainは全体×SE。SE0は既存voiceを停止し新規SEを生成しない。全体を戻しても個別比率は維持。
- サウンドテストは実効BGM音量、PVは全体音量を引き継ぐ。試聴スライダーはstep=anyとして0.35×0.5=0.175を丸めず継承。プレビュー内の音量変更を保存しない仕様は維持。
- Saveの追加フィールドを検証し、coopPreferencesの保存/読込に含める。保存version/武器/通信プロトコル/サーバーは変更しない。

## 検証

- client/worker型チェック成功。新規5件（旧保存/ミュート互換、BGMとSEの実Gain設定経路、全体変更後の倍率保持、協力設定roundtrip、不正値）と既存media/BGM/audio/shared-armoryの計66件成功。
- Chrome実ソロでBGM0/SE1→reload保持、BGM1/SE0→reload保持、BGM停止/再開をDOMから確認。SE実Gainへの独立反映はSound+AudioContext stubの単体テスト。主観的な聴感確認とはしない。
- 844×390/667×375で右側に名前と変更ボタン・再生2項目、上段mediaなし、左欄約201px/186px、本文/横overflowなし。20文字の長い名前も編集・保存・折り返し、短い通常名も確認。サウンドテストの引継ぎ0.175を確認。
- 実ローカルWorker協力で設定BGM0/SE0.65を保存。reload後に新しい部屋へ接続し同じ値を確認。右PVの30秒durationとerrorなし。初回CORS（検証localhost未登録）は起動時のローカル許可指定で解決。本番設定は不変。旧検証部屋は30秒復帰期限切れ410、新しい部屋で再検証し退出した。
- UI証拠: `docs/evidence/settings-audio/`。初期settings-844は旧順序（再生項目が保存操作の下）。最終はsettings-final/short-nameとcoop画像。ソロ初期画像の音量数値は小数表記、最終コードは協力同様%へ揃えた。

## 作業状態

GitHub https://github.com/futsalife24-bot/swarm-front 、作業場所 `../share-image-fix`。
branch `codex/settings-audio-layout`、base `97926835baefe1fa8fa41df079360114a3e4061d`。元gameのdirty/未追跡7件は編集せず保護。実モデルID/effort未確認、切替/サブエージェント使用なし。

実スマホ・Safari/iOSの音量制約・長時間多人数・主観的SE音響は未確認。監査・main反映・既存Worker公開はこれから。

実装commit e36c7deb5985bc3a3e82864c67294d9e1019cbad後のproduction build・Worker dry-run成功。PR93: https://github.com/futsalife24-bot/swarm-front/pull/93 。最終の百分率表示画像は settings-latest-667.png。以降は記録のみ。
