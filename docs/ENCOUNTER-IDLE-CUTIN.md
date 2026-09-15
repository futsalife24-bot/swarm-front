# 初会敵演出 v2 — 2026-09-14

画面停止→上下黒帯→ズームの順序を維持し、ズーム後の名前・記録テキスト表示中だけ対象1体の待機を再生する。ゲーム時間・AI・攻撃・他の敵を停止したまま、独立した描画時間で6種の既存Idleクリップを再生。連結炉は脚と位置を保持し、発射器と頭部6器官を小さく左右へ振る観測動作。閉じる際は捕捉した描画姿勢を復元し、非表示タブでは演出時間も進めない。

名前は左中央、対象は右寄りへ構図を調整。暗い観測パネル、白い大文字、淡い琥珀色の線と分類補助を使用。新書体はIndian Type FoundryのRajdhani Bold。Google Fonts公式配布のTTFとSIL OFL 1.1を同梱し、第三者CDNへの実行時依存なし。
出典: https://github.com/google/fonts/tree/main/ofl/rajdhani

## 変更・監査証拠

branch codex/home-armory、base/head 4186f25f7c9695f95ea897ad182db5f85fac3091。未コミット。既存差分を維持。

- src/client/playtest-app.ts: 紹介タイムライン、名前の構造、構図、紹介終了時の復元。
- src/client/playtest.css: 同梱フォント、左中央の名前パネルと360msカットイン。
- src/client/render.ts: 紹介対象1体の描画属性のみ更新・復元。
- src/client/foundry-worm.ts: 連結炉の紹介専用観測動作。
- public/assets/fonts/rajdhani/: フォントと配布ライセンス。
- scripts/check-encounter-idle.mjs / check-encounter-idle-published.mjs: 全種・公開確認。
- scripts/record-encounters.mjs / encode-encounters.mjs: 保存先指定対応、新版動画の収録・変換。

今回だけの4ソース差分、変更前コピー、前後SHA256はdist-validation/encounter-idle/。検証checks.json、公開published.json、14画面PNG、動画検証JSONも同じ場所に保存。

## 検証

型チェック、通常/Pages build、公開Worker dry-run成功。関連3ファイル36テスト成功。既存500KBチャンク警告あり。
Chrome 844×390 / 1280×720で全7種、合計14ケース成功。ズーム中は敵のポーズ固定、文字表示中は対象の待機が実画像で変化。World全体とモーション制御状態が不変、同種の2体目は描画ポーズも不変、カメラ固定、閉じた後のポーズ復元。全名称の収まりと同梱書体読込、描画例外0を確認。実スマホ未確認。

公開Version 16413e52-860e-4506-afe2-867050dd64b9。公開後は12ファイルの一致、844×390で順序・待機の実画像変化・HUD停止・フォント・戦闘復帰/停止・health成功。
https://swarm-front.melosalife-24.workers.dev/?playtest=1

## 動画共有

全7種の現行演出をローカル録画用の遭遇配置で収録。1280×720、30fps、無音。個別7本とまとめ1本。前回動画を保持した別フォルダ:
https://drive.google.com/drive/folders/1jqgXS4hWlHQq9mlCbfYiJwMuUJX0YFzX


最終調整: 連結炉の寄り距離を従来値に保持して手前の構造物の映り込みを低減。モデル読込中は通常描画を続けて待ち、配置済みモデルで紹介を開始。連結炉2寸法の時間固定・実画面動作・ポーズ復帰を再検証、型/通常/Pages buildと最終公開12ファイル一致・実操作成功。

Driveアップロード後、フォルダ一覧でMP4全8本の存在・サイズ一致・ダウンロード可能状態を確認。各MP4とまとめを最後までデコード、全7種の時間別フレームを目視確認。まとめ: https://drive.google.com/file/d/1WEvXu5AbELdpeSyDtLJ3WFNohZ2IvQzz/view

