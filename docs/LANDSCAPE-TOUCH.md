# 横画面・ピンチ・スコープ同時操作（2026-09-12）

## 追加変更: 端末側の固定を優先（2026-09-12）

ユーザー指定により、CSSで画面を90度回す方式は未採用。`landscape.ts`と`index.html`を変更し、起動時のlandscapeロック、通常の開始操作（ゲーム開始/ソロ/協力/出撃）でタッチ端末のfullscreen→landscapeロックを要求する。表示復帰・pageshow・fullscreen変更でも再試行。重複要求をまとめ、失敗は捕捉する。既存manifestのlandscape指定も維持。

「横画面で遊んでください」の案内を削除。縦表示時はタイトルと「ゲームを開始」を表示し、タップ後の失敗時だけ自動切替不可を表示する。対応ブラウザでは起動時に固定を試すが、Webのユーザー操作制約を回避したものではない。既存の縦時入力解除・ソロ停止と、ピンチ/スコープ修正は保持。

型/client build/Worker dry-run/diff-check成功。Chromeタッチのスマホ・タブレット各縦横で既存の回転・スコープ・ピンチ検証成功。APIスタブ2条件（起動時許可/全画面必須）で起動時要求・タップ後のfullscreen→landscape順序を確認（`local-api.json`）。これは実iOSでの固定成功を示さない。検証を追加した際に先行検証とポートが競合したため、先行完了後に追加API検証だけ再実行して成功。

branch/base/HEADは下記と同じ、未コミット変更あり。実iPhoneで起動時固定できるかは未確認。

追加公開Version: `94745420-f895-45a6-9220-77681b28d2ad`。
公開後もAPIスタブ2条件・実Chromeタッチ2サイズの全検証成功、配信JS/CSS一致とエラーなしを確認（`published.json`）。

## 今回の差分

- `src/menu-ui.css`: メニューで横向き案内を非表示にしていた例外を削除。
- `src/style.css`: 縦向き案内の900px上限を撤廃。縦では本体を隠し、案内を不透明・最前面にする。
- `src/client/landscape.ts`（新規）, `src/main.ts`: 全サイズで縦向き時の本体をinertにし、保持入力を解除。戦闘中は既存一時停止を開く（ソロのみ進行停止、協力は進行継続）。復帰後は再開ボタンで戻る。対応ブラウザでは起動・クリック・復帰時にlandscapeロックを試行。案内ボタンではfullscreenも試行。拒否・未対応では案内を維持。
- `index.html`, `src/client/zoom-guard.ts`（新規）, `src/main.ts`: viewport倍率固定、Safari gesturestart/change/end、複数指touchstart/move、Ctrl+wheelの既定動作を抑止。イベント伝播は止めず、ゲームの複数ポインター操作を保持。
- `src/client/input.ts`: scopeを他の操作と同じpointerdown処理に追加。移動中の副ポインターでも即時切替。通常clickで二重反転させず、detail=0のキーボード操作は維持。
- `src/client/changelog.ts`: 利用者向け変更履歴。

## 検証

- 型チェック、client build、production Worker dry-run成功。既存の500kB超バンドル警告あり。
- `node scripts/check-landscape.mjs`: Chrome実タッチ入力（CDP）、390×844と1024×1366および各横向きで成功。
- 縦起動で案内・本体非表示/inert、ロック・fullscreen拒否時の継続、横向き出撃、移動継続中のスコープ2回切替、通常タップの二重反転なし、ピンチ両方向でviewport倍率不変、Safariイベントのキャンセル、射撃保持中の縦回転・停止・横復帰・再開・離脱を確認。pageerrorなし。
- 公開ページでも同スクリプトの全操作が2サイズで成功。公開配布JS/CSSとローカルdistのSHA-256一致、pageerrorなしを確認。
- `git diff --check`成功。縦案内・横向き出撃準備のPNGを目視確認。
- 初回検証ではメニューCSSの非表示例外を発見・修正。検証コードの合成pointerによるcaptureエラーは実CDP入力へ変更、個別指のtouchEnd指定も修正して再実行。

## 証拠と公開

- `dist-validation/landscape/local.json`, `published.json`と各PNG。
- 既存Workerへ公開: `57794295-215f-4e00-84e5-052a75716735`。
- URL: https://swarm-front.melosalife-24.workers.dev
- branch: `codex/home-armory`。開始base/現在HEAD: `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット変更あり。既存照準・ジャイロ等の差分を維持し、今回commit/mergeなし。

## 未確認・制約

実iPhone/iPad Safari・ホーム画面アプリは未確認。Safari用イベント抑止は実装し、Chrome上でイベントのキャンセルを検証したが、実iOSの保証ではない。OSのアクセシビリティ拡大やブラウザ側の強制設定はWebページから制御できない。向き固定に未対応のブラウザでは端末を横へ回す必要がある。
