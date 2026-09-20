# PV・スクリーンショット撮影用クリーンモード

## 使い方

- 通常プレイ: パラメータなし。既存レイアウト・入力・保存設定はそのまま。
- 撮影: `?clean=1`。HUD・照準・ミニマップ・ダメージ数字・スコープ表示・タッチボタン/操作リングを隠す。
- 曳光線も非表示: `?clean=1&tracers=off`。
- 既存のクエリがある場合は `&clean=1` を追加。`clean=0` / `clean=true` は有効にならない。`tracers=off` 単独は通常プレイに影響しない。
- URLを変更して再読み込みすると切り替わる。保存データには記録しない。

ポーズボタンは画面下に残す。PCではEscapeも使用できる。ポーズメニュー・配置編集・チュートリアル・開始/終了の画面は操作できる。タッチ入力領域は透明のまま維持するため、撮影前に通常表示で配置を確認するかPC入力を使用する。

## 表示の範囲と実装

`src/client/clean-capture.ts` がURLを判定し、共通起動部 `src/bootstrap.ts` でCSS用属性を有効化する。`src/main.ts` は変更していない。ソロ/協力/訓練が共通モジュールを使うため、通常のソロ起動も対象になる。HUDの生成・更新や入力処理を止めず、撮影専用CSSで見た目だけを隠す。通常時は専用属性を付けない。

`render.ts` の攻撃予告線/着弾地点/敵の地面リング (`aimWarnings`, `rings`, `houndWarnings`) を撮影時だけ非表示にする。これらは射撃そのものとは別の補助表示。`combat-effects.ts` の橙色の弾道表現と水色の非ロケット弾の軌跡は、標準の撮影モードでは不透明度25%で残す。弾道の方向を残しつつ視覚的な遮蔽を減らすための初期値であり、PV全編での最適値を保証するものではない。構図優先の素材にはoffを選べる。

敵モデル、実際の投射物/レーザー、銃口の光、着弾の火花、爆発の光/爆風リング/煙、ロケットの煙、天候・地形は残す。攻撃予告リングと爆発リングは別オブジェクトなので一緒に消さない。戦闘・通信・スコア・保存を扱う共有/サーバーコードは変更していない。

開始時の指定パスは `C:/Users/futsa/Documents/Codex/2026-09-17/lmf-db/swarm-front`。実際には `codex/perf-probe` (`c5b41d3`) がcheckoutされていたため、そのcleanなブランチを保護し、fetch→mainをfast-forward→最新main `d8173c733dda3af236348eb374f086a60179542d` から `codex/clean-capture` を作成した。`docs/AGENTS.md` は存在せず、ルート `AGENTS.md` と `docs/WORKFLOW.md` を適用。計測ブランチの未統合機能は混ぜていない。

## 検証

- `npm run typecheck`: 成功。
- `npm run build`: 保存済み実装commit `3f40bf3` から成功。既存の500kB超チャンク警告あり。
- 新規 `tests/clean-capture.test.ts` 8件: 成功。フラグ無し/不正値/qa・perfとの通常動作、HUD要素の維持、通常曳光線、25%/off、爆発と銃口エフェクトの維持を確認。
- 関連 `clean-capture/render/layout/rescue` 合計27件: 成功。
- `npm test`: 最終実行は366成功・2テスト失敗・1スイート読込失敗（36ファイル中33成功、3失敗）。失敗3件は変更前mainのソースからも同じエラーで再現した。
  - `aim.test.ts`: ロケット照準距離の期待値1.25に対し実値1.875。
  - `weapon-stat-marks.test.ts`: `weapon-help.ts` がNodeでdocumentを参照。
  - `structure-v2.test.ts`: `__AUTO_CHANGELOG__` がテスト環境で未定義。
- `node scripts/check-clean-capture.mjs`: 実Google Chrome、844×390 / 667×375、タッチ対応をエミュレート。各サイズで通常/clean/offの6条件。HUD・ミニマップ・操作ボタンの表示/非表示、HUD更新、ポーズを開けること、pageerror 0を確認。
- 画像は [証拠フォルダー](evidence/clean-capture/)、数値は [results.json](evidence/clean-capture/results.json)。通常/clean/off各戦闘画像と各ポーズ画像の12枚。

| サイズ | 通常 | 撮影 | 曳光線off | 撮影中ポーズ |
| --- | --- | --- | --- | --- |
| 844×390 | [画像](evidence/clean-capture/844-normal.png) | [画像](evidence/clean-capture/844-clean.png) | [画像](evidence/clean-capture/844-off.png) | [画像](evidence/clean-capture/844-clean-pause.png) |
| 667×375 | [画像](evidence/clean-capture/667-normal.png) | [画像](evidence/clean-capture/667-clean.png) | [画像](evidence/clean-capture/667-off.png) | [画像](evidence/clean-capture/667-clean-pause.png) |

