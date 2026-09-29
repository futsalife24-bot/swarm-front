# SWARM FRONT リビルド共同設計

2026-09-29。状態: **2文書送信はユーザー承認済み。Claude CodeのOAuth認証エラー（401）によりOpusの回答未取得。共同設計は未完了。**

## 入口

- [読める形に整理した設計案 v0.1](DESIGN.md): 操作、成長、協力、保存、試作の推奨案。Codex案であり共同合意版ではない。
- [設計たたき台](CODEX-DRAFT.md): 体験の柱、1プレイ、3択、3構成、既存資産、技術境界。
- [Opusへの共同設計依頼](OPUS-BRIEF.md): 批判・対案・再検討を依頼する範囲。
- [論点と検証計画](DECISIONS-AND-TESTS.md): 主担当が整理した対立点、仮時系列、試作の判定条件。
- [共同作業の実行記録](COLLABORATION-RECORD.md): 承認済みpayloadのハッシュ、実行指定と確認できた障害。

ユーザーが希望する「地球防衛軍×ヴァンサバ」は、大群へ対抗する操作感とラン内成長という体験の方向。固有の素材や名称を複製する設計ではない。

## 共同作業の記録

- 主担当: Codex。実行モデルID/effortは取得できず未確認。
- 共同担当として指定: Claude Opus 5.5。CLI 2.1.114の起動と既存Pro認証状態の表示を確認したが、実リクエストでは認証が失敗した。
- 実行指定: `claude-opus-5-5` / high。これは呼出し指定であり実行済みモデルの証拠ではない。
- 最初の自動承認レビュー拒否は、ユーザーの「はい」による2文書送信の明示承認で解消。
- 承認後に同一ハッシュのCODEX-DRAFT.mdとOPUS-BRIEF.mdをCLIへ渡して実行。終了コード1、`OAuth access token is invalid`（401）。モデル回答/使用量は取得できず、推論が実行されたとは扱わない。別モデル/API課金経路への代替なし。
- 承認対象はこの2文書のみ。内部仕様要約・技術制約・既存リポジトリURLを含み、認証情報・個人情報・セーブデータ・ソースコード全文は含めない。DESIGN.md等の追加文書は送っていない。
- 停止理由: Claude Codeの既存OAuth認証がAPI側で無効と判定された。ログイン状態の表示だけでは利用可能性を確認できなかった。
- 再開条件: 既存Claudeアカウントへ正規のClaude Code再ログインを完了する。同じ2文書の送信承認を取り直さず、ハッシュ照合後に再開。
- 復旧後: 第1提案を取得→Codexが対案/整合性を検討→必要な追加送信範囲の承認を確認→共同案と未決事項を統合。共同検討を独立リリース監査の代わりにしない。

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
