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

## 限界・残作業

実ChromeはWindows上のヘッドレスChrome + SwiftShader。実スマホ・GPU性能・長時間撮影・全ステージ・協力の実通信・訓練入口は今回未検証。比較画像はST1開始直後の別々の実戦であり、同一フレームのピクセル一致やPV v7の再撮影ではない。曳光線の濃度/offと爆発維持は単体テストで検証し、画像から射撃中の品質まで合格とはしていない。通常時のレイアウト/入力/保存コードは変更せず、通常DOM表示の回帰をChromeでも確認した。

独立監査は未依頼。指定経路のiabが `failed to write kernel assets: 指定されたパスが見つかりません。 (os error 3)` で初期化失敗し、js kernel reset後も同じエラー。別ブラウザや自己レビューで代替しない。復旧後に対象SHAの監査ZIPを通常Chatへ添付し、独立監査→必要修正→main反映→既存Worker公開・配信確認を再開する。現時点でmain未反映・未公開。
