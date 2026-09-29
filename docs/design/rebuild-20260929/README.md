# SWARM FRONT リビルド共同設計

2026-09-29。**Opusとの3往復を終え、共同推奨v1を統合済み。** 実装/試遊はまだ行っていない。独立Chat文書監査も合格（対象8057cc3、必須指摘0件）。[監査記録](AUDIT.md)。保存/反映先はPR110。

- [共同設計 v1](DESIGN.md): 推奨する遊び、3択、3構成、協力、日替わり防衛、制作順。
- [採否と試遊条件](DECISIONS-AND-TESTS.md): なぜ変えたか、未検証事項、実装前に残る製品判断。
- [Opusの最終回答](OPUS-RESPONSE.md): 共同推奨の原文。独立監査ではない。
- [実行記録](COLLABORATION-RECORD.md): 送信承認・ハッシュ・モデル確認範囲・3往復の経緯。
- [列挙検証](verify-design.py): 抽象的な候補数/保証枠の検証。戦闘/面白さのテストではない。
- 検討前の資料: [承認済みたたき台](CODEX-DRAFT.md)、[依頼文](OPUS-BRIEF.md)、[Codex単独v0.1](CODEX-V0.1.md)。いずれも現在の推奨仕様と混同しない。

結論は「狙った一発を起点に群れを崩す、約7分のTPS」。最大7回の3択、同系統3枚で自動進化、3枚目の候補保証。最初は爆発1系統の試作、次に3系統、防衛比較、協力の順で進める。

## 検証と限界

verify-design.pyは1系統410状態/1,239遷移、3系統7,357状態/33,267遷移を確認。7取得までの候補はそれぞれ最少3種/6種、保証枠は3枠以内、進化最大1/2。ローカル文書リンクを確認。ゲームの楽しさ、戦闘、通信、UI、実機性能は未検証。

主担当Codexの実行モデルID/effortは未確認。共同担当はClaudeのUIでOpus 5.5/高を確認し、回答完了を観測。応答APIのモデルIDと実使用量は未取得。CLIの指定claude-opus-5-5/highは以前の失敗試行であり、成功の証拠にしない。

## 保存先

GitHub: https://github.com/futsalife24-bot/swarm-front

作業場所: C:/Users/futsa/OneDrive/ドキュメント/ChatGPT/スワフロ/balance-t7

branch: codex/rebuild-joint-design-20260929 / [PR110](https://github.com/futsalife24-bot/swarm-front/pull/110)

base: a8d7b86ac5243f851795310627eb6c3546d5fc76

ゲーム本体/セーブ/公開環境は変更なし。game/の既存差分は保護。文書変更に無関係なゲーム全件テストやビルドは行わない。

## 参照

- [共同設計チャット](https://claude.ai/chat/e43fc9c7-8b0f-43ad-bc25-fbebd3bc78ba)
- [地球防衛軍6公式](https://www.d3p.co.jp/edf6/en/)と[Vampire Survivors公式ストア](https://store.steampowered.com/app/1794680/Vampire_Survivors/): 大群への対抗と出撃内成長という体験の参考。固有素材/名称は複製しない。
- 既存仕様: base時点のsrc/shared/daily-defense.ts、daily-rewards.ts、defs.ts、docs/BALANCE-T7.md、docs/PLAYER-CONTINUITY-DEFENSE.md。
