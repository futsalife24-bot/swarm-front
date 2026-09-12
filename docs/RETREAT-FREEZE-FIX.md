# 撤退後フリーズ調査とHOUND派生の表示修正

2026-09-10。ユーザーのST16撤退後フリーズと旧デザイン混在の報告に対応。

## 確認したこと

- 通常HOUND・PRISM・RAY・FOUNDRY ZEROは採用済みGLB。HOUND/VOLLEY（ant）、HOUND/LEAPER（spider）、ミミズ型連結炉は従来の手続き生成モデルだった。
- 通常のST16撤退、40体を周囲に置く隔離fixtureでは、報告された自然発生の停止は再現しなかった。fixtureはブラウザのルート差し替えでのみ状態を注入し、公開コードに書込み用テスト機能を追加していない。密集確認用HP10000はfixture限定。
- main.tsは各フレームの最後に次のrequestAnimationFrameを登録していた。途中に例外が1回でもあると更新ループが途切れ、DOMのメニューは操作できる一方、タイトル背景は戦闘中のまま、新しいWorldもtime=0から進まなかった。
- 一時的なrender例外を1回注入すると、修正前はタイトルのカメラが戦闘位置に残り、再出撃time=0を再現。修正後はホームカメラ(8,30)に戻り、同じ試験で再出撃time=1.15まで進行。
- これは「永久停止する仕組み」の再現であり、ユーザー実機で最初に発生した例外やGPU問題を特定したという意味ではない。実機のエラーログは未取得。

## 修正

- 次フレームの登録を更新処理の前に移動。エラーは握り潰さずブラウザへ報告し、失敗時の未消化時間だけ破棄する。次のフレームと撤退後の再出撃を継続できる。
- Worldなしの画面で、敵の補間キャッシュ・攻撃粒子・ダメージ表示・モーション入力・カメラ追従位置をクリア。
- VOLLEY/LEAPERへ採用済みHOUNDの同じGLB・アニメーションを適用。図鑑も更新。VOLLEYの0.8秒予兆をHOUNDの0.45秒命中ポーズへ対応させ、発射・ダメージ・跳躍等のゲーム仕様は変更しない。
- ミミズ型連結炉は旧専用モデルを維持。節単位の破壊・分裂を持つため、新しい専用造形は今回確定していない。

## 検証と限界

- typecheck、production build、Worker production dry-run成功。既存の500kBチャンク警告あり。
- 単体171件成功（全20面クリアと派生種の攻撃タイミングを含む）。
- check-retreat.mjs: ST16/ST20の一時停止・撤退・再出撃、40体混在、3種HOUNDの同一採用アセット適用・旧表示非表示、離脱後の描画状態ゼロ、意図的な1回のrender例外後の回復に合格。
- Chrome/SwiftShader 844×390。実Android/iPhoneでの発熱・GPU停止の再現・計測は未実施。40体の密集fixtureはソフトウェア描画で重く、実機の停止原因を処理負荷だけに断定しない。
- sandbox内の公開用ブラウザ試験は外部リソースのERR_NETWORK_ACCESS_DENIEDで失敗したため、通常接続で再実行。

証拠: dist-validation/retreat-fix/ の before-failure.json、after-failure.json、regression.json、tests.log、build.log、worker-build.log、local-smoke.json、published-smoke.json、差分changes.patch。

Git: branch codex/home-armory、base/HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。開始時から多数の未コミット・未追跡差分あり、今回も未コミット。今回の変更対象はmain.ts、render.ts、structure-motion.ts、enemy-viewer.ts、changelog.ts、structure-motion.test.ts、検証スクリプトとこの作業記録。共有ゲーム計算・Worker・保存データは変更していない。

## 公開結果

既存Workerへ公開成功。https://swarm-front.melosalife-24.workers.dev
Version `5396d9a2-fa2e-4f0b-9fda-035e6eedbe89`、配信JS `/assets/index-KSz9co96.js`。
公開用ローカルビルドと実公開URLの両方で、ST16→ST20→ST16の3回の出撃・時間進行・メニュー撤退・ホーム復帰が成功。公開先の`/api/health`正常、JavaScript/console error 0。実機固有の停止についての未確定事項は上記のとおり。
