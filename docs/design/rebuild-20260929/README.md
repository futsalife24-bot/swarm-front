# SWARM FRONT リビルド共同設計

2026-09-29。状態: **Codexたたき台を準備済み。Opusへの2文書送信は具体的承認待ち。共同設計は未完了。**

## 入口

- [設計たたき台](CODEX-DRAFT.md): 体験の柱、1プレイ、3択、3構成、既存資産、技術境界。
- [Opusへの共同設計依頼](OPUS-BRIEF.md): 批判・対案・再検討を依頼する範囲。
- [論点と検証計画](DECISIONS-AND-TESTS.md): 主担当が整理した対立点、仮時系列、試作の判定条件。

ユーザーが希望する「地球防衛軍×ヴァンサバ」は、大群へ対抗する操作感とラン内成長という体験の方向。固有の素材や名称を複製する設計ではない。

## 共同作業の記録

- 主担当: Codex。実行モデルID/effortは取得できず未確認。
- 共同担当として指定: Claude Opus 5.5。CLI 2.1.114の起動と既存Proログインを確認。
- 指定予定: `claude-opus-5-5` / high。これは呼出し指定であり実行済みモデルの証拠ではない。
- 実行結果: モデル送信前に自動承認レビューが拒否。Opus応答/使用量はなし。別モデルへの代替なし。
- 送信予定: CODEX-DRAFT.md、OPUS-BRIEF.mdの2文書のみ。内部仕様要約・技術制約・既存リポジトリURLを含む。認証情報・個人情報・セーブデータ・ソースコード全文は含めない。
- 停止理由: Opusとの相談は依頼済みだが、内部設計・制約・リポジトリ情報を外部サービスへ送る具体的承認がないとして自動承認レビューが拒否。
- 再開条件: この2文書をClaude Code経由でAnthropicのOpus 5.5へ共同設計目的で送信する明示承認。ユーザーへ具体的質問を提示済み。
- 承認後: 第1提案を取得→Codexが対案/整合性を検討→必要な追加送信範囲の承認を確認→共同案と未決事項を統合。共同検討を独立リリース監査の代わりにしない。

## 現在の保存先

GitHub: https://github.com/futsalife24-bot/swarm-front

文書作業: `C:/Users/futsa/OneDrive/ドキュメント/ChatGPT/スワフロ/balance-t7`

branch: `codex/rebuild-joint-design-20260929`

base: `a8d7b86ac5243f851795310627eb6c3546d5fc76`（2026-09-29 fetch後のorigin/main）

既存game/の作業ブランチと未保存差分、他worktreeは変更していない。ゲーム本体・セーブ・公開環境は変更なし。文書のみのため実行テスト/ビルドは対象外。リンク・内容・差分を確認する。

## 参考資料

- [地球防衛軍6 公式](https://www.d3p.co.jp/edf6/en/): 参照する体験の背景。
- [Vampire Survivors 公式ストア](https://store.steampowered.com/app/1794680/Vampire_Survivors/): 選択とラン内成長の参照。
- [Opus 5.5 公式モデル仕様](https://platform.claude.com/docs/en/models/opus-5-5/overview): モデルIDを照合。ベンチマークや価格をゲーム設計の根拠にしない。
- 既存仕様の一次資料: `src/shared/daily-defense.ts`, `src/shared/daily-rewards.ts`, `src/shared/defs.ts`, `docs/BALANCE-T7.md`, `docs/PLAYER-CONTINUITY-DEFENSE.md`（上記base）。
