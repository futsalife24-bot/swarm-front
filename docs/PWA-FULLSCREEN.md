# PWA横向き全画面（2026-09-13）

## 実機報告による回帰修正（現行、2026-09-13）
ユーザー実機ではPWA起動後にステータスバーが常駐。旧実装はstandalone/minimal-ui/iOSホーム画面起動も全画面と同一視し、必要なrequestFullscreenまで止めていた。実機のdisplay-mode値は未取得だが、この条件では非全画面PWAを全画面に戻せないことをコードで確認。

src/client/landscape.tsで省略条件を実際の(display-mode: fullscreen)またはdocument.fullscreenElementのみに限定。旧manifestのstandalone起動やfullscreen非対応へのフォールバックでは通常タップから全画面に入り、全画面中は再要求しない。manifestのfullscreen/landscape設定は維持。端末の設定更新を待つ間も操作から全画面に入れる。

scripts/check-pwa-fullscreen.mjsの期待値も修正。真のfullscreenでは要求0、その他3条件では最初の操作で要求1回・全画面中の画面移動で追加なし・解除後射撃で合計2回。前回の「全条件で要求0」検証は非全画面の見落としであり、実機改善の証明になっていなかった。

今回差分: dist-validation/pwa-fullscreen/regression.patch。branch/base/headは下記から変更なし、既存差分保持。実機確認は未実施。DOM全画面が必要な端末では切り替え案内が出る可能性は残る。

回帰修正版を公開済み: Version 7be0b569-3739-4c79-9a88-d1ee27c786d2。型/client build/Worker dry-run、修正したPWA4表示条件、実Chrome全画面開始・解除後復帰が成功。公開版でも4条件の操作/復帰、実SWのmanifest更新とオフライン起動成功。配信HTML/JS/CSS/manifest/sw一致・health正常。証拠: dist-validation/pwa-fullscreen/checks.json、published.json、regression-release.json。これらの4表示条件はエミュレーションであり、Android/iOS実機のバー非表示の成功証明ではない。

以下は前回公開の履歴（standalone等を抑止した記述は上記で訂正）。

実装・ローカル検証完了。初回deployは自動承認レビューが今回の公開明示承認不足として拒否。その後ユーザーの「承認します」を受けて既存Workerへ公開済み。

## 変更
- public/manifest.webmanifest: displayをstandaloneからfullscreenへ。orientation: landscapeと既存start_url/scopeを維持。
- src/client/landscape.ts: display-modeのfullscreen/standalone/minimal-uiとiOS navigator.standaloneを判定し、アプリのウィンドウではrequestFullscreenを呼ばない。PWA全画面ではdocument.fullscreenElementがnullでも正常なので、通常操作からDOM全画面へ入り直さない。起動・復帰時の横向きロックは維持。
- public/sw.js: manifestをネットワーク優先・通信失敗時キャッシュへ。以前のstandalone設定がキャッシュに固定されることを防止。保存データの削除なし。
- e2e/pwa.spec.ts: 新displayの期待値へ更新。
- scripts/check-pwa-fullscreen.mjs: 表示条件・操作・復帰・古いmanifestキャッシュ・オフライン起動の検証。

## 検証と証拠
- npm run typecheck、npm run build成功。既存の大きなJS chunk警告あり。
- npm run server:build:production成功。初回sandbox内実行は権限制限で失敗、許可された昇格dry-runで成功。
- node scripts/check-pwa-fullscreen.mjs成功。4表示条件のエミュレーションで武器庫→準備→戦闘→復帰→射撃後のrequestFullscreen呼出し0、横向きlock、ページ例外0。実Service Workerで古いmanifest更新とオフライン起動成功。
- node scripts/check-fullscreen-keep.mjs成功。ブラウザAPI成功/拒否条件、実Chrome全画面開始・準備/射撃タップ復帰。
- dist-validation/pwa-fullscreen/checks.json、battle.png（目視済み）、tracked.patch、landscape.patch。既存ブラウザ検証はdist-validation/fullscreen-keep/checks.json。
- Android/iOSの実インストール・システムバー・通知の表示は未検証。iOS等のfullscreen/向き固定非対応はWeb側から強制できない。変更済みe2e/pwa.spec.ts自体は未実行、今回の配布版用スクリプトで実SWの起動・キャッシュ更新を確認。

## 公開後の利用
オンラインで起動・一度閉じてホーム画面から起動。既存インストールのmanifest反映には端末側の更新待ちがあり得る。再インストールやサイトデータ削除はセーブ消失の可能性があるため案内しない。通常ブラウザのOS全画面通知を消す変更ではない。

branch: codex/home-armory。base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091。commit/mergeなし。既存の多数の未コミット・未追跡差分を保持。
公開Version: 6fb5a9eb-b657-4db7-acfe-888e6d574874。
公開URL: https://swarm-front.melosalife-24.workers.dev
配信JS/CSS/manifest/swのローカル配布物とのバイト一致・health 200 / ok:trueを確認。証拠: dist-validation/pwa-fullscreen/release.json。公開検証は初回sandboxネットワーク制限により失敗し、許可された昇格で実施。
公開版の4表示条件でも全画面要求0・横向きlock・武器庫/準備/射撃/復帰・ページ例外0、古いmanifest更新、実SWのオフライン起動が成功。証拠: dist-validation/pwa-fullscreen/published.json、published-battle.png。実Android/iOSのインストール後の挙動は引き続き未確認。

参考: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
