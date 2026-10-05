# 旧版操作体験と段階育成の公開記録

2026-10-05。[改装版](https://swarm-front.melosalife-24.workers.dev/front)、[旧版](https://swarm-front.melosalife-24.workers.dev/)。

- 実装PR：[127](https://github.com/futsalife24-bot/swarm-front/pull/127)、通常merge済み。
- 公開ソース：`037cd374b2a1a5f075964cf7a4c08b073c548ad8`。
- Worker Version：`550fd323-86be-484c-94e5-d67bd05bdd90`。既存Worker/既存構成への公開。
- 監査：[同Chat](https://chatgpt.com/c/6ac2d707-6318-83e8-838d-ed0d785743a3)、修正版 `f8e7c1bf83b3555b191c2edb196e8662072f12cd` 合格、必須指摘なし。[判定全文](evidence/front-ux-growth-20261005/reaudit/audit-final.md)。完了表示3分57秒とコピー取得を確認。通信エラーが末尾併記されたため、判定本文もGit管理へ保存した。
- 修正後の自己検証：単体41、型、横844の実UI成功。改修全体は保存147、実通信4、横3サイズ/実2人、旧版武器一覧8表示、HUD比較2も実施済み。[仕様・限界](FRONT-UX-GROWTH.md)、[監査修正](FRONT-UX-GROWTH-REAUDIT.md)。
- 統合後mainから本番buildとdry-run成功。配信health200/ok、HTML・JS・CSS・強化画像・標準兵を含む41ファイル全件SHA一致。[照合結果](evidence/front-ux-growth-20261005/published-delivery.json)。
- 公開実画面：アプリ内ブラウザで出撃準備、武器名タップによるSMG装備、読み込み、中央3択、誘爆核選択→戦闘、1/12取得HUD、一時停止の1/3段階/進化条件、設定の音量/感度/ジャイロ/配置入口、タイトル復帰を確認。ブラウザ捕捉エラー0件。
- 旧版入口、旧保存、更新前作戦の旧規則を維持。保護ブランチも変更なし。専用背面タブ試験は未実施。固定入力9走は人による楽しさ評価ではない。

監査後の実装変更なし。公開後の差分は、この記録と証拠のみ。モデルID・推論設定は未確認、切替なし。