## 検証限界と監査の経緯

実ChromeはWindows上のヘッドレスChrome + SwiftShader。実スマホ・GPU性能・長時間撮影・全ステージ・協力の実通信・訓練入口は今回未検証。比較画像はST1開始直後の別々の実戦であり、同一フレームのピクセル一致やPV v7の再撮影ではない。曳光線の濃度/offと爆発維持は単体テストで検証し、画像から射撃中の品質まで合格とはしていない。通常時のレイアウト/入力/保存コードは変更せず、通常DOM表示の回帰をChromeでも確認した。

公開前の経緯: 独立監査は未依頼。指定経路のiabが `failed to write kernel assets: 指定されたパスが見つかりません。 (os error 3)` で初期化失敗し、js kernel reset後も同じエラー。別ブラウザや自己レビューで代替しない。復旧後に対象SHAの監査ZIPを通常Chatへ添付し、独立監査→必要修正→main反映→既存Worker公開・配信確認を再開する。その時点ではmain未反映・未公開。

保存先: [PR50](https://github.com/futsalife24-bot/swarm-front/pull/50)、実装 `3f40bf3`、監査対象 `e2b4c36e9e60ee2b8c6d59182e6b0f2920e6823f`。監査ZIPは `dist-validation/clean-capture/clean-capture-audit.zip`、SHA256 `473e3ecb32befd8cf69accea13528ca8f326df84c1161e95c6036a21ca5b3756`。後続commitは保存先/状態記録のみ。

公開再開確認: `npm run server:build:production` 成功（dry-runのみ、アップロードなし）。PR50はMERGEABLEでbase/headの変更なし。iabを再初期化してもos error 3が継続。独立監査未依頼のためmain反映/公開は未実施。

## 今回限りの監査省略指示（2026-09-20）

ユーザーが「今回監査はスキップして進めて」と明示したため、PR50は独立Chat監査を行わず通常merge・既存Worker公開へ進める。監査済み/合格とは記録しない。恒久的な監査ルール、ブランチ保護、CIを変更しない。上記の監査待ち記録は経緯として保持する。

## 公開完了（2026-09-20）

ユーザーの今回限りの監査省略指示に従い、[PR50](https://github.com/futsalife24-bot/swarm-front/pull/50) を通常merge。独立監査は未実施であり、合格扱いしていない。

- 公開ソース: `cba40a737fe9758915f5d37f1d454f2bdb6fdd9d`。
- Worker Version: `d8675285-3a47-4b71-b970-00aedabc2585`。
- URL: https://swarm-front.melosalife-24.workers.dev/?clean=1
- merge後mainのbuild/production dry-run成功。既存swarm-front Workerのみ更新。契約/公開先/権限/サーバーの保存仕様を変更していない。
- HTML・Service Worker・JS・CSSの14配信ファイルがビルドとSHA256一致。`/api/health` はok、websocket/durable-object正常応答。[配信記録](evidence/clean-capture/published/delivery.json)。
- 公開実Chrome 667×375、タッチエミュレーションの通常/cleanで実戦画面・ポーズ操作・pageerror0を確認。[結果](evidence/clean-capture/published/results.json)、[通常画像](evidence/clean-capture/published/667-normal.png)、[撮影画像](evidence/clean-capture/published/667-clean.png)、[ポーズ](evidence/clean-capture/published/667-clean-pause.png)。初回cleanは戦場読込で120秒タイムアウト、通信を記録したcleanのみの再試行では成功。初回失敗を隠していない。公開off/844幅は再実行せず、同一配信コードのローカル6条件を根拠とする。
- Cloudflare preflight: 既存Wranglerアカウントを照合し、公式GraphQLで当日Workers 11 requests / 0 errors / 17 subrequestsを確認。契約一覧APIは403で当日契約を再確認できず、直近のFree確認記録を参照した。Workers account-settingsは取得成功（standard）。この値単独をFree契約の証明とは扱わない。契約情報の当日再確認、DO使用量の当日再測定は未完了の確認限界として残す。新規契約・課金変更は行っていない。

公開後のcommitは本節・STATE・公開証拠の記録のみ。公開済みコードは上記ソースSHAで固定。実スマホ・長時間録画・協力実通信・射撃中のPV品質は引き続き未確認。
