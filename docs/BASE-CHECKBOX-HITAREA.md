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

## 独立監査結果

[PR152](https://github.com/futsalife24-bot/swarm-front/pull/152)、対象 `eac10df84600bc36d21d94dcfb8ff7705fa1e5fc`。iabの[通常新規Chat](https://chatgpt.com/c/6ac6bba0-58b0-83ee-a7a3-1d2c2a923f9f)で合格、必須P0/P1/P2=0、通常merge・既存Worker公開へ進行可。[回答全文](evidence/base-checkbox-20261008/audit-final.md)。必須修正なし、監査後の製品変更なし。

添付 `audit-eac10df.zip`、22,134,592 bytes、SHA256 `ef4de38535e00066ef098196d7ce9e81b5cf281f8527cd43cd2067c7d560f6c0`。manifest247ファイル一致。監査側はソース・差分・証拠を確認し、Windows試験を独立再実行したものではない。任意R1は20pxの実スマホ操作性、R2はpointer移動/cancel/マルチタッチ/支援技術の追加回帰。実スマホ・読み上げ実機・長時間負荷・無変更の全画面回帰は未確認。

## main統合・公開結果

PR152をReady→通常merge、main `7ae06a819aff811d8e77666f945a03e295bb3db4`。merge本文に日本語Player-Noteを保持。このmainからbuild/production dry-runを再実行し既存Workerへ公開、Version `3237fa73-3f06-40e0-9d6e-946ce6525866`。[公開版](https://swarm-front.melosalife-24.workers.dev/front)。

配信26/26 SHA一致、health200/ok。公開Windows Chromeでも通常/reduced×844×390・640×360・1220×413の6条件成功。☑内外・アイコン/名前/系統/余白・Space/Enter、閲覧だけで戻る、未選択の説明閲覧、保存/呼出/融合/戻る確認を含む。全条件console/page error0、overflow/broken0。公開844画像を目視し枠維持を確認。Turnstile要求1件のERR_ABORTEDは実ログに保存（画面離脱も行う検証、アプリ例外なし）。[公開結果](evidence/base-checkbox-20261008/public/base-checks.json)、[配信](evidence/base-checkbox-20261008/delivery.json)。

公開記録は文書専用PRでmainへ反映、製品不変のため追加公開は不要。専用ローカルサーバー/検証Chrome/監査iabタブは終了。保管庫の既存プロジェクトノートと再発防止ノートを更新し、対象2ファイルだけ自動同期へ引き渡す。戦闘演出/PR137は対象外。
