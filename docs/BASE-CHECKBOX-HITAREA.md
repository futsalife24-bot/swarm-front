# 基地のチェック操作をチェック枠だけに限定（2026-10-08）

本人の追加訂正「枠デザインはオッケー。☑を触った時だけチェック切り替え」に従う。PR150のデザインを継承し、アイコン・名前・系統・余白のタップでは説明だけを表示する。

- 左端の既存20pxチェック枠を独立したcheckboxロールのbuttonへ分離。表示と同じ20×20pxだけが切替領域。上下の余白へ判定を拡張しない。
- アイコンと名前の既存領域は独立した説明button。タップ・Space/Enter・フォーカス・ホバーで右の説明を表示し、候補/dirty/保存は変更しない。buttonの入れ子なし。
- チェック枠はタップ・Space/Enterで切替。未解放を追加不可にする既存ガード、候補数条件、明示保存、融合の素材追加、ランダム3択、戻る確認は維持。
- 配色・チェック枠/カードの形・アイコン・段数を継承。checkboxは元の枠に合わせるためタッチ領域20px。実機での押しやすさとスクリーンリーダー読み上げは未確認。

正本 https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
base `42890be31a25acaafc7e260ce04bdfe8ce19dfca`、branch `codex/base-checkbox-hitarea-20261008`。製品は `src/client/front-base.ts/.css`、確認は `scripts/check-front-base.mjs`。モデルID/推論設定未確認。

## 検証と監査

Windows型チェック・本番build・production dry-run成功。関連83件は初回82成功、無変更の `front-upgrades.test.ts` の全構成列挙1件が30秒timeout（実測36.174秒）。負荷中の同設定再試験もtimeout、60秒診断は4件成功/24.43秒。専用Vite/Worker/Chromeとbuildを終了した後、**元の30秒設定で当該4件すべて成功/6.03秒**。テスト・設定・アサーションの変更/skipなし。これで関連83件の確認が揃った。dev起動154.509秒、iabのattach/CDP timeoutもあったが、専用プロセス終了後にiab通常新規Chatを開けた。秘密・権限・別監査経路の変更なし。

実Worker8789、dev5186（VITE_SERVER_URL指定）、Chrome/d3d11の通常/reduced×844×390・640×360・1220×413、6条件すべて成功。page/console error0。アイコン/名前/系統/説明欄余白/チェック上下のタップで全候補不変、説明buttonのSpace/Enterでも不変、閲覧後は破棄確認なし、未選択状態でも説明タップで追加されないことを既存の保存/融合/戻る確認へ追加。844/640画像も目視し、枠デザイン維持を照合。

初回のUI確認は読み込みtimeout。その後、Chromeが枠の4px上のタップをcheckboxへ補正することを実測した。チェック枠y=165〜185に対しpointerdown/upはy=161、clickだけy=167へ補正された。元のpointerdown/up座標が枠内の時だけクリックによる変更を許可し、pointercancelで破棄する修正後に全条件成功。キーボード/支援技術のdetail=0による操作は維持。証拠は [docs/evidence/base-checkbox-20261008](evidence/base-checkbox-20261008/)、一時資料は `dist-validation/base-checkbox-20261008/`。

詳細結果・独立通常Chatの対象SHA/判定・main/既存Worker公開・配信/公開UIの結果は確認後追記する。前回PR150の合格を今回の監査として流用しない。戦闘演出/PR137は対象外。
