# HARROW v13 監査への引き継ぎ

2026-10-12。PR171: https://github.com/futsalife24-bot/swarm-front/pull/171

- branch: `codex/harrow-low-posture-v13-20261012`
- base: `cbda0481234fe494dd4d1ab023869e9812ea978d`
- 実装・ビルド対象: `cc66f070c2eacf0075cc413821fdcda41ea6d8ab`
- GLB: `772541a2735b465e2d04f8830f556f11e47ca29dee7335f8b17446a1857e0431`
- 自己検証: 122テスト、型、実Worker2接続22項目、asset/posture/40 launcher、build/production dry-runすべて成功。
- 素材・実ゲーム画像・3動作動画・ソース・差分・検証を収録した監査ZIP: `dist-validation/harrow-v13/harrow-v13-audit.zip`、136ファイル、90,928,929 bytes、SHA256 `dab6949eaf5afe66bf3556fb24ffcc1498c36a268dd72ca695fe90d873d47e0b`。CRC/全manifestハッシュ照合済み。無関係な下書きはZIPに含めていない。
- 実画面は地上・飛行中・地上/空中山なり弾・直射・爆撃・ダイブを確認。動画の全フレーム精査や実スマホ性能、本人の美術的採用は未確認。足滑り最大0.10833m、歩行境界0.323mが残る。

## 未完了と停止理由

通常Chat新規画面にも別件の496文字の下書きが引き継がれる。既存別タブ・メモリ・Git対象外のローカルファイルへ全文保存し、496文字一致を確認したが、空欄への置換は自動承認レビューに2回拒否された。理由は下書き喪失リスク。レビューが示した「新しいチャット」も試したが下書きは残った。設定・セキュリティ変更や別監査経路への迂回はしていない。

監査資料のアップロード/依頼送信は未実施。監査合格・main反映・Worker公開は未完了。公開はCALYX修正済み/ HARROW v12のまま。

再開条件: 下書きの一時置換と送信後の全文復元への明示承認、またはユーザーによる下書き整理後、iab通常Chatで添付・独立監査を再開する。資料SHAは上記実装を対象とし、その後の変更はこの進行記録のみ。合格後は通常merge→merge後build/dry-run→既存Worker公開→配信SHA/health/実UI→公開記録main反映。

下書きの永続保護先は `dist-validation/harrow-v13/preserved-chat-draft.txt`、SHA256 `e3e251ac41629809eda84317d3801127014a7d8cc9c6c14fb69367e1e802a112`。内容はGitHub/監査ZIPへ送らない。主担当モデル設定は未確認、制作補助は `gpt-6-sol` / `medium`。
