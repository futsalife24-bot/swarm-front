# 育成レーダー・アクセサリUI（2026-09-21）

## 対象
- branch `codex/growth-accessory-ui` / base `b424046ac867228e22e2647d6d3a20c592ab0704`。
- 既存金属調テーマを維持し、育成を4軸のひし形レーダー・項目詳細・Lvボタンへ変更。選択に応じて詳細が遷移し、編集中の能力値とレーダーを即時更新。確定済みは点線、編集中は実線。配分不足と振り直しコイン不足を確定前に表示。
- アクセサリにレア度枠、実効果、装備状態、タップ詳細を追加。登録装備/ロック品の解体・合成保護と経済処理は既存を利用。
- 基地/武器/アクセサリ/育成の所持素材4種を説明ボタン化。既存dialog経由でフォーカス管理・入力停止を共有。費用ボタン内の素材表示は消費操作を維持。
- セーブ形式、戦闘処理、費用は変更なし。別作業 `.gitignore` / `AGENTS.md` / `package.json` / `CLAUDE.md` を保護。

## 検証
- client/worker型チェック成功。
- `npm test -- --config vitest.playtest.config.ts tests/playtest-economy.test.ts tests/playtest.test.ts`: 13/13成功。既定設定での初回実行は対象外のためテスト未実行、その後正しい設定で成功。
- `node scripts/check-growth-accessory-ui.mjs`: 640×360 / 844×390 / 1280×582で、素材説明/閉じる/フォーカス復帰、アクセサリ詳細/装備/保護、能力選択/予算超過/確定/キャンセル/解放/500コイン振り直しを検証。スクリーンショットを目視し、狭い横画面の欠けを修正。
- 実iabで基地の素材説明、育成全体/能力詳細/未解放表示を確認。
- Meloso固定 `needs_context`、live `not_run/missing_key`、API 0回。独立監査の代替ではない。
- 実スマホ端末/タッチ実機は未確認。ブラウザ検証は隔離された合成セーブのみ。

## 公開状態
独立監査・main反映・公開は準備中。後続へ監査SHA/PR/公開Versionを記録する。

## 保存・監査送信待ち
- 実装・監査対象: `fff0e44`（完全SHAは下記監査資料manifest）。[PR68](https://github.com/futsalife24-bot/swarm-front/pull/68)。後続は証拠/記録のみ。
- build成功、production dry-runは通常sandboxの読取り/ログ書込制限後、権限付き再実行で成功。
- 武器一覧baseline: 1280/915/844/640の通常・整理8ケース成功。844以上の性能横スクロール0、640は既存の補助横スクロール。
- UI操作は3サイズとも成功。4画面共通素材ポップとフォーカス復帰、育成領域スクロール欠けなし、アクセサリ4件以上を確認。代表画面とJSONは `docs/evidence/growth-accessory/`。
- ZIP `dist-validation/growth-accessory/growth-fff0e44-audit.zip`、2,463,057 bytes、SHA256 `646EA2C502972B3CF6C729D66616AC5DA0758E83E4D07D6B6B029B74940DA92F`。対象commitの23ソース/関連資料、差分、3サイズ9画面、結果JSONを含む。秘密情報・実ユーザー保存データ・対象外素材は含まない。

停止理由: 自動承認レビューが、この具体的payload/宛先の明示承認不足として、非公開UIソース差分・画面証拠ZIPの通常ChatGPT新規Chatへのアップロードを拒否。添付・監査依頼は未完了。main反映・公開も未完了。
再開条件: ユーザーが上記ZIPの通常ChatGPT（chatgpt.com）への送信を明示承認。ハッシュ照合→通常新規Chatへ添付/独立監査→必須修正/再監査→通常merge→既存Worker公開/配信確認。同内容の承認質問を提示済み。
