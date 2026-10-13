# 全ANOMALYの予備動作・赤予告・固有ボイス

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
